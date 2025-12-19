/**
 * API Step: Request Content Improvement
 * 
 * Accepts a contentId, validates that analysis exists,
 * and emits an event to trigger the improvement generation.
 * Returns immediate acknowledgement without performing AI calls.
 */

import { ApiRouteConfig, Handlers } from 'motia';
import type { ContentState } from '../types/index.js';

export const config: ApiRouteConfig = {
  name: 'RequestContentImprovement',
  type: 'api',
  path: '/content/:id/improve',
  method: 'POST',
  emits: ['content.improvement.requested'],
  flows: ['content-workflow']
};

export const handler: Handlers['RequestContentImprovement'] = async (req, { emit, state, logger, traceId }) => {
  try {
    const contentId = req.pathParams?.id as string;

    if (!contentId) {
      return {
        status: 400,
        body: {
          error: 'Content ID is required'
        }
      };
    }

    logger.info('Content improvement requested', { contentId });

    // Fetch content state
    const contentState = await state.get('content', contentId) as ContentState | null;

    if (!contentState) {
      logger.warn('Content not found for improvement request', { contentId });
      return {
        status: 404,
        body: {
          error: 'Content not found',
          contentId
        }
      };
    }

    // Validate that analysis exists
    if (!contentState.aiAnalysis) {
      logger.warn('Analysis not complete - cannot request improvement', { contentId });
      return {
        status: 400,
        body: {
          error: 'Content analysis must be complete before requesting improvement',
          contentId,
          currentStatus: contentState.workflowStatus
        }
      };
    }

    // Check if improvement is already in progress
    if (contentState.improvedContent?.status === 'generating') {
      return {
        status: 409,
        body: {
          error: 'Improvement generation already in progress',
          contentId
        }
      };
    }

    // Emit event to trigger improvement generation
    await emit({
      topic: 'content.improvement.requested',
      data: {
        contentId,
        traceId
      }
    });

    logger.info('Improvement request emitted', { contentId });

    return {
      status: 202,
      body: {
        contentId,
        message: 'Improvement generation started',
        status: 'generating'
      }
    };

  } catch (error) {
    logger.error('Failed to request content improvement', { error });
    return {
      status: 500,
      body: {
        error: 'Internal server error',
        message: 'Failed to process improvement request'
      }
    };
  }
};

