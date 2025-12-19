/**
 * Stream: Content Updates
 * 
 * Real-time stream for content workflow status updates.
 * Clients can subscribe to receive live updates when content status changes.
 */

import { StreamConfig } from 'motia';
import { z } from 'zod';

export const contentUpdateSchema = z.object({
  contentId: z.string(),
  status: z.string(),
  timestamp: z.string(),
  data: z.record(z.any()).optional(), // Optional additional data (analysis, recommendations, etc.)
});

export type ContentUpdate = z.infer<typeof contentUpdateSchema>;

export const config: StreamConfig = {
  name: 'contentUpdates',
  schema: contentUpdateSchema,
  baseConfig: { storageType: 'default' },
};

