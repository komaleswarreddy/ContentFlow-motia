/**
 * API Step: Apply Improved Content
 * 
 * Accepts a contentId and applies the improved content to replace
 * the original body. Triggers re-analysis of the new content.
 */

import { ApiRouteConfig, Handlers } from 'motia';
import type { ContentState, WorkflowStatus } from '../types/index.js';

export const config: ApiRouteConfig = {
  name: 'ApplyImprovedContent',
  type: 'api',
  path: '/content/:id/apply-improvement',
  method: 'POST',
  emits: ['content.created'],
  flows: ['content-workflow']
};

export const handler: Handlers['ApplyImprovedContent'] = async (req, { emit, state, streams, logger, traceId }) => {
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

    logger.info('Apply improved content requested', { contentId });

    // Fetch content state
    const contentState = await state.get('content', contentId) as ContentState | null;

    if (!contentState) {
      logger.warn('Content not found', { contentId });
      return {
        status: 404,
        body: {
          error: 'Content not found',
          contentId
        }
      };
    }

    // Validate improved content exists and is complete
    if (!contentState.improvedContent) {
      return {
        status: 400,
        body: {
          error: 'No improved content available',
          contentId
        }
      };
    }

    if (contentState.improvedContent.status !== 'completed') {
      return {
        status: 400,
        body: {
          error: `Cannot apply improvement - status is ${contentState.improvedContent.status}`,
          contentId
        }
      };
    }

    if (!contentState.improvedContent.improvedBody) {
      return {
        status: 400,
        body: {
          error: 'Improved content body is empty',
          contentId
        }
      };
    }

    // Apply the improved content
    const originalBody = contentState.body;
    contentState.body = contentState.improvedContent.improvedBody;
    contentState.improvedContent.appliedAt = new Date().toISOString();
    contentState.updatedAt = new Date().toISOString();
    
    // Reset workflow to re-analyze the improved content
    const pendingStatus: WorkflowStatus = 'pending';
    contentState.workflowStatus = pendingStatus;
    // Clear old analysis and recommendations - they'll be regenerated
    contentState.aiAnalysis = undefined;
    contentState.recommendations = undefined;
    // Keep validation as it will be re-run

    await state.set('content', contentId, contentState);
    await state.set('workflow', contentId, { status: pendingStatus, contentId });

    logger.info('Improved content applied, triggering re-analysis', { contentId });

    // Send real-time update
    try {
      await streams.contentUpdates.send(
        { groupId: contentId },
        {
          type: 'improvement_applied',
          data: {
            contentId,
            status: 'reanalyzing',
            timestamp: new Date().toISOString()
          }
        }
      );
    } catch (streamError) {
      logger.warn('Failed to send stream update (non-critical)', { error: streamError });
    }

    // Trigger re-analysis workflow by emitting content.created event
    await emit({
      topic: 'content.created',
      data: {
        contentId,
        traceId
      }
    });

    return {
      status: 200,
      body: {
        contentId,
        message: 'Improved content applied. Re-analyzing content...',
        originalBodyLength: originalBody.length,
        newBodyLength: contentState.body.length,
        appliedAt: contentState.improvedContent.appliedAt,
        status: 'reanalyzing'
      }
    };

  } catch (error) {
    logger.error('Failed to apply improved content', { error });
    return {
      status: 500,
      body: {
        error: 'Internal server error',
        message: 'Failed to apply improved content'
      }
    };
  }
};

