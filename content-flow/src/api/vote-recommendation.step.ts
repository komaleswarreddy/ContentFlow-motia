/**
 * API Step: Vote on Recommendation
 * 
 * Allows users to vote (up/down) on recommendations.
 * Votes are aggregated and broadcasted in real-time.
 */

import { ApiRouteConfig, Handlers } from 'motia';
import type { ContentState } from '../types/index.js';

export const config: ApiRouteConfig = {
  name: 'VoteRecommendation',
  type: 'api',
  path: '/content/:id/recommendations/:recId/vote',
  method: 'POST',
  emits: ['vote.cast'],
  flows: ['content-workflow']
};

export const handler: Handlers['VoteRecommendation'] = async (req, { emit, state, streams, logger, traceId }) => {
  try {
    const contentId = req.pathParams?.id as string;
    const recommendationId = req.pathParams?.recId as string;
    const body = req.body as {
      userId: string;
      vote: 'up' | 'down';
    };

    if (!contentId || !recommendationId) {
      return {
        status: 400,
        body: {
          error: 'Content ID and Recommendation ID are required'
        }
      };
    }

    if (!body.userId || !body.vote || !['up', 'down'].includes(body.vote)) {
      return {
        status: 400,
        body: {
          error: 'Missing required fields',
          required: ['userId', 'vote (up or down)']
        }
      };
    }

    // Get content to verify recommendation exists
    const contentState = await state.get('content', contentId) as ContentState | null;
    if (!contentState) {
      return {
        status: 404,
        body: {
          error: 'Content not found'
        }
      };
    }

    // Find the recommendation
    const recommendation = contentState.recommendations?.find(rec => rec.id === recommendationId);
    if (!recommendation) {
      return {
        status: 404,
        body: {
          error: 'Recommendation not found'
        }
      };
    }

    // Get or initialize votes for this recommendation
    const voteKey = `votes_${contentId}_${recommendationId}`;
    const existingVotes = await state.get('votes', voteKey) as Record<string, 'up' | 'down'> | null;
    const votes = existingVotes || {};

    // Update user's vote (allows changing vote)
    votes[body.userId] = body.vote;

    // Save votes
    await state.set('votes', voteKey, votes);

    // Calculate vote counts
    const upvotes = Object.values(votes).filter(v => v === 'up').length;
    const downvotes = Object.values(votes).filter(v => v === 'down').length;

    // Update recommendation with vote counts
    if (!recommendation.votes) {
      recommendation.votes = {
        upvotes: 0,
        downvotes: 0,
        userVotes: {}
      };
    }
    recommendation.votes.upvotes = upvotes;
    recommendation.votes.downvotes = downvotes;
    recommendation.votes.userVotes = votes;

    // Update content state
    await state.set('content', contentId, contentState);

    logger.info('Vote cast', { contentId, recommendationId, userId: body.userId, vote: body.vote });

    // Send real-time update via content updates stream
    await streams.contentUpdates.send(
      { groupId: contentId },
      {
        type: 'vote_updated',
        data: {
          recommendationId,
          upvotes,
          downvotes,
          userVote: body.vote
        }
      }
    );

    // Emit event
    await emit({
      topic: 'vote.cast',
      data: {
        contentId,
        recommendationId,
        userId: body.userId,
        vote: body.vote
      }
    });

    return {
      status: 200,
      body: {
        recommendationId,
        upvotes,
        downvotes,
        userVote: body.vote,
        message: 'Vote recorded successfully'
      }
    };

  } catch (error) {
    logger.error('Failed to vote on recommendation', { error });
    return {
      status: 500,
      body: {
        error: 'Internal server error',
        message: 'Failed to record vote'
      }
    };
  }
};

