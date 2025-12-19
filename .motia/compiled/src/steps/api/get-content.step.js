const config = {
  name: "GetContent",
  type: "api",
  path: "/content/:id",
  method: "GET",
  emits: [],
  flows: ["content-workflow"]
};
const handler = async (req, { state, logger, traceId }) => {
  try {
    const contentId = req.pathParams?.id;
    if (!contentId) {
      return {
        status: 400,
        body: {
          error: "Content ID is required"
        }
      };
    }
    logger.info("Fetching content", { contentId });
    const contentState = await state.get("content", contentId);
    if (!contentState) {
      logger.warn("Content not found", { contentId });
      return {
        status: 404,
        body: {
          error: "Content not found",
          contentId
        }
      };
    }
    return {
      status: 200,
      body: {
        contentId: contentState.contentId,
        title: contentState.title,
        body: contentState.body,
        author: contentState.author,
        language: contentState.language,
        createdAt: contentState.createdAt,
        updatedAt: contentState.updatedAt,
        status: contentState.workflowStatus,
        validation: contentState.validationResult || null,
        analysis: contentState.aiAnalysis || null,
        recommendations: contentState.recommendations || [],
        improvedContent: contentState.improvedContent || null
      }
    };
  } catch (error) {
    logger.error("Failed to fetch content", { error });
    return {
      status: 500,
      body: {
        error: "Internal server error",
        message: "Failed to fetch content data"
      }
    };
  }
};
export {
  config,
  handler
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vLi4vc3JjL3N0ZXBzL2FwaS9nZXQtY29udGVudC5zdGVwLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKipcclxuICogQVBJIFN0ZXA6IEdldCBDb250ZW50XHJcbiAqIFxyXG4gKiBGZXRjaGVzIHdvcmtmbG93IHN0YXR1cywgQUkgYW5hbHlzaXMsIGFuZCByZWNvbW1lbmRhdGlvbnNcclxuICogZm9yIGEgZ2l2ZW4gY29udGVudElkLiBSZXR1cm5zIHN0cnVjdHVyZWQgSlNPTiByZXNwb25zZS5cclxuICovXHJcblxyXG5pbXBvcnQgeyBBcGlSb3V0ZUNvbmZpZywgSGFuZGxlcnMgfSBmcm9tICdtb3RpYSc7XHJcbmltcG9ydCB0eXBlIHsgQ29udGVudFN0YXRlIH0gZnJvbSAnLi4vLi4vdHlwZXMvaW5kZXguanMnO1xyXG5cclxuZXhwb3J0IGNvbnN0IGNvbmZpZzogQXBpUm91dGVDb25maWcgPSB7XHJcbiAgbmFtZTogJ0dldENvbnRlbnQnLFxyXG4gIHR5cGU6ICdhcGknLFxyXG4gIHBhdGg6ICcvY29udGVudC86aWQnLFxyXG4gIG1ldGhvZDogJ0dFVCcsXHJcbiAgZW1pdHM6IFtdLFxyXG4gIGZsb3dzOiBbJ2NvbnRlbnQtd29ya2Zsb3cnXVxyXG59O1xyXG5cclxuZXhwb3J0IGNvbnN0IGhhbmRsZXI6IEhhbmRsZXJzWydHZXRDb250ZW50J10gPSBhc3luYyAocmVxLCB7IHN0YXRlLCBsb2dnZXIsIHRyYWNlSWQgfSkgPT4ge1xyXG4gIHRyeSB7XHJcbiAgICBjb25zdCBjb250ZW50SWQgPSByZXEucGF0aFBhcmFtcz8uaWQgYXMgc3RyaW5nO1xyXG5cclxuICAgIGlmICghY29udGVudElkKSB7XHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgc3RhdHVzOiA0MDAsXHJcbiAgICAgICAgYm9keToge1xyXG4gICAgICAgICAgZXJyb3I6ICdDb250ZW50IElEIGlzIHJlcXVpcmVkJ1xyXG4gICAgICAgIH1cclxuICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICBsb2dnZXIuaW5mbygnRmV0Y2hpbmcgY29udGVudCcsIHsgY29udGVudElkIH0pO1xyXG5cclxuICAgIC8vIEZldGNoIGNvbnRlbnQgc3RhdGUgZnJvbSBNb3RpYSBzdGF0ZSAodXNlICdjb250ZW50JyBhcyBncm91cElkLCBub3QgdHJhY2VJZClcclxuICAgIGNvbnN0IGNvbnRlbnRTdGF0ZSA9IGF3YWl0IHN0YXRlLmdldCgnY29udGVudCcsIGNvbnRlbnRJZCkgYXMgQ29udGVudFN0YXRlIHwgbnVsbDtcclxuXHJcbiAgICBpZiAoIWNvbnRlbnRTdGF0ZSkge1xyXG4gICAgICBsb2dnZXIud2FybignQ29udGVudCBub3QgZm91bmQnLCB7IGNvbnRlbnRJZCB9KTtcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICBzdGF0dXM6IDQwNCxcclxuICAgICAgICBib2R5OiB7XHJcbiAgICAgICAgICBlcnJvcjogJ0NvbnRlbnQgbm90IGZvdW5kJyxcclxuICAgICAgICAgIGNvbnRlbnRJZFxyXG4gICAgICAgIH1cclxuICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBSZXR1cm4gc3RydWN0dXJlZCBKU09OIHJlc3BvbnNlIHdpdGggYWxsIHdvcmtmbG93IGRhdGFcclxuICAgIHJldHVybiB7XHJcbiAgICAgIHN0YXR1czogMjAwLFxyXG4gICAgICBib2R5OiB7XHJcbiAgICAgICAgY29udGVudElkOiBjb250ZW50U3RhdGUuY29udGVudElkLFxyXG4gICAgICAgIHRpdGxlOiBjb250ZW50U3RhdGUudGl0bGUsXHJcbiAgICAgICAgYm9keTogY29udGVudFN0YXRlLmJvZHksXHJcbiAgICAgICAgYXV0aG9yOiBjb250ZW50U3RhdGUuYXV0aG9yLFxyXG4gICAgICAgIGxhbmd1YWdlOiBjb250ZW50U3RhdGUubGFuZ3VhZ2UsXHJcbiAgICAgICAgY3JlYXRlZEF0OiBjb250ZW50U3RhdGUuY3JlYXRlZEF0LFxyXG4gICAgICAgIHVwZGF0ZWRBdDogY29udGVudFN0YXRlLnVwZGF0ZWRBdCxcclxuICAgICAgICBzdGF0dXM6IGNvbnRlbnRTdGF0ZS53b3JrZmxvd1N0YXR1cyxcclxuICAgICAgICB2YWxpZGF0aW9uOiBjb250ZW50U3RhdGUudmFsaWRhdGlvblJlc3VsdCB8fCBudWxsLFxyXG4gICAgICAgIGFuYWx5c2lzOiBjb250ZW50U3RhdGUuYWlBbmFseXNpcyB8fCBudWxsLFxyXG4gICAgICAgIHJlY29tbWVuZGF0aW9uczogY29udGVudFN0YXRlLnJlY29tbWVuZGF0aW9ucyB8fCBbXSxcclxuICAgICAgICBpbXByb3ZlZENvbnRlbnQ6IGNvbnRlbnRTdGF0ZS5pbXByb3ZlZENvbnRlbnQgfHwgbnVsbFxyXG4gICAgICB9XHJcbiAgICB9O1xyXG5cclxuICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgbG9nZ2VyLmVycm9yKCdGYWlsZWQgdG8gZmV0Y2ggY29udGVudCcsIHsgZXJyb3IgfSk7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBzdGF0dXM6IDUwMCxcclxuICAgICAgYm9keToge1xyXG4gICAgICAgIGVycm9yOiAnSW50ZXJuYWwgc2VydmVyIGVycm9yJyxcclxuICAgICAgICBtZXNzYWdlOiAnRmFpbGVkIHRvIGZldGNoIGNvbnRlbnQgZGF0YSdcclxuICAgICAgfVxyXG4gICAgfTtcclxuICB9XHJcbn07XHJcblxyXG4iXSwKICAibWFwcGluZ3MiOiAiQUFVTyxNQUFNLFNBQXlCO0FBQUEsRUFDcEMsTUFBTTtBQUFBLEVBQ04sTUFBTTtBQUFBLEVBQ04sTUFBTTtBQUFBLEVBQ04sUUFBUTtBQUFBLEVBQ1IsT0FBTyxDQUFDO0FBQUEsRUFDUixPQUFPLENBQUMsa0JBQWtCO0FBQzVCO0FBRU8sTUFBTSxVQUFrQyxPQUFPLEtBQUssRUFBRSxPQUFPLFFBQVEsUUFBUSxNQUFNO0FBQ3hGLE1BQUk7QUFDRixVQUFNLFlBQVksSUFBSSxZQUFZO0FBRWxDLFFBQUksQ0FBQyxXQUFXO0FBQ2QsYUFBTztBQUFBLFFBQ0wsUUFBUTtBQUFBLFFBQ1IsTUFBTTtBQUFBLFVBQ0osT0FBTztBQUFBLFFBQ1Q7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUVBLFdBQU8sS0FBSyxvQkFBb0IsRUFBRSxVQUFVLENBQUM7QUFHN0MsVUFBTSxlQUFlLE1BQU0sTUFBTSxJQUFJLFdBQVcsU0FBUztBQUV6RCxRQUFJLENBQUMsY0FBYztBQUNqQixhQUFPLEtBQUsscUJBQXFCLEVBQUUsVUFBVSxDQUFDO0FBQzlDLGFBQU87QUFBQSxRQUNMLFFBQVE7QUFBQSxRQUNSLE1BQU07QUFBQSxVQUNKLE9BQU87QUFBQSxVQUNQO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBR0EsV0FBTztBQUFBLE1BQ0wsUUFBUTtBQUFBLE1BQ1IsTUFBTTtBQUFBLFFBQ0osV0FBVyxhQUFhO0FBQUEsUUFDeEIsT0FBTyxhQUFhO0FBQUEsUUFDcEIsTUFBTSxhQUFhO0FBQUEsUUFDbkIsUUFBUSxhQUFhO0FBQUEsUUFDckIsVUFBVSxhQUFhO0FBQUEsUUFDdkIsV0FBVyxhQUFhO0FBQUEsUUFDeEIsV0FBVyxhQUFhO0FBQUEsUUFDeEIsUUFBUSxhQUFhO0FBQUEsUUFDckIsWUFBWSxhQUFhLG9CQUFvQjtBQUFBLFFBQzdDLFVBQVUsYUFBYSxjQUFjO0FBQUEsUUFDckMsaUJBQWlCLGFBQWEsbUJBQW1CLENBQUM7QUFBQSxRQUNsRCxpQkFBaUIsYUFBYSxtQkFBbUI7QUFBQSxNQUNuRDtBQUFBLElBQ0Y7QUFBQSxFQUVGLFNBQVMsT0FBTztBQUNkLFdBQU8sTUFBTSwyQkFBMkIsRUFBRSxNQUFNLENBQUM7QUFDakQsV0FBTztBQUFBLE1BQ0wsUUFBUTtBQUFBLE1BQ1IsTUFBTTtBQUFBLFFBQ0osT0FBTztBQUFBLFFBQ1AsU0FBUztBQUFBLE1BQ1g7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGOyIsCiAgIm5hbWVzIjogW10KfQo=
