/**
 * Event Step: Analyze Content with AI
 * 
 * Subscribes to content.validated event, reads content from state,
 * calls Mistral AI API for content analysis, parses JSON response,
 * and persists analysis results before emitting completion event.
 */

import { EventConfig, Handlers } from 'motia';
import { Mistral } from '@mistralai/mistralai';
import type { ContentState, AIAnalysisResult, WorkflowStatus } from '../types/index.js';

export const config: EventConfig = {
  name: 'AnalyzeWithAI',
  type: 'event',
  subscribes: ['content.validated'],
  emits: ['content.analyzed'],
  flows: ['content-workflow'],
  infrastructure: {
    handler: { timeout: 60 },
    queue: { maxRetries: 2, visibilityTimeout: 90 }
  }
};

export const handler: Handlers['AnalyzeWithAI'] = async (input, { emit, state, streams, logger, traceId }) => {
  try {
    // Event data is passed directly on input, not input.data
    const { contentId } = input as { contentId: string; traceId: string; validationResult?: any };

    logger.info('Starting AI analysis', { contentId });

    // Initialize Mistral AI client
    const mistralApiKey = process.env.MISTRAL_API_KEY;
    if (!mistralApiKey) {
      logger.error('MISTRAL_API_KEY not configured');
      throw new Error('MISTRAL_API_KEY environment variable is required');
    }

    const mistralClient = new Mistral({
      apiKey: mistralApiKey
    });

    // Read content from state (use 'content' as groupId, not traceId)
    const contentState = await state.get('content', contentId) as ContentState | null;

    if (!contentState) {
      logger.error('Content not found for AI analysis', { contentId });
      return;
    }

    // Update workflow status to analyzing
    const analyzingStatus: WorkflowStatus = 'analyzing';
    contentState.workflowStatus = analyzingStatus;
    contentState.updatedAt = new Date().toISOString();
    await state.set('content', contentId, contentState);
    await state.set('workflow', contentId, { status: analyzingStatus, contentId });

    // Build strict prompt requesting ONLY valid JSON
    const prompt = `Analyze the following content and return ONLY a valid JSON object with no markdown, no explanations, just pure JSON:

Title: ${contentState.title}
Language: ${contentState.language}
Content: ${contentState.body}

Return a JSON object with this exact structure:
{
  "sentiment": "positive" | "neutral" | "negative",
  "topics": ["topic1", "topic2", ...],
  "readabilityScore": number (0-100),
  "wordCount": number,
  "qualityScore": number (0-100),
  "summary": "brief summary of the content",
  "strengths": ["strength1", "strength2", ...],
  "weaknesses": ["weakness1", "weakness2", ...]
}

Only return the JSON object, nothing else.`;

    // Call Mistral AI API with timeout
    let aiResponse: string;
    try {
      // Create a promise that rejects after timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('AI API timeout after 45 seconds')), 45000);
      });
      
      const chatPromise = mistralClient.chat.complete({
        model: 'mistral-large-latest',
        messages: [
          {
            role: 'system',
            content: 'You are a content analysis expert. Always respond with valid JSON only, no markdown formatting, no explanations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        maxTokens: 1500 // Reduced for faster response
      });

      const chatResponse = await Promise.race([chatPromise, timeoutPromise]);
      aiResponse = chatResponse.choices[0]?.message?.content || '';
    } catch (apiError) {
      logger.error('Mistral AI API call failed', { error: apiError, contentId });
      throw apiError;
    }

    // Parse and validate AI JSON output
    let analysisData: Partial<AIAnalysisResult>;
    try {
      // Clean response - remove markdown code blocks if present
      let cleanedResponse = aiResponse.trim();
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/```\n?/g, '');
      }

      analysisData = JSON.parse(cleanedResponse);
    } catch (parseError) {
      logger.error('Failed to parse AI response as JSON', { 
        error: parseError, 
        response: aiResponse.substring(0, 500),
        contentId 
      });
      
      // Fallback: create basic analysis from content
      analysisData = {
        sentiment: 'neutral' as const,
        topics: [],
        readabilityScore: 50,
        wordCount: contentState.body.split(/\s+/).length,
        qualityScore: 50,
        summary: contentState.body.substring(0, 200) + '...',
        strengths: [],
        weaknesses: []
      };
    }

    // Validate and construct complete analysis result
    const aiAnalysis: AIAnalysisResult = {
      sentiment: analysisData.sentiment || 'neutral',
      topics: Array.isArray(analysisData.topics) ? analysisData.topics : [],
      readabilityScore: typeof analysisData.readabilityScore === 'number' 
        ? Math.max(0, Math.min(100, analysisData.readabilityScore)) 
        : 50,
      wordCount: typeof analysisData.wordCount === 'number' 
        ? analysisData.wordCount 
        : contentState.body.split(/\s+/).length,
      qualityScore: typeof analysisData.qualityScore === 'number' 
        ? Math.max(0, Math.min(100, analysisData.qualityScore)) 
        : 50,
      summary: typeof analysisData.summary === 'string' && analysisData.summary.length > 0
        ? analysisData.summary
        : contentState.body.substring(0, 200) + '...',
      strengths: Array.isArray(analysisData.strengths) ? analysisData.strengths : [],
      weaknesses: Array.isArray(analysisData.weaknesses) ? analysisData.weaknesses : [],
      analyzedAt: new Date().toISOString()
    };

    // Persist AI analysis in state (use groupId, not traceId)
    contentState.aiAnalysis = aiAnalysis;
    
    // Update workflow status to analyzed BEFORE saving (so status is correct even if streams/emit fail)
    const analyzedStatus: WorkflowStatus = 'analyzed';
    contentState.workflowStatus = analyzedStatus;
    contentState.updatedAt = new Date().toISOString();
    await state.set('content', contentId, contentState);
    await state.set('ai_analysis', contentId, aiAnalysis);
    await state.set('workflow', contentId, { status: analyzedStatus, contentId });

    logger.info('AI analysis completed', { 
      contentId, 
      sentiment: aiAnalysis.sentiment,
      qualityScore: aiAnalysis.qualityScore 
    });

    // Send real-time update via stream (non-blocking - don't fail if this errors)
    try {
      await streams.contentUpdates.send(
        { groupId: contentId },
        {
          type: 'analysis_completed',
          data: {
            contentId,
            status: 'analyzed',
            analysis: aiAnalysis,
            timestamp: new Date().toISOString()
          }
        }
      );
    } catch (streamError) {
      // Log but don't fail - analysis is already saved
      logger.warn('Failed to send stream update (non-critical)', { error: streamError, contentId });
    }

    // Emit analyzed event to trigger recommendations (non-blocking - don't fail if this errors)
    try {
      await emit({
        topic: 'content.analyzed',
        data: {
          contentId,
          aiAnalysis,
          traceId
        }
      });
    } catch (emitError) {
      // Log but don't fail - analysis is already saved
      logger.warn('Failed to emit analyzed event (non-critical)', { error: emitError, contentId });
    }

  } catch (error) {
    logger.error('AI analysis error', { error, input });
    
    // Only set to failed if the actual analysis failed (not if streams/emit failed)
    const { contentId } = input as { contentId: string; traceId: string };
    try {
      const contentState = await state.get('content', contentId) as ContentState | null;
      if (contentState) {
        // Only mark as failed if analysis wasn't saved
        if (!contentState.aiAnalysis) {
          const failedStatus: WorkflowStatus = 'failed';
          contentState.workflowStatus = failedStatus;
          contentState.updatedAt = new Date().toISOString();
          await state.set('content', contentId, contentState);
          await state.set('workflow', contentId, { status: failedStatus, contentId });
        } else {
          // Analysis was saved, so ensure status is 'analyzed' even if streams/emit failed
          const analyzedStatus: WorkflowStatus = 'analyzed';
          contentState.workflowStatus = analyzedStatus;
          contentState.updatedAt = new Date().toISOString();
          await state.set('content', contentId, contentState);
          await state.set('workflow', contentId, { status: analyzedStatus, contentId });
        }
      }
    } catch (stateError) {
      logger.error('Failed to update workflow status', { error: stateError });
    }
  }
};

