/**
 * API Step: Apply Improved Content
 * 
 * Accepts a contentId and applies the improved content to replace
 * the original body. Simply updates the content - no re-analysis.
 */

import { ApiRouteConfig, Handlers } from 'motia';
import type { ContentState } from '../../types/index.js';

export const config: ApiRouteConfig = {
  name: 'ApplyImprovedContent',
  type: 'api',
  path: '/content/:id/apply-improvement',
  method: 'POST',
  emits: [],
  flows: ['content-workflow']
};

export const handler: Handlers['ApplyImprovedContent'] = async (req, { state, logger }) => {
  try {
    const contentId = req.pathParams?.id as string;

    if (!contentId) {
      return {
        status: 400,
        body: { error: 'Content ID is required' }
      };
    }

    logger.info('Apply improved content requested', { contentId });

    // Fetch content state
    const contentState = await state.get('content', contentId) as ContentState | null;

    if (!contentState) {
      return {
        status: 404,
        body: { error: 'Content not found', contentId }
      };
    }

    // Validate improved content exists and is complete
    if (!contentState.improvedContent || contentState.improvedContent.status !== 'completed') {
      return {
        status: 400,
        body: { error: 'No completed improved content available', contentId }
      };
    }

    if (!contentState.improvedContent.improvedBody) {
      return {
        status: 400,
        body: { error: 'Improved content body is empty', contentId }
      };
    }

    // Apply the improved content (just update body, keep existing analysis)
    const originalBody = contentState.body;
    contentState.body = contentState.improvedContent.improvedBody;
    contentState.improvedContent.appliedAt = new Date().toISOString();
    contentState.updatedAt = new Date().toISOString();

    // Save state - keep existing workflow status and analysis
    await state.set('content', contentId, contentState);

    logger.info('Improved content applied successfully', { contentId });

    return {
      status: 200,
      body: {
        contentId,
        message: 'Improved content applied successfully',
        originalBodyLength: originalBody.length,
        newBodyLength: contentState.body.length,
        appliedAt: contentState.improvedContent.appliedAt,
        status: contentState.workflowStatus
      }
    };

  } catch (error) {
    logger.error('Failed to apply improved content', { error });
    return {
      status: 500,
      body: { error: 'Internal server error' }
    };
  }
};

