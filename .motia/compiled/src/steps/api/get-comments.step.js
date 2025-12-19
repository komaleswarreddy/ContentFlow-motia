const config = {
  name: "GetComments",
  type: "api",
  path: "/content/:id/comments",
  method: "GET",
  emits: [],
  flows: ["content-workflow"]
};
const handler = async (req, { streams, logger, traceId }) => {
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
    logger.info("Fetching comments", { contentId });
    const comments = await streams.comments.getGroup(contentId);
    comments.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return {
      status: 200,
      body: comments
    };
  } catch (error) {
    logger.error("Failed to fetch comments", { error });
    return {
      status: 500,
      body: {
        error: "Internal server error",
        message: "Failed to fetch comments"
      }
    };
  }
};
export {
  config,
  handler
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vLi4vc3JjL3N0ZXBzL2FwaS9nZXQtY29tbWVudHMuc3RlcC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyoqXHJcbiAqIEFQSSBTdGVwOiBHZXQgQ29tbWVudHNcclxuICogXHJcbiAqIFJldHJpZXZlcyBhbGwgY29tbWVudHMgZm9yIGEgc3BlY2lmaWMgY29udGVudCBpdGVtLlxyXG4gKi9cclxuXHJcbmltcG9ydCB7IEFwaVJvdXRlQ29uZmlnLCBIYW5kbGVycyB9IGZyb20gJ21vdGlhJztcclxuXHJcbmV4cG9ydCBjb25zdCBjb25maWc6IEFwaVJvdXRlQ29uZmlnID0ge1xyXG4gIG5hbWU6ICdHZXRDb21tZW50cycsXHJcbiAgdHlwZTogJ2FwaScsXHJcbiAgcGF0aDogJy9jb250ZW50LzppZC9jb21tZW50cycsXHJcbiAgbWV0aG9kOiAnR0VUJyxcclxuICBlbWl0czogW10sXHJcbiAgZmxvd3M6IFsnY29udGVudC13b3JrZmxvdyddXHJcbn07XHJcblxyXG5leHBvcnQgY29uc3QgaGFuZGxlcjogSGFuZGxlcnNbJ0dldENvbW1lbnRzJ10gPSBhc3luYyAocmVxLCB7IHN0cmVhbXMsIGxvZ2dlciwgdHJhY2VJZCB9KSA9PiB7XHJcbiAgdHJ5IHtcclxuICAgIGNvbnN0IGNvbnRlbnRJZCA9IHJlcS5wYXRoUGFyYW1zPy5pZCBhcyBzdHJpbmc7XHJcblxyXG4gICAgaWYgKCFjb250ZW50SWQpIHtcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICBzdGF0dXM6IDQwMCxcclxuICAgICAgICBib2R5OiB7XHJcbiAgICAgICAgICBlcnJvcjogJ0NvbnRlbnQgSUQgaXMgcmVxdWlyZWQnXHJcbiAgICAgICAgfVxyXG4gICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIGxvZ2dlci5pbmZvKCdGZXRjaGluZyBjb21tZW50cycsIHsgY29udGVudElkIH0pO1xyXG5cclxuICAgIC8vIEdldCBhbGwgY29tbWVudHMgZm9yIHRoaXMgY29udGVudCAoZ3JvdXBJZCA9IGNvbnRlbnRJZClcclxuICAgIGNvbnN0IGNvbW1lbnRzID0gYXdhaXQgc3RyZWFtcy5jb21tZW50cy5nZXRHcm91cChjb250ZW50SWQpO1xyXG5cclxuICAgIC8vIFNvcnQgYnkgY3JlYXRlZEF0IChuZXdlc3QgZmlyc3QpXHJcbiAgICBjb21tZW50cy5zb3J0KChhLCBiKSA9PiBcclxuICAgICAgbmV3IERhdGUoYi5jcmVhdGVkQXQpLmdldFRpbWUoKSAtIG5ldyBEYXRlKGEuY3JlYXRlZEF0KS5nZXRUaW1lKClcclxuICAgICk7XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgc3RhdHVzOiAyMDAsXHJcbiAgICAgIGJvZHk6IGNvbW1lbnRzXHJcbiAgICB9O1xyXG5cclxuICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgbG9nZ2VyLmVycm9yKCdGYWlsZWQgdG8gZmV0Y2ggY29tbWVudHMnLCB7IGVycm9yIH0pO1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgc3RhdHVzOiA1MDAsXHJcbiAgICAgIGJvZHk6IHtcclxuICAgICAgICBlcnJvcjogJ0ludGVybmFsIHNlcnZlciBlcnJvcicsXHJcbiAgICAgICAgbWVzc2FnZTogJ0ZhaWxlZCB0byBmZXRjaCBjb21tZW50cydcclxuICAgICAgfVxyXG4gICAgfTtcclxuICB9XHJcbn07XHJcblxyXG4iXSwKICAibWFwcGluZ3MiOiAiQUFRTyxNQUFNLFNBQXlCO0FBQUEsRUFDcEMsTUFBTTtBQUFBLEVBQ04sTUFBTTtBQUFBLEVBQ04sTUFBTTtBQUFBLEVBQ04sUUFBUTtBQUFBLEVBQ1IsT0FBTyxDQUFDO0FBQUEsRUFDUixPQUFPLENBQUMsa0JBQWtCO0FBQzVCO0FBRU8sTUFBTSxVQUFtQyxPQUFPLEtBQUssRUFBRSxTQUFTLFFBQVEsUUFBUSxNQUFNO0FBQzNGLE1BQUk7QUFDRixVQUFNLFlBQVksSUFBSSxZQUFZO0FBRWxDLFFBQUksQ0FBQyxXQUFXO0FBQ2QsYUFBTztBQUFBLFFBQ0wsUUFBUTtBQUFBLFFBQ1IsTUFBTTtBQUFBLFVBQ0osT0FBTztBQUFBLFFBQ1Q7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUVBLFdBQU8sS0FBSyxxQkFBcUIsRUFBRSxVQUFVLENBQUM7QUFHOUMsVUFBTSxXQUFXLE1BQU0sUUFBUSxTQUFTLFNBQVMsU0FBUztBQUcxRCxhQUFTO0FBQUEsTUFBSyxDQUFDLEdBQUcsTUFDaEIsSUFBSSxLQUFLLEVBQUUsU0FBUyxFQUFFLFFBQVEsSUFBSSxJQUFJLEtBQUssRUFBRSxTQUFTLEVBQUUsUUFBUTtBQUFBLElBQ2xFO0FBRUEsV0FBTztBQUFBLE1BQ0wsUUFBUTtBQUFBLE1BQ1IsTUFBTTtBQUFBLElBQ1I7QUFBQSxFQUVGLFNBQVMsT0FBTztBQUNkLFdBQU8sTUFBTSw0QkFBNEIsRUFBRSxNQUFNLENBQUM7QUFDbEQsV0FBTztBQUFBLE1BQ0wsUUFBUTtBQUFBLE1BQ1IsTUFBTTtBQUFBLFFBQ0osT0FBTztBQUFBLFFBQ1AsU0FBUztBQUFBLE1BQ1g7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGOyIsCiAgIm5hbWVzIjogW10KfQo=
