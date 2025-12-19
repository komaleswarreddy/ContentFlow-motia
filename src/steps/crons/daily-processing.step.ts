/**
 * Cron Step: Daily Processing
 * 
 * Runs once per day to perform maintenance tasks:
 * - Clean up stale content data
 * - Aggregate basic metrics
 * - Log results for observability
 */

import { CronConfig, Handlers } from 'motia';

export const config: CronConfig = {
  name: 'DailyProcessing',
  type: 'cron',
  cron: '0 2 * * *', // Run daily at 2:00 AM UTC
  emits: [],
  flows: ['content-workflow']
};

import type { ContentState } from '../../types/index.js';

export const handler: Handlers['DailyProcessing'] = async (input, { state, logger }) => {
  try {
    logger.info('Starting daily processing job');

    const now = Date.now();
    const STALE_AGE_DAYS = 90; // Content older than 90 days is considered stale
    const staleThreshold = now - (STALE_AGE_DAYS * 24 * 60 * 60 * 1000);

    // Get all content from state
    const allContent = await state.getGroup('content') as ContentState[] | null;

    let staleContentCount = 0;
    let totalContentProcessed = 0;
    let deletedContentIds: string[] = [];
    const processingTimes: number[] = [];

    if (allContent && allContent.length > 0) {
      totalContentProcessed = allContent.length;

      // Process each content item
      for (const content of allContent) {
        try {
          const createdAt = new Date(content.createdAt).getTime();
          const updatedAt = new Date(content.updatedAt).getTime();
          
          // Calculate processing time (time from creation to completion or last update)
          if (content.workflowStatus === 'completed') {
            const processingTime = updatedAt - createdAt;
            processingTimes.push(processingTime);
          }

          // Check if content is stale (older than threshold)
          if (createdAt < staleThreshold) {
            // Only delete if content is in a final state (completed, failed, rejected)
            // Keep pending/processing content even if old
            if (['completed', 'failed', 'rejected'].includes(content.workflowStatus)) {
              staleContentCount++;
              
              // Delete stale content
              await state.delete('content', content.contentId);
              await state.delete('workflow', content.contentId);
              
              deletedContentIds.push(content.contentId);
              logger.info('Deleted stale content', { 
                contentId: content.contentId, 
                age: Math.round((now - createdAt) / (24 * 60 * 60 * 1000)) + ' days',
                status: content.workflowStatus 
              });
            }
          }
        } catch (error) {
          logger.warn('Error processing content item', { 
            contentId: content.contentId, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }
    }

    // Calculate average processing time
    const averageProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
      : 0;

    // Aggregate metrics
    const metrics = {
      processedAt: new Date().toISOString(),
      staleContentCount,
      totalContentProcessed,
      deletedContentCount: deletedContentIds.length,
      averageProcessingTime: Math.round(averageProcessingTime), // in milliseconds
      activeContentCount: totalContentProcessed - deletedContentIds.length
    };

    logger.info('Daily processing completed', { metrics });

    // Persist metrics for observability
    await state.set('system', 'daily_metrics', metrics);

    // Store last run timestamp
    await state.set('system', 'daily_processing_last_run', {
      timestamp: new Date().toISOString(),
      deletedContentIds: deletedContentIds.slice(0, 100) // Store first 100 IDs for reference
    });

    return {
      success: true,
      metrics
    };

  } catch (error) {
    logger.error('Daily processing job failed', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

