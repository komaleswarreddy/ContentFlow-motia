/**
 * API Step: Get Content
 * 
 * Fetches workflow status, AI analysis, and recommendations
 * for a given contentId. Returns structured JSON response.
 */

import { ApiRouteConfig, Handlers } from 'motia';
import type { ContentState } from '../../types/index.js';

export const config: ApiRouteConfig = {
  name: 'GetContent',
  type: 'api',
  path: '/content/:id',
  method: 'GET',
  emits: [],
  flows: ['content-workflow']
};

export const handler: Handlers['GetContent'] = async (req, { state, logger, traceId }) => {
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

    logger.info('Fetching content', { contentId });

    // Fetch content state from Motia state (use 'content' as groupId, not traceId)
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

    // Return structured JSON response with all workflow data
    return {
      status: 200,
      body: {
        contentId: contentState.contentId,
        title: contentState.title,
        body: contentState.body,
        author: contentState.author,
        language: contentState.language,
        createdAt: contentState.createdAt,
        updatedAt: contentState.updatedAt,
        status: contentState.workflowStatus,
        validation: contentState.validationResult || null,
        analysis: contentState.aiAnalysis || null,
        recommendations: contentState.recommendations || [],
        improvedContent: contentState.improvedContent || null
      }
    };

  } catch (error) {
    logger.error('Failed to fetch content', { error });
    return {
      status: 500,
      body: {
        error: 'Internal server error',
        message: 'Failed to fetch content data'
      }
    };
  }
};

