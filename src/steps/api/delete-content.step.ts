/**
 * API Step: Delete Content
 * 
 * Deletes a content item and its associated workflow state.
 * Returns success status after deletion.
 */

import { ApiRouteConfig, Handlers } from 'motia';

export const config: ApiRouteConfig = {
  name: 'DeleteContent',
  type: 'api',
  path: '/content/:id',
  method: 'DELETE',
  emits: [],
  flows: ['content-workflow']
};

export const handler: Handlers['DeleteContent'] = async (req, { state, logger, traceId }) => {
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

    logger.info('Deleting content', { contentId });

    // Check if content exists
    const contentState = await state.get('content', contentId);
    if (!contentState) {
      logger.warn('Content not found for deletion', { contentId });
      return {
        status: 404,
        body: {
          error: 'Content not found',
          contentId
        }
      };
    }

    // Delete content from state
    await state.delete('content', contentId);
    
    // Also delete workflow state if it exists
    await state.delete('workflow', contentId);

    logger.info('Content deleted successfully', { contentId });

    return {
      status: 200,
      body: {
        success: true,
        message: 'Content deleted successfully',
        contentId
      }
    };

  } catch (error) {
    logger.error('Failed to delete content', { error });
    return {
      status: 500,
      body: {
        error: 'Internal server error',
        message: 'Failed to delete content'
      }
    };
  }
};

