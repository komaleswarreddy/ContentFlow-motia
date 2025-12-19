/**
 * Event Step: Generate Recommendations
 * 
 * Subscribes to content.analyzed event, reads AI analysis from state,
 * generates actionable publishing and improvement recommendations,
 * and persists recommendations before emitting completion event.
 */

import { EventConfig, Handlers } from 'motia';
import type { ContentState, AIAnalysisResult, Recommendation, WorkflowStatus } from '../../types/index.js';

export const config: EventConfig = {
  name: 'GenerateRecommendations',
  type: 'event',
  subscribes: ['content.analyzed'],
  emits: ['content.completed'],
  flows: ['content-workflow']
};

export const handler: Handlers['GenerateRecommendations'] = async (input, { emit, state, streams, logger, traceId }) => {
  try {
    // Event data is passed directly on input, not input.data
    const { contentId, aiAnalysis } = input as { 
      contentId: string; 
      aiAnalysis: AIAnalysisResult;
      traceId: string;
    };

    logger.info('Generating recommendations', { contentId });

    // Read content state to get full context (use 'content' as groupId, not traceId)
    const contentState = await state.get('content', contentId) as ContentState | null;

    if (!contentState) {
      logger.error('Content not found for recommendations', { contentId });
      return;
    }

    // Generate recommendations based on AI analysis
    const recommendations: Recommendation[] = [];

    // Decision logic: Publishing recommendations
    if (aiAnalysis.qualityScore >= 80 && aiAnalysis.sentiment === 'positive') {
      recommendations.push({
        id: `rec_${contentId}_publish_1`,
        type: 'publish',
        title: 'Ready to Publish',
        description: 'Content meets high quality standards and is ready for publication.',
        priority: 'high',
        actionableSteps: [
          'Review final content for typos',
          'Add relevant tags/categories',
          'Schedule publication',
          'Share on social media channels'
        ]
      });
    } else if (aiAnalysis.qualityScore >= 60) {
      recommendations.push({
        id: `rec_${contentId}_publish_2`,
        type: 'publish',
        title: 'Publish with Minor Edits',
        description: 'Content is good but could benefit from minor improvements before publishing.',
        priority: 'medium',
        actionableSteps: [
          'Address identified weaknesses',
          'Enhance strengths',
          'Review and publish'
        ]
      });
    } else {
      recommendations.push({
        id: `rec_${contentId}_review_1`,
        type: 'review',
        title: 'Needs Review Before Publishing',
        description: 'Content requires significant improvements before it\'s ready for publication.',
        priority: 'high',
        actionableSteps: [
          'Address all identified weaknesses',
          'Improve quality score above 60',
          'Get peer review',
          'Revise and resubmit'
        ]
      });
    }

    // Improvement recommendations based on weaknesses
    if (aiAnalysis.weaknesses.length > 0) {
      recommendations.push({
        id: `rec_${contentId}_improve_1`,
        type: 'improve',
        title: 'Address Content Weaknesses',
        description: `Focus on improving: ${aiAnalysis.weaknesses.slice(0, 3).join(', ')}`,
        priority: aiAnalysis.qualityScore < 60 ? 'high' : 'medium',
        actionableSteps: aiAnalysis.weaknesses.slice(0, 5).map(w => `Work on: ${w}`)
      });
    }

    // Optimization recommendations based on readability
    if (aiAnalysis.readabilityScore < 60) {
      recommendations.push({
        id: `rec_${contentId}_optimize_1`,
        type: 'optimize',
        title: 'Improve Readability',
        description: 'Content readability can be improved for better audience engagement.',
        priority: 'medium',
        actionableSteps: [
          'Use shorter sentences',
          'Break up long paragraphs',
          'Add subheadings for structure',
          'Simplify complex vocabulary where possible'
        ]
      });
    }

    // SEO and topic optimization
    if (aiAnalysis.topics.length > 0 && aiAnalysis.topics.length < 3) {
      recommendations.push({
        id: `rec_${contentId}_optimize_2`,
        type: 'optimize',
        title: 'Expand Topic Coverage',
        description: 'Consider adding more related topics to improve SEO and depth.',
        priority: 'low',
        actionableSteps: [
          'Research related subtopics',
          'Add supporting examples',
          'Include relevant keywords naturally'
        ]
      });
    }

    // Persist recommendations in state
    contentState.recommendations = recommendations;
    
    // Update workflow status to completed BEFORE saving (so status is correct even if streams/emit fail)
    const completedStatus: WorkflowStatus = 'completed';
    contentState.workflowStatus = completedStatus;
    contentState.updatedAt = new Date().toISOString();

    await state.set('content', contentId, contentState);
    await state.set('recommendations', contentId, recommendations);
    await state.set('workflow', contentId, { status: completedStatus, contentId });

    logger.info('Recommendations generated', { 
      contentId, 
      recommendationCount: recommendations.length 
    });

    // Send real-time update via stream (non-blocking - don't fail if this errors)
    try {
      await streams.contentUpdates.send(
        { groupId: contentId },
        {
          type: 'recommendations_completed',
          data: {
            contentId,
            status: 'completed',
            recommendations,
            timestamp: new Date().toISOString()
          }
        }
      );
    } catch (streamError) {
      // Log but don't fail - recommendations are already saved
      logger.warn('Failed to send stream update (non-critical)', { error: streamError, contentId });
    }

    // Emit completed event to signal workflow completion (non-blocking - don't fail if this errors)
    try {
      await emit({
        topic: 'content.completed',
        data: {
          contentId,
          recommendations,
          traceId
        }
      });
    } catch (emitError) {
      // Log but don't fail - recommendations are already saved
      logger.warn('Failed to emit completed event (non-critical)', { error: emitError, contentId });
    }

  } catch (error) {
    logger.error('Recommendation generation error', { error, input });
    
    // Ensure status is set correctly even if there was an error
    const { contentId } = input as { contentId: string; traceId: string };
    try {
      const contentState = await state.get('content', contentId) as ContentState | null;
      if (contentState) {
        // If recommendations were generated, mark as completed
        if (contentState.recommendations && contentState.recommendations.length > 0) {
          const completedStatus: WorkflowStatus = 'completed';
          contentState.workflowStatus = completedStatus;
          contentState.updatedAt = new Date().toISOString();
          await state.set('content', contentId, contentState);
          await state.set('workflow', contentId, { status: completedStatus, contentId });
        } else if (contentState.aiAnalysis) {
          // If analysis exists but no recommendations, keep as analyzed
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

