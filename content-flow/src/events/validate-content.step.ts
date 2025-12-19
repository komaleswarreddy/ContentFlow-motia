/**
 * Event Step: Validate Content
 * 
 * Subscribes to content.created event, validates content quality,
 * checks minimum length and supported languages, and either
 * rejects or proceeds to AI analysis.
 */

import { EventConfig, Handlers } from 'motia';
import type { ContentState, ValidationResult, WorkflowStatus } from '../types/index.js';

export const config: EventConfig = {
  name: 'ValidateContent',
  type: 'event',
  subscribes: ['content.created'],
  emits: ['content.validated', 'content.rejected'],
  flows: ['content-workflow']
};

export const handler: Handlers['ValidateContent'] = async (input, { emit, state, streams, logger, traceId }) => {
  try {
    // Event data is passed directly on input, not input.data
    const { contentId } = input as { contentId: string; traceId: string };

    logger.info('Starting content validation', { contentId });

    // Read content from state (use 'content' as groupId, not traceId)
    const contentState = await state.get('content', contentId) as ContentState | null;

    if (!contentState) {
      logger.error('Content not found for validation', { contentId });
      return;
    }

    // Validation rules
    const errors: string[] = [];
    const warnings: string[] = [];
    const MIN_BODY_LENGTH = 100; // Minimum characters required
    const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de', 'it', 'pt']; // Supported language codes

    // Check minimum body length
    if (contentState.body.length < MIN_BODY_LENGTH) {
      errors.push(`Content body must be at least ${MIN_BODY_LENGTH} characters. Current: ${contentState.body.length}`);
    }

    // Check supported language
    if (!SUPPORTED_LANGUAGES.includes(contentState.language.toLowerCase())) {
      errors.push(`Language '${contentState.language}' is not supported. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`);
    }

    // Check title length
    if (contentState.title.length < 10) {
      warnings.push('Title is quite short. Consider a more descriptive title.');
    }

    // Check body length for quality (warning, not error)
    if (contentState.body.length < 500) {
      warnings.push('Content body is relatively short. Consider adding more detail.');
    }

    const validationResult: ValidationResult = {
      isValid: errors.length === 0,
      errors,
      warnings,
      validatedAt: new Date().toISOString()
    };

    // Update content state with validation result
    contentState.validationResult = validationResult;
    contentState.updatedAt = new Date().toISOString();

    // Persist validation result in state (use groupId, not traceId)
    await state.set('content', contentId, contentState);
    await state.set('validation', contentId, validationResult);

    if (!validationResult.isValid) {
      // Update workflow status to rejected
      const rejectedStatus: WorkflowStatus = 'rejected';
      contentState.workflowStatus = rejectedStatus;
      await state.set('content', contentId, contentState);
      await state.set('workflow', contentId, { status: rejectedStatus, contentId });

      logger.warn('Content validation failed', { contentId, errors });

      // Emit rejection event (no further processing)
      await emit({
        topic: 'content.rejected',
        data: {
          contentId,
          validationResult,
          traceId
        }
      });

      return;
    }

    // Content is valid - update status and emit validated event
    const validatedStatus: WorkflowStatus = 'validated';
    contentState.workflowStatus = validatedStatus;
    await state.set('content', contentId, contentState);
    await state.set('workflow', contentId, { status: validatedStatus, contentId });

    logger.info('Content validation passed', { contentId, warnings: warnings.length });

    // Send real-time update via stream
    await streams.contentUpdates.send(
      { groupId: contentId },
      {
        type: 'validation_completed',
        data: {
          contentId,
          status: 'validated',
          validation: validationResult,
          timestamp: new Date().toISOString()
        }
      }
    );

    // Emit validated event to trigger AI analysis
    await emit({
      topic: 'content.validated',
      data: {
        contentId,
        validationResult,
        traceId
      }
    });

  } catch (error) {
    logger.error('Content validation error', { error, input });
  }
};

