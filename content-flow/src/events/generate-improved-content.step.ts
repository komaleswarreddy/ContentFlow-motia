/**
 * Event Step: Generate Improved Content
 * 
 * Subscribes to content.improvement.requested event, reads original content
 * and AI analysis from state, generates an improved version using Mistral AI,
 * and persists the improved content without overwriting the original.
 */

import { EventConfig, Handlers } from 'motia';
import { Mistral } from '@mistralai/mistralai';
import type { ContentState, ImprovedContent } from '../types/index.js';

export const config: EventConfig = {
  name: 'GenerateImprovedContent',
  type: 'event',
  subscribes: ['content.improvement.requested'],
  emits: ['content.improvement.completed'],
  flows: ['content-workflow'],
  infrastructure: {
    handler: { timeout: 60 },
    queue: { maxRetries: 2, visibilityTimeout: 90 }
  }
};

export const handler: Handlers['GenerateImprovedContent'] = async (input, { emit, state, streams, logger, traceId }) => {
  const { contentId } = input as { contentId: string; traceId: string };

  try {
    logger.info('Starting content improvement generation', { contentId });

    // Initialize Mistral AI client
    const mistralApiKey = process.env.MISTRAL_API_KEY;
    if (!mistralApiKey) {
      logger.error('MISTRAL_API_KEY not configured');
      throw new Error('MISTRAL_API_KEY environment variable is required');
    }

    const mistralClient = new Mistral({
      apiKey: mistralApiKey
    });

    // Read content from state
    const contentState = await state.get('content', contentId) as ContentState | null;

    if (!contentState) {
      logger.error('Content not found for improvement', { contentId });
      return;
    }

    if (!contentState.aiAnalysis) {
      logger.error('AI analysis not found - cannot generate improvement without analysis', { contentId });
      return;
    }

    // Mark improvement as generating (preserve original body for comparison)
    const generatingStatus: ImprovedContent = {
      originalBody: contentState.body,
      improvedBody: '',
      generatedAt: new Date().toISOString(),
      status: 'generating'
    };
    contentState.improvedContent = generatingStatus;
    contentState.updatedAt = new Date().toISOString();
    await state.set('content', contentId, contentState);

    // Send real-time update
    try {
      await streams.contentUpdates.send(
        { groupId: contentId },
        {
          type: 'improvement_started',
          data: {
            contentId,
            timestamp: new Date().toISOString()
          }
        }
      );
    } catch (streamError) {
      logger.warn('Failed to send stream update (non-critical)', { error: streamError });
    }

    // Build improvement prompt using analysis insights
    const { aiAnalysis } = contentState;
    const weaknessesContext = aiAnalysis.weaknesses.length > 0 
      ? `Areas to improve: ${aiAnalysis.weaknesses.join(', ')}.` 
      : '';
    const strengthsContext = aiAnalysis.strengths.length > 0 
      ? `Preserve these strengths: ${aiAnalysis.strengths.join(', ')}.` 
      : '';

    const prompt = `You are a professional editor. Your task is to improve the following content while preserving its original meaning, intent, and tone.

Original Content:
Title: ${contentState.title}
Body: ${contentState.body}

Analysis Insights:
- Current quality score: ${aiAnalysis.qualityScore}/100
- Readability score: ${aiAnalysis.readabilityScore}/100
- Sentiment: ${aiAnalysis.sentiment}
${weaknessesContext}
${strengthsContext}

Instructions:
1. Improve clarity, structure, and overall impact
2. Fix any grammatical or stylistic issues
3. Enhance readability without changing the core message
4. Do NOT add new ideas or change the meaning
5. Do NOT include any explanations or markdown formatting
6. Return ONLY the improved content text, nothing else

Improved content:`;

    // Call Mistral AI API with timeout
    let improvedBody: string;
    try {
      // Create a promise that rejects after timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('AI API timeout after 50 seconds')), 50000);
      });
      
      const chatPromise = mistralClient.chat.complete({
        model: 'mistral-large-latest',
        messages: [
          {
            role: 'system',
            content: 'You are a professional content editor. You improve content while preserving meaning. Always respond with only the improved content, no explanations or formatting.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.4,
        maxTokens: 3000 // Reduced for faster response
      });

      const chatResponse = await Promise.race([chatPromise, timeoutPromise]);
      improvedBody = chatResponse.choices[0]?.message?.content || '';
      
      // Clean response
      improvedBody = improvedBody.trim();
      if (improvedBody.startsWith('```')) {
        improvedBody = improvedBody.replace(/```[\w]*\n?/g, '').trim();
      }
    } catch (apiError) {
      logger.error('Mistral AI API call failed', { error: apiError, contentId });
      
      // Mark as failed
      contentState.improvedContent = {
        originalBody: contentState.body,
        improvedBody: '',
        generatedAt: new Date().toISOString(),
        status: 'failed'
      };
      contentState.updatedAt = new Date().toISOString();
      await state.set('content', contentId, contentState);
      
      throw apiError;
    }

    if (!improvedBody) {
      throw new Error('Empty response from AI');
    }

    // Persist improved content (keep original body for comparison)
    const completedImprovement: ImprovedContent = {
      originalBody: contentState.body,
      improvedBody,
      generatedAt: new Date().toISOString(),
      status: 'completed'
    };
    contentState.improvedContent = completedImprovement;
    contentState.updatedAt = new Date().toISOString();
    await state.set('content', contentId, contentState);

    logger.info('Content improvement generated successfully', { contentId });

    // Send real-time update
    try {
      await streams.contentUpdates.send(
        { groupId: contentId },
        {
          type: 'improvement_completed',
          data: {
            contentId,
            improvedContent: completedImprovement,
            timestamp: new Date().toISOString()
          }
        }
      );
    } catch (streamError) {
      logger.warn('Failed to send stream update (non-critical)', { error: streamError });
    }

    // Emit completion event
    try {
      await emit({
        topic: 'content.improvement.completed',
        data: {
          contentId,
          traceId
        }
      });
    } catch (emitError) {
      logger.warn('Failed to emit completion event (non-critical)', { error: emitError });
    }

  } catch (error) {
    logger.error('Content improvement generation failed', { error, contentId });
    
    // Ensure state reflects failure
    try {
      const contentState = await state.get('content', contentId) as ContentState | null;
      if (contentState && contentState.improvedContent?.status === 'generating') {
        contentState.improvedContent.status = 'failed';
        contentState.updatedAt = new Date().toISOString();
        await state.set('content', contentId, contentState);
      }
    } catch (stateError) {
      logger.error('Failed to update failure status', { error: stateError });
    }
  }
};

