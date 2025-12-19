/**
 * API Step: List Content
 * 
 * Lists all content items for dashboard display.
 * Returns array of content summaries.
 */

import { ApiRouteConfig, Handlers } from 'motia';
import type { ContentState } from '../types/index.js';

export const config: ApiRouteConfig = {
  name: 'ListContent',
  type: 'api',
  path: '/content',
  method: 'GET',
  emits: [],
  flows: ['content-workflow']
};

export const handler: Handlers['ListContent'] = async (req, { state, logger, traceId }) => {
  try {
    // Extract userId from query parameters if provided
    // Query params can be string or string[], so handle both cases
    const userIdParam = req.queryParams?.userId;
    const userId = Array.isArray(userIdParam) ? userIdParam[0] : userIdParam;
    
    logger.info('Fetching content', { userId: userId || 'all' });

    // Get all content from state using getGroup
    const allContent = await state.getGroup('content') as ContentState[] | null;

    if (!allContent || allContent.length === 0) {
      return {
        status: 200,
        body: []
      };
    }

    // Filter by userId if provided
    let filteredContent = allContent;
    if (userId) {
      filteredContent = allContent.filter((content: ContentState) => 
        content.userId === userId
      );
      logger.info('Filtered content by userId', { userId, count: filteredContent.length });
    }

    // Return simplified content list for dashboard
    const contentList = filteredContent.map((contentState: ContentState) => ({
      id: contentState.contentId,
      contentId: contentState.contentId,
      title: contentState.title,
      author: contentState.author,
      status: contentState.workflowStatus,
      createdAt: contentState.createdAt,
      updatedAt: contentState.updatedAt
    }));

    // Sort by createdAt descending (newest first)
    contentList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    logger.info('Content list fetched', { count: contentList.length, filtered: !!userId });

    return {
      status: 200,
      body: contentList
    };

  } catch (error) {
    logger.error('Failed to list content', { error });
    return {
      status: 500,
      body: {
        error: 'Internal server error',
        message: 'Failed to fetch content list'
      }
    };
  }
};

