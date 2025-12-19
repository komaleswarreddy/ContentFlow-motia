const config = {
  name: "ApplyImprovedContent",
  type: "api",
  path: "/content/:id/apply-improvement",
  method: "POST",
  emits: [],
  flows: ["content-workflow"]
};
const handler = async (req, { state, logger }) => {
  try {
    const contentId = req.pathParams?.id;
    if (!contentId) {
      return {
        status: 400,
        body: { error: "Content ID is required" }
      };
    }
    logger.info("Apply improved content requested", { contentId });
    const contentState = await state.get("content", contentId);
    if (!contentState) {
      return {
        status: 404,
        body: { error: "Content not found", contentId }
      };
    }
    if (!contentState.improvedContent || contentState.improvedContent.status !== "completed") {
      return {
        status: 400,
        body: { error: "No completed improved content available", contentId }
      };
    }
    if (!contentState.improvedContent.improvedBody) {
      return {
        status: 400,
        body: { error: "Improved content body is empty", contentId }
      };
    }
    const originalBody = contentState.body;
    contentState.body = contentState.improvedContent.improvedBody;
    contentState.improvedContent.appliedAt = (/* @__PURE__ */ new Date()).toISOString();
    contentState.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await state.set("content", contentId, contentState);
    logger.info("Improved content applied successfully", { contentId });
    return {
      status: 200,
      body: {
        contentId,
        message: "Improved content applied successfully",
        originalBodyLength: originalBody.length,
        newBodyLength: contentState.body.length,
        appliedAt: contentState.improvedContent.appliedAt,
        status: contentState.workflowStatus
      }
    };
  } catch (error) {
    logger.error("Failed to apply improved content", { error });
    return {
      status: 500,
      body: { error: "Internal server error" }
    };
  }
};
export {
  config,
  handler
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vLi4vc3JjL3N0ZXBzL2FwaS9hcHBseS1pbXByb3ZlZC1jb250ZW50LnN0ZXAudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qKlxuICogQVBJIFN0ZXA6IEFwcGx5IEltcHJvdmVkIENvbnRlbnRcbiAqIFxuICogQWNjZXB0cyBhIGNvbnRlbnRJZCBhbmQgYXBwbGllcyB0aGUgaW1wcm92ZWQgY29udGVudCB0byByZXBsYWNlXG4gKiB0aGUgb3JpZ2luYWwgYm9keS4gU2ltcGx5IHVwZGF0ZXMgdGhlIGNvbnRlbnQgLSBubyByZS1hbmFseXNpcy5cbiAqL1xuXG5pbXBvcnQgeyBBcGlSb3V0ZUNvbmZpZywgSGFuZGxlcnMgfSBmcm9tICdtb3RpYSc7XG5pbXBvcnQgdHlwZSB7IENvbnRlbnRTdGF0ZSB9IGZyb20gJy4uLy4uL3R5cGVzL2luZGV4LmpzJztcblxuZXhwb3J0IGNvbnN0IGNvbmZpZzogQXBpUm91dGVDb25maWcgPSB7XG4gIG5hbWU6ICdBcHBseUltcHJvdmVkQ29udGVudCcsXG4gIHR5cGU6ICdhcGknLFxuICBwYXRoOiAnL2NvbnRlbnQvOmlkL2FwcGx5LWltcHJvdmVtZW50JyxcbiAgbWV0aG9kOiAnUE9TVCcsXG4gIGVtaXRzOiBbXSxcbiAgZmxvd3M6IFsnY29udGVudC13b3JrZmxvdyddXG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlcjogSGFuZGxlcnNbJ0FwcGx5SW1wcm92ZWRDb250ZW50J10gPSBhc3luYyAocmVxLCB7IHN0YXRlLCBsb2dnZXIgfSkgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IGNvbnRlbnRJZCA9IHJlcS5wYXRoUGFyYW1zPy5pZCBhcyBzdHJpbmc7XG5cbiAgICBpZiAoIWNvbnRlbnRJZCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3RhdHVzOiA0MDAsXG4gICAgICAgIGJvZHk6IHsgZXJyb3I6ICdDb250ZW50IElEIGlzIHJlcXVpcmVkJyB9XG4gICAgICB9O1xuICAgIH1cblxuICAgIGxvZ2dlci5pbmZvKCdBcHBseSBpbXByb3ZlZCBjb250ZW50IHJlcXVlc3RlZCcsIHsgY29udGVudElkIH0pO1xuXG4gICAgLy8gRmV0Y2ggY29udGVudCBzdGF0ZVxuICAgIGNvbnN0IGNvbnRlbnRTdGF0ZSA9IGF3YWl0IHN0YXRlLmdldCgnY29udGVudCcsIGNvbnRlbnRJZCkgYXMgQ29udGVudFN0YXRlIHwgbnVsbDtcblxuICAgIGlmICghY29udGVudFN0YXRlKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdGF0dXM6IDQwNCxcbiAgICAgICAgYm9keTogeyBlcnJvcjogJ0NvbnRlbnQgbm90IGZvdW5kJywgY29udGVudElkIH1cbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gVmFsaWRhdGUgaW1wcm92ZWQgY29udGVudCBleGlzdHMgYW5kIGlzIGNvbXBsZXRlXG4gICAgaWYgKCFjb250ZW50U3RhdGUuaW1wcm92ZWRDb250ZW50IHx8IGNvbnRlbnRTdGF0ZS5pbXByb3ZlZENvbnRlbnQuc3RhdHVzICE9PSAnY29tcGxldGVkJykge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3RhdHVzOiA0MDAsXG4gICAgICAgIGJvZHk6IHsgZXJyb3I6ICdObyBjb21wbGV0ZWQgaW1wcm92ZWQgY29udGVudCBhdmFpbGFibGUnLCBjb250ZW50SWQgfVxuICAgICAgfTtcbiAgICB9XG5cbiAgICBpZiAoIWNvbnRlbnRTdGF0ZS5pbXByb3ZlZENvbnRlbnQuaW1wcm92ZWRCb2R5KSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdGF0dXM6IDQwMCxcbiAgICAgICAgYm9keTogeyBlcnJvcjogJ0ltcHJvdmVkIGNvbnRlbnQgYm9keSBpcyBlbXB0eScsIGNvbnRlbnRJZCB9XG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIEFwcGx5IHRoZSBpbXByb3ZlZCBjb250ZW50IChqdXN0IHVwZGF0ZSBib2R5LCBrZWVwIGV4aXN0aW5nIGFuYWx5c2lzKVxuICAgIGNvbnN0IG9yaWdpbmFsQm9keSA9IGNvbnRlbnRTdGF0ZS5ib2R5O1xuICAgIGNvbnRlbnRTdGF0ZS5ib2R5ID0gY29udGVudFN0YXRlLmltcHJvdmVkQ29udGVudC5pbXByb3ZlZEJvZHk7XG4gICAgY29udGVudFN0YXRlLmltcHJvdmVkQ29udGVudC5hcHBsaWVkQXQgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCk7XG4gICAgY29udGVudFN0YXRlLnVwZGF0ZWRBdCA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcblxuICAgIC8vIFNhdmUgc3RhdGUgLSBrZWVwIGV4aXN0aW5nIHdvcmtmbG93IHN0YXR1cyBhbmQgYW5hbHlzaXNcbiAgICBhd2FpdCBzdGF0ZS5zZXQoJ2NvbnRlbnQnLCBjb250ZW50SWQsIGNvbnRlbnRTdGF0ZSk7XG5cbiAgICBsb2dnZXIuaW5mbygnSW1wcm92ZWQgY29udGVudCBhcHBsaWVkIHN1Y2Nlc3NmdWxseScsIHsgY29udGVudElkIH0pO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHN0YXR1czogMjAwLFxuICAgICAgYm9keToge1xuICAgICAgICBjb250ZW50SWQsXG4gICAgICAgIG1lc3NhZ2U6ICdJbXByb3ZlZCBjb250ZW50IGFwcGxpZWQgc3VjY2Vzc2Z1bGx5JyxcbiAgICAgICAgb3JpZ2luYWxCb2R5TGVuZ3RoOiBvcmlnaW5hbEJvZHkubGVuZ3RoLFxuICAgICAgICBuZXdCb2R5TGVuZ3RoOiBjb250ZW50U3RhdGUuYm9keS5sZW5ndGgsXG4gICAgICAgIGFwcGxpZWRBdDogY29udGVudFN0YXRlLmltcHJvdmVkQ29udGVudC5hcHBsaWVkQXQsXG4gICAgICAgIHN0YXR1czogY29udGVudFN0YXRlLndvcmtmbG93U3RhdHVzXG4gICAgICB9XG4gICAgfTtcblxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGxvZ2dlci5lcnJvcignRmFpbGVkIHRvIGFwcGx5IGltcHJvdmVkIGNvbnRlbnQnLCB7IGVycm9yIH0pO1xuICAgIHJldHVybiB7XG4gICAgICBzdGF0dXM6IDUwMCxcbiAgICAgIGJvZHk6IHsgZXJyb3I6ICdJbnRlcm5hbCBzZXJ2ZXIgZXJyb3InIH1cbiAgICB9O1xuICB9XG59O1xuXG4iXSwKICAibWFwcGluZ3MiOiAiQUFVTyxNQUFNLFNBQXlCO0FBQUEsRUFDcEMsTUFBTTtBQUFBLEVBQ04sTUFBTTtBQUFBLEVBQ04sTUFBTTtBQUFBLEVBQ04sUUFBUTtBQUFBLEVBQ1IsT0FBTyxDQUFDO0FBQUEsRUFDUixPQUFPLENBQUMsa0JBQWtCO0FBQzVCO0FBRU8sTUFBTSxVQUE0QyxPQUFPLEtBQUssRUFBRSxPQUFPLE9BQU8sTUFBTTtBQUN6RixNQUFJO0FBQ0YsVUFBTSxZQUFZLElBQUksWUFBWTtBQUVsQyxRQUFJLENBQUMsV0FBVztBQUNkLGFBQU87QUFBQSxRQUNMLFFBQVE7QUFBQSxRQUNSLE1BQU0sRUFBRSxPQUFPLHlCQUF5QjtBQUFBLE1BQzFDO0FBQUEsSUFDRjtBQUVBLFdBQU8sS0FBSyxvQ0FBb0MsRUFBRSxVQUFVLENBQUM7QUFHN0QsVUFBTSxlQUFlLE1BQU0sTUFBTSxJQUFJLFdBQVcsU0FBUztBQUV6RCxRQUFJLENBQUMsY0FBYztBQUNqQixhQUFPO0FBQUEsUUFDTCxRQUFRO0FBQUEsUUFDUixNQUFNLEVBQUUsT0FBTyxxQkFBcUIsVUFBVTtBQUFBLE1BQ2hEO0FBQUEsSUFDRjtBQUdBLFFBQUksQ0FBQyxhQUFhLG1CQUFtQixhQUFhLGdCQUFnQixXQUFXLGFBQWE7QUFDeEYsYUFBTztBQUFBLFFBQ0wsUUFBUTtBQUFBLFFBQ1IsTUFBTSxFQUFFLE9BQU8sMkNBQTJDLFVBQVU7QUFBQSxNQUN0RTtBQUFBLElBQ0Y7QUFFQSxRQUFJLENBQUMsYUFBYSxnQkFBZ0IsY0FBYztBQUM5QyxhQUFPO0FBQUEsUUFDTCxRQUFRO0FBQUEsUUFDUixNQUFNLEVBQUUsT0FBTyxrQ0FBa0MsVUFBVTtBQUFBLE1BQzdEO0FBQUEsSUFDRjtBQUdBLFVBQU0sZUFBZSxhQUFhO0FBQ2xDLGlCQUFhLE9BQU8sYUFBYSxnQkFBZ0I7QUFDakQsaUJBQWEsZ0JBQWdCLGFBQVksb0JBQUksS0FBSyxHQUFFLFlBQVk7QUFDaEUsaUJBQWEsYUFBWSxvQkFBSSxLQUFLLEdBQUUsWUFBWTtBQUdoRCxVQUFNLE1BQU0sSUFBSSxXQUFXLFdBQVcsWUFBWTtBQUVsRCxXQUFPLEtBQUsseUNBQXlDLEVBQUUsVUFBVSxDQUFDO0FBRWxFLFdBQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxNQUNSLE1BQU07QUFBQSxRQUNKO0FBQUEsUUFDQSxTQUFTO0FBQUEsUUFDVCxvQkFBb0IsYUFBYTtBQUFBLFFBQ2pDLGVBQWUsYUFBYSxLQUFLO0FBQUEsUUFDakMsV0FBVyxhQUFhLGdCQUFnQjtBQUFBLFFBQ3hDLFFBQVEsYUFBYTtBQUFBLE1BQ3ZCO0FBQUEsSUFDRjtBQUFBLEVBRUYsU0FBUyxPQUFPO0FBQ2QsV0FBTyxNQUFNLG9DQUFvQyxFQUFFLE1BQU0sQ0FBQztBQUMxRCxXQUFPO0FBQUEsTUFDTCxRQUFRO0FBQUEsTUFDUixNQUFNLEVBQUUsT0FBTyx3QkFBd0I7QUFBQSxJQUN6QztBQUFBLEVBQ0Y7QUFDRjsiLAogICJuYW1lcyI6IFtdCn0K
