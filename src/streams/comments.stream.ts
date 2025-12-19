/**
 * Stream: Comments
 * 
 * Real-time stream for collaborative comments on content analysis.
 * Multiple users can comment on analysis and recommendations in real-time.
 */

import { StreamConfig } from 'motia';
import { z } from 'zod';

export const commentSchema = z.object({
  id: z.string(),
  contentId: z.string(),
  userId: z.string(),
  userName: z.string(),
  text: z.string(),
  type: z.enum(['analysis', 'recommendation', 'general']),
  targetId: z.string().optional(), // ID of specific analysis or recommendation
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Comment = z.infer<typeof commentSchema>;

export const config: StreamConfig = {
  name: 'comments',
  schema: commentSchema,
  baseConfig: { storageType: 'default' },
};

