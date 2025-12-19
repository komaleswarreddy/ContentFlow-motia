const config = {
  name: "DeleteContent",
  type: "api",
  path: "/content/:id",
  method: "DELETE",
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
    logger.info("Deleting content", { contentId });
    const contentState = await state.get("content", contentId);
    if (!contentState) {
      logger.warn("Content not found for deletion", { contentId });
      return {
        status: 404,
        body: {
          error: "Content not found",
          contentId
        }
      };
    }
    await state.delete("content", contentId);
    await state.delete("workflow", contentId);
    logger.info("Content deleted successfully", { contentId });
    return {
      status: 200,
      body: {
        success: true,
        message: "Content deleted successfully",
        contentId
      }
    };
  } catch (error) {
    logger.error("Failed to delete content", { error });
    return {
      status: 500,
      body: {
        error: "Internal server error",
        message: "Failed to delete content"
      }
    };
  }
};
export {
  config,
  handler
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vLi4vc3JjL3N0ZXBzL2FwaS9kZWxldGUtY29udGVudC5zdGVwLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKipcclxuICogQVBJIFN0ZXA6IERlbGV0ZSBDb250ZW50XHJcbiAqIFxyXG4gKiBEZWxldGVzIGEgY29udGVudCBpdGVtIGFuZCBpdHMgYXNzb2NpYXRlZCB3b3JrZmxvdyBzdGF0ZS5cclxuICogUmV0dXJucyBzdWNjZXNzIHN0YXR1cyBhZnRlciBkZWxldGlvbi5cclxuICovXHJcblxyXG5pbXBvcnQgeyBBcGlSb3V0ZUNvbmZpZywgSGFuZGxlcnMgfSBmcm9tICdtb3RpYSc7XHJcblxyXG5leHBvcnQgY29uc3QgY29uZmlnOiBBcGlSb3V0ZUNvbmZpZyA9IHtcclxuICBuYW1lOiAnRGVsZXRlQ29udGVudCcsXHJcbiAgdHlwZTogJ2FwaScsXHJcbiAgcGF0aDogJy9jb250ZW50LzppZCcsXHJcbiAgbWV0aG9kOiAnREVMRVRFJyxcclxuICBlbWl0czogW10sXHJcbiAgZmxvd3M6IFsnY29udGVudC13b3JrZmxvdyddXHJcbn07XHJcblxyXG5leHBvcnQgY29uc3QgaGFuZGxlcjogSGFuZGxlcnNbJ0RlbGV0ZUNvbnRlbnQnXSA9IGFzeW5jIChyZXEsIHsgc3RhdGUsIGxvZ2dlciwgdHJhY2VJZCB9KSA9PiB7XHJcbiAgdHJ5IHtcclxuICAgIGNvbnN0IGNvbnRlbnRJZCA9IHJlcS5wYXRoUGFyYW1zPy5pZCBhcyBzdHJpbmc7XHJcblxyXG4gICAgaWYgKCFjb250ZW50SWQpIHtcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICBzdGF0dXM6IDQwMCxcclxuICAgICAgICBib2R5OiB7XHJcbiAgICAgICAgICBlcnJvcjogJ0NvbnRlbnQgSUQgaXMgcmVxdWlyZWQnXHJcbiAgICAgICAgfVxyXG4gICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIGxvZ2dlci5pbmZvKCdEZWxldGluZyBjb250ZW50JywgeyBjb250ZW50SWQgfSk7XHJcblxyXG4gICAgLy8gQ2hlY2sgaWYgY29udGVudCBleGlzdHNcclxuICAgIGNvbnN0IGNvbnRlbnRTdGF0ZSA9IGF3YWl0IHN0YXRlLmdldCgnY29udGVudCcsIGNvbnRlbnRJZCk7XHJcbiAgICBpZiAoIWNvbnRlbnRTdGF0ZSkge1xyXG4gICAgICBsb2dnZXIud2FybignQ29udGVudCBub3QgZm91bmQgZm9yIGRlbGV0aW9uJywgeyBjb250ZW50SWQgfSk7XHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgc3RhdHVzOiA0MDQsXHJcbiAgICAgICAgYm9keToge1xyXG4gICAgICAgICAgZXJyb3I6ICdDb250ZW50IG5vdCBmb3VuZCcsXHJcbiAgICAgICAgICBjb250ZW50SWRcclxuICAgICAgICB9XHJcbiAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgLy8gRGVsZXRlIGNvbnRlbnQgZnJvbSBzdGF0ZVxyXG4gICAgYXdhaXQgc3RhdGUuZGVsZXRlKCdjb250ZW50JywgY29udGVudElkKTtcclxuICAgIFxyXG4gICAgLy8gQWxzbyBkZWxldGUgd29ya2Zsb3cgc3RhdGUgaWYgaXQgZXhpc3RzXHJcbiAgICBhd2FpdCBzdGF0ZS5kZWxldGUoJ3dvcmtmbG93JywgY29udGVudElkKTtcclxuXHJcbiAgICBsb2dnZXIuaW5mbygnQ29udGVudCBkZWxldGVkIHN1Y2Nlc3NmdWxseScsIHsgY29udGVudElkIH0pO1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgIHN0YXR1czogMjAwLFxyXG4gICAgICBib2R5OiB7XHJcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgICBtZXNzYWdlOiAnQ29udGVudCBkZWxldGVkIHN1Y2Nlc3NmdWxseScsXHJcbiAgICAgICAgY29udGVudElkXHJcbiAgICAgIH1cclxuICAgIH07XHJcblxyXG4gIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICBsb2dnZXIuZXJyb3IoJ0ZhaWxlZCB0byBkZWxldGUgY29udGVudCcsIHsgZXJyb3IgfSk7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBzdGF0dXM6IDUwMCxcclxuICAgICAgYm9keToge1xyXG4gICAgICAgIGVycm9yOiAnSW50ZXJuYWwgc2VydmVyIGVycm9yJyxcclxuICAgICAgICBtZXNzYWdlOiAnRmFpbGVkIHRvIGRlbGV0ZSBjb250ZW50J1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG4gIH1cclxufTtcclxuXHJcbiJdLAogICJtYXBwaW5ncyI6ICJBQVNPLE1BQU0sU0FBeUI7QUFBQSxFQUNwQyxNQUFNO0FBQUEsRUFDTixNQUFNO0FBQUEsRUFDTixNQUFNO0FBQUEsRUFDTixRQUFRO0FBQUEsRUFDUixPQUFPLENBQUM7QUFBQSxFQUNSLE9BQU8sQ0FBQyxrQkFBa0I7QUFDNUI7QUFFTyxNQUFNLFVBQXFDLE9BQU8sS0FBSyxFQUFFLE9BQU8sUUFBUSxRQUFRLE1BQU07QUFDM0YsTUFBSTtBQUNGLFVBQU0sWUFBWSxJQUFJLFlBQVk7QUFFbEMsUUFBSSxDQUFDLFdBQVc7QUFDZCxhQUFPO0FBQUEsUUFDTCxRQUFRO0FBQUEsUUFDUixNQUFNO0FBQUEsVUFDSixPQUFPO0FBQUEsUUFDVDtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBRUEsV0FBTyxLQUFLLG9CQUFvQixFQUFFLFVBQVUsQ0FBQztBQUc3QyxVQUFNLGVBQWUsTUFBTSxNQUFNLElBQUksV0FBVyxTQUFTO0FBQ3pELFFBQUksQ0FBQyxjQUFjO0FBQ2pCLGFBQU8sS0FBSyxrQ0FBa0MsRUFBRSxVQUFVLENBQUM7QUFDM0QsYUFBTztBQUFBLFFBQ0wsUUFBUTtBQUFBLFFBQ1IsTUFBTTtBQUFBLFVBQ0osT0FBTztBQUFBLFVBQ1A7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFHQSxVQUFNLE1BQU0sT0FBTyxXQUFXLFNBQVM7QUFHdkMsVUFBTSxNQUFNLE9BQU8sWUFBWSxTQUFTO0FBRXhDLFdBQU8sS0FBSyxnQ0FBZ0MsRUFBRSxVQUFVLENBQUM7QUFFekQsV0FBTztBQUFBLE1BQ0wsUUFBUTtBQUFBLE1BQ1IsTUFBTTtBQUFBLFFBQ0osU0FBUztBQUFBLFFBQ1QsU0FBUztBQUFBLFFBQ1Q7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBRUYsU0FBUyxPQUFPO0FBQ2QsV0FBTyxNQUFNLDRCQUE0QixFQUFFLE1BQU0sQ0FBQztBQUNsRCxXQUFPO0FBQUEsTUFDTCxRQUFRO0FBQUEsTUFDUixNQUFNO0FBQUEsUUFDSixPQUFPO0FBQUEsUUFDUCxTQUFTO0FBQUEsTUFDWDtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0Y7IiwKICAibmFtZXMiOiBbXQp9Cg==
