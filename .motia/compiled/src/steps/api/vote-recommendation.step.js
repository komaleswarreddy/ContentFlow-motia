const config = {
  name: "VoteRecommendation",
  type: "api",
  path: "/content/:id/recommendations/:recId/vote",
  method: "POST",
  emits: ["vote.cast"],
  flows: ["content-workflow"]
};
const handler = async (req, { emit, state, streams, logger, traceId }) => {
  try {
    const contentId = req.pathParams?.id;
    const recommendationId = req.pathParams?.recId;
    const body = req.body;
    if (!contentId || !recommendationId) {
      return {
        status: 400,
        body: {
          error: "Content ID and Recommendation ID are required"
        }
      };
    }
    if (!body.userId || !body.vote || !["up", "down"].includes(body.vote)) {
      return {
        status: 400,
        body: {
          error: "Missing required fields",
          required: ["userId", "vote (up or down)"]
        }
      };
    }
    const contentState = await state.get("content", contentId);
    if (!contentState) {
      return {
        status: 404,
        body: {
          error: "Content not found"
        }
      };
    }
    const recommendation = contentState.recommendations?.find((rec) => rec.id === recommendationId);
    if (!recommendation) {
      return {
        status: 404,
        body: {
          error: "Recommendation not found"
        }
      };
    }
    const voteKey = `votes_${contentId}_${recommendationId}`;
    const existingVotes = await state.get("votes", voteKey);
    const votes = existingVotes || {};
    votes[body.userId] = body.vote;
    await state.set("votes", voteKey, votes);
    const upvotes = Object.values(votes).filter((v) => v === "up").length;
    const downvotes = Object.values(votes).filter((v) => v === "down").length;
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
    await state.set("content", contentId, contentState);
    logger.info("Vote cast", { contentId, recommendationId, userId: body.userId, vote: body.vote });
    await streams.contentUpdates.send(
      { groupId: contentId },
      {
        type: "vote_updated",
        data: {
          recommendationId,
          upvotes,
          downvotes,
          userVote: body.vote
        }
      }
    );
    await emit({
      topic: "vote.cast",
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
        message: "Vote recorded successfully"
      }
    };
  } catch (error) {
    logger.error("Failed to vote on recommendation", { error });
    return {
      status: 500,
      body: {
        error: "Internal server error",
        message: "Failed to record vote"
      }
    };
  }
};
export {
  config,
  handler
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vLi4vc3JjL3N0ZXBzL2FwaS92b3RlLXJlY29tbWVuZGF0aW9uLnN0ZXAudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qKlxyXG4gKiBBUEkgU3RlcDogVm90ZSBvbiBSZWNvbW1lbmRhdGlvblxyXG4gKiBcclxuICogQWxsb3dzIHVzZXJzIHRvIHZvdGUgKHVwL2Rvd24pIG9uIHJlY29tbWVuZGF0aW9ucy5cclxuICogVm90ZXMgYXJlIGFnZ3JlZ2F0ZWQgYW5kIGJyb2FkY2FzdGVkIGluIHJlYWwtdGltZS5cclxuICovXHJcblxyXG5pbXBvcnQgeyBBcGlSb3V0ZUNvbmZpZywgSGFuZGxlcnMgfSBmcm9tICdtb3RpYSc7XHJcbmltcG9ydCB0eXBlIHsgQ29udGVudFN0YXRlIH0gZnJvbSAnLi4vLi4vdHlwZXMvaW5kZXguanMnO1xyXG5cclxuZXhwb3J0IGNvbnN0IGNvbmZpZzogQXBpUm91dGVDb25maWcgPSB7XHJcbiAgbmFtZTogJ1ZvdGVSZWNvbW1lbmRhdGlvbicsXHJcbiAgdHlwZTogJ2FwaScsXHJcbiAgcGF0aDogJy9jb250ZW50LzppZC9yZWNvbW1lbmRhdGlvbnMvOnJlY0lkL3ZvdGUnLFxyXG4gIG1ldGhvZDogJ1BPU1QnLFxyXG4gIGVtaXRzOiBbJ3ZvdGUuY2FzdCddLFxyXG4gIGZsb3dzOiBbJ2NvbnRlbnQtd29ya2Zsb3cnXVxyXG59O1xyXG5cclxuZXhwb3J0IGNvbnN0IGhhbmRsZXI6IEhhbmRsZXJzWydWb3RlUmVjb21tZW5kYXRpb24nXSA9IGFzeW5jIChyZXEsIHsgZW1pdCwgc3RhdGUsIHN0cmVhbXMsIGxvZ2dlciwgdHJhY2VJZCB9KSA9PiB7XHJcbiAgdHJ5IHtcclxuICAgIGNvbnN0IGNvbnRlbnRJZCA9IHJlcS5wYXRoUGFyYW1zPy5pZCBhcyBzdHJpbmc7XHJcbiAgICBjb25zdCByZWNvbW1lbmRhdGlvbklkID0gcmVxLnBhdGhQYXJhbXM/LnJlY0lkIGFzIHN0cmluZztcclxuICAgIGNvbnN0IGJvZHkgPSByZXEuYm9keSBhcyB7XHJcbiAgICAgIHVzZXJJZDogc3RyaW5nO1xyXG4gICAgICB2b3RlOiAndXAnIHwgJ2Rvd24nO1xyXG4gICAgfTtcclxuXHJcbiAgICBpZiAoIWNvbnRlbnRJZCB8fCAhcmVjb21tZW5kYXRpb25JZCkge1xyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIHN0YXR1czogNDAwLFxyXG4gICAgICAgIGJvZHk6IHtcclxuICAgICAgICAgIGVycm9yOiAnQ29udGVudCBJRCBhbmQgUmVjb21tZW5kYXRpb24gSUQgYXJlIHJlcXVpcmVkJ1xyXG4gICAgICAgIH1cclxuICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoIWJvZHkudXNlcklkIHx8ICFib2R5LnZvdGUgfHwgIVsndXAnLCAnZG93biddLmluY2x1ZGVzKGJvZHkudm90ZSkpIHtcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICBzdGF0dXM6IDQwMCxcclxuICAgICAgICBib2R5OiB7XHJcbiAgICAgICAgICBlcnJvcjogJ01pc3NpbmcgcmVxdWlyZWQgZmllbGRzJyxcclxuICAgICAgICAgIHJlcXVpcmVkOiBbJ3VzZXJJZCcsICd2b3RlICh1cCBvciBkb3duKSddXHJcbiAgICAgICAgfVxyXG4gICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEdldCBjb250ZW50IHRvIHZlcmlmeSByZWNvbW1lbmRhdGlvbiBleGlzdHNcclxuICAgIGNvbnN0IGNvbnRlbnRTdGF0ZSA9IGF3YWl0IHN0YXRlLmdldCgnY29udGVudCcsIGNvbnRlbnRJZCkgYXMgQ29udGVudFN0YXRlIHwgbnVsbDtcclxuICAgIGlmICghY29udGVudFN0YXRlKSB7XHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgc3RhdHVzOiA0MDQsXHJcbiAgICAgICAgYm9keToge1xyXG4gICAgICAgICAgZXJyb3I6ICdDb250ZW50IG5vdCBmb3VuZCdcclxuICAgICAgICB9XHJcbiAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgLy8gRmluZCB0aGUgcmVjb21tZW5kYXRpb25cclxuICAgIGNvbnN0IHJlY29tbWVuZGF0aW9uID0gY29udGVudFN0YXRlLnJlY29tbWVuZGF0aW9ucz8uZmluZChyZWMgPT4gcmVjLmlkID09PSByZWNvbW1lbmRhdGlvbklkKTtcclxuICAgIGlmICghcmVjb21tZW5kYXRpb24pIHtcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICBzdGF0dXM6IDQwNCxcclxuICAgICAgICBib2R5OiB7XHJcbiAgICAgICAgICBlcnJvcjogJ1JlY29tbWVuZGF0aW9uIG5vdCBmb3VuZCdcclxuICAgICAgICB9XHJcbiAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgLy8gR2V0IG9yIGluaXRpYWxpemUgdm90ZXMgZm9yIHRoaXMgcmVjb21tZW5kYXRpb25cclxuICAgIGNvbnN0IHZvdGVLZXkgPSBgdm90ZXNfJHtjb250ZW50SWR9XyR7cmVjb21tZW5kYXRpb25JZH1gO1xyXG4gICAgY29uc3QgZXhpc3RpbmdWb3RlcyA9IGF3YWl0IHN0YXRlLmdldCgndm90ZXMnLCB2b3RlS2V5KSBhcyBSZWNvcmQ8c3RyaW5nLCAndXAnIHwgJ2Rvd24nPiB8IG51bGw7XHJcbiAgICBjb25zdCB2b3RlcyA9IGV4aXN0aW5nVm90ZXMgfHwge307XHJcblxyXG4gICAgLy8gVXBkYXRlIHVzZXIncyB2b3RlIChhbGxvd3MgY2hhbmdpbmcgdm90ZSlcclxuICAgIHZvdGVzW2JvZHkudXNlcklkXSA9IGJvZHkudm90ZTtcclxuXHJcbiAgICAvLyBTYXZlIHZvdGVzXHJcbiAgICBhd2FpdCBzdGF0ZS5zZXQoJ3ZvdGVzJywgdm90ZUtleSwgdm90ZXMpO1xyXG5cclxuICAgIC8vIENhbGN1bGF0ZSB2b3RlIGNvdW50c1xyXG4gICAgY29uc3QgdXB2b3RlcyA9IE9iamVjdC52YWx1ZXModm90ZXMpLmZpbHRlcih2ID0+IHYgPT09ICd1cCcpLmxlbmd0aDtcclxuICAgIGNvbnN0IGRvd252b3RlcyA9IE9iamVjdC52YWx1ZXModm90ZXMpLmZpbHRlcih2ID0+IHYgPT09ICdkb3duJykubGVuZ3RoO1xyXG5cclxuICAgIC8vIFVwZGF0ZSByZWNvbW1lbmRhdGlvbiB3aXRoIHZvdGUgY291bnRzXHJcbiAgICBpZiAoIXJlY29tbWVuZGF0aW9uLnZvdGVzKSB7XHJcbiAgICAgIHJlY29tbWVuZGF0aW9uLnZvdGVzID0ge1xyXG4gICAgICAgIHVwdm90ZXM6IDAsXHJcbiAgICAgICAgZG93bnZvdGVzOiAwLFxyXG4gICAgICAgIHVzZXJWb3Rlczoge31cclxuICAgICAgfTtcclxuICAgIH1cclxuICAgIHJlY29tbWVuZGF0aW9uLnZvdGVzLnVwdm90ZXMgPSB1cHZvdGVzO1xyXG4gICAgcmVjb21tZW5kYXRpb24udm90ZXMuZG93bnZvdGVzID0gZG93bnZvdGVzO1xyXG4gICAgcmVjb21tZW5kYXRpb24udm90ZXMudXNlclZvdGVzID0gdm90ZXM7XHJcblxyXG4gICAgLy8gVXBkYXRlIGNvbnRlbnQgc3RhdGVcclxuICAgIGF3YWl0IHN0YXRlLnNldCgnY29udGVudCcsIGNvbnRlbnRJZCwgY29udGVudFN0YXRlKTtcclxuXHJcbiAgICBsb2dnZXIuaW5mbygnVm90ZSBjYXN0JywgeyBjb250ZW50SWQsIHJlY29tbWVuZGF0aW9uSWQsIHVzZXJJZDogYm9keS51c2VySWQsIHZvdGU6IGJvZHkudm90ZSB9KTtcclxuXHJcbiAgICAvLyBTZW5kIHJlYWwtdGltZSB1cGRhdGUgdmlhIGNvbnRlbnQgdXBkYXRlcyBzdHJlYW1cclxuICAgIGF3YWl0IHN0cmVhbXMuY29udGVudFVwZGF0ZXMuc2VuZChcclxuICAgICAgeyBncm91cElkOiBjb250ZW50SWQgfSxcclxuICAgICAge1xyXG4gICAgICAgIHR5cGU6ICd2b3RlX3VwZGF0ZWQnLFxyXG4gICAgICAgIGRhdGE6IHtcclxuICAgICAgICAgIHJlY29tbWVuZGF0aW9uSWQsXHJcbiAgICAgICAgICB1cHZvdGVzLFxyXG4gICAgICAgICAgZG93bnZvdGVzLFxyXG4gICAgICAgICAgdXNlclZvdGU6IGJvZHkudm90ZVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgKTtcclxuXHJcbiAgICAvLyBFbWl0IGV2ZW50XHJcbiAgICBhd2FpdCBlbWl0KHtcclxuICAgICAgdG9waWM6ICd2b3RlLmNhc3QnLFxyXG4gICAgICBkYXRhOiB7XHJcbiAgICAgICAgY29udGVudElkLFxyXG4gICAgICAgIHJlY29tbWVuZGF0aW9uSWQsXHJcbiAgICAgICAgdXNlcklkOiBib2R5LnVzZXJJZCxcclxuICAgICAgICB2b3RlOiBib2R5LnZvdGVcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgc3RhdHVzOiAyMDAsXHJcbiAgICAgIGJvZHk6IHtcclxuICAgICAgICByZWNvbW1lbmRhdGlvbklkLFxyXG4gICAgICAgIHVwdm90ZXMsXHJcbiAgICAgICAgZG93bnZvdGVzLFxyXG4gICAgICAgIHVzZXJWb3RlOiBib2R5LnZvdGUsXHJcbiAgICAgICAgbWVzc2FnZTogJ1ZvdGUgcmVjb3JkZWQgc3VjY2Vzc2Z1bGx5J1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG5cclxuICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgbG9nZ2VyLmVycm9yKCdGYWlsZWQgdG8gdm90ZSBvbiByZWNvbW1lbmRhdGlvbicsIHsgZXJyb3IgfSk7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBzdGF0dXM6IDUwMCxcclxuICAgICAgYm9keToge1xyXG4gICAgICAgIGVycm9yOiAnSW50ZXJuYWwgc2VydmVyIGVycm9yJyxcclxuICAgICAgICBtZXNzYWdlOiAnRmFpbGVkIHRvIHJlY29yZCB2b3RlJ1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG4gIH1cclxufTtcclxuXHJcbiJdLAogICJtYXBwaW5ncyI6ICJBQVVPLE1BQU0sU0FBeUI7QUFBQSxFQUNwQyxNQUFNO0FBQUEsRUFDTixNQUFNO0FBQUEsRUFDTixNQUFNO0FBQUEsRUFDTixRQUFRO0FBQUEsRUFDUixPQUFP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
