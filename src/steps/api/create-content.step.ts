/**
 * API Step: Create Content
 * 
 * Entry point for content submission workflow.
 * Accepts content input, generates unique ID, persists initial state,
 * and emits event to trigger validation workflow.
 */

import { ApiRouteConfig, Handlers } from 'motia';
import type { ContentInput, ContentState, WorkflowStatus } from '../../types/index.js';

export const config: ApiRouteConfig = {
  name: 'CreateContent',
  type: 'api',
  path: '/content',
  method: 'POST',
  emits: ['content.created'],
  flows: ['content-workflow']
};

export const handler: Handlers['CreateContent'] = async (req, { emit, state, logger, traceId }) => {
  try {
    // Validate request body
    const body = req.body as Partial<ContentInput>;
    
    if (!body.title || !body.body || !body.author || !body.language) {
      logger.warn('Missing required fields', { body });
      return {
        status: 400,
        body: {
          error: 'Missing required fields',
          required: ['title', 'body', 'author', 'language']
        }
      };
    }

    // Generate unique content ID using timestamp + random suffix
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    const contentId = `content_${timestamp}_${randomSuffix}`;

    const now = new Date().toISOString();
    const initialStatus: WorkflowStatus = 'pending';

    // Prepare initial content state
    const contentState: ContentState = {
      contentId,
      title: body.title,
      body: body.body,
      author: body.author,
      language: body.language,
      userId: body.userId, // Store userId for filtering
      createdAt: now,
      updatedAt: now,
      workflowStatus: initialStatus
    };

    // Persist initial content in Motia state (use 'content' as groupId, not traceId)
    await state.set('content', contentId, contentState);
    await state.set('workflow', contentId, { status: initialStatus, contentId });

    logger.info('Content created', { contentId, author: body.author });

    // Emit event to trigger validation workflow
    await emit({
      topic: 'content.created',
      data: {
        contentId,
        traceId
      }
    });

    // Return immediate response with contentId and status
    return {
      status: 201,
      body: {
        contentId,
        status: initialStatus,
        message: 'Content submitted successfully. Analysis in progress.'
      }
    };

  } catch (error) {
    logger.error('Failed to create content', { error });
    return {
      status: 500,
      body: {
        error: 'Internal server error',
        message: 'Failed to process content submission'
      }
    };
  }
};

