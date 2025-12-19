/**
 * API Step: Get Comments
 * 
 * Retrieves all comments for a specific content item.
 */

import { ApiRouteConfig, Handlers } from 'motia';

export const config: ApiRouteConfig = {
  name: 'GetComments',
  type: 'api',
  path: '/content/:id/comments',
  method: 'GET',
  emits: [],
  flows: ['content-workflow']
};

export const handler: Handlers['GetComments'] = async (req, { streams, logger, traceId }) => {
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

    logger.info('Fetching comments', { contentId });

    // Get all comments for this content (groupId = contentId)
    const comments = await streams.comments.getGroup(contentId);

    // Sort by createdAt (newest first)
    comments.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return {
      status: 200,
      body: comments
    };

  } catch (error) {
    logger.error('Failed to fetch comments', { error });
    return {
      status: 500,
      body: {
        error: 'Internal server error',
        message: 'Failed to fetch comments'
      }
    };
  }
};

