/**
 * API Step: Add Comment
 * 
 * Allows users to add comments on content analysis or recommendations.
 * Comments are stored and broadcasted to all viewers in real-time.
 */

import { ApiRouteConfig, Handlers } from 'motia';
import type { Comment } from '../../streams/comments.stream.js';

export const config: ApiRouteConfig = {
  name: 'AddComment',
  type: 'api',
  path: '/content/:id/comments',
  method: 'POST',
  emits: ['comment.added'],
  flows: ['content-workflow']
};

export const handler: Handlers['AddComment'] = async (req, { emit, streams, logger, traceId }) => {
  try {
    const contentId = req.pathParams?.id as string;
    const body = req.body as {
      userId: string;
      userName: string;
      text: string;
      type?: 'analysis' | 'recommendation' | 'general';
      targetId?: string;
    };

    if (!contentId) {
      return {
        status: 400,
        body: {
          error: 'Content ID is required'
        }
      };
    }

    if (!body.userId || !body.userName || !body.text) {
      return {
        status: 400,
        body: {
          error: 'Missing required fields',
          required: ['userId', 'userName', 'text']
        }
      };
    }

    // Generate unique comment ID
    const commentId = `comment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();

    // Create comment object
    const comment: Comment = {
      id: commentId,
      contentId,
      userId: body.userId,
      userName: body.userName,
      text: body.text,
      type: body.type || 'general',
      targetId: body.targetId,
      createdAt: now,
      updatedAt: now
    };

    // Store comment in stream (groupId = contentId, id = commentId)
    await streams.comments.set(contentId, commentId, comment);

    logger.info('Comment added', { contentId, commentId, userId: body.userId });

    // Send real-time update to all viewers
    await streams.comments.send(
      { groupId: contentId },
      {
        type: 'comment_added',
        data: comment
      }
    );

    // Emit event for potential future processing
    await emit({
      topic: 'comment.added',
      data: {
        contentId,
        commentId,
        userId: body.userId
      }
    });

    return {
      status: 201,
      body: comment
    };

  } catch (error) {
    logger.error('Failed to add comment', { error });
    return {
      status: 500,
      body: {
        error: 'Internal server error',
        message: 'Failed to add comment'
      }
    };
  }
};

