const config = {
  name: "DailyProcessing",
  type: "cron",
  cron: "0 2 * * *",
  // Run daily at 2:00 AM UTC
  emits: [],
  flows: ["content-workflow"]
};
const handler = async (input, { state, logger }) => {
  try {
    logger.info("Starting daily processing job");
    const now = Date.now();
    const STALE_AGE_DAYS = 90;
    const staleThreshold = now - STALE_AGE_DAYS * 24 * 60 * 60 * 1e3;
    const allContent = await state.getGroup("content");
    let staleContentCount = 0;
    let totalContentProcessed = 0;
    let deletedContentIds = [];
    const processingTimes = [];
    if (allContent && allContent.length > 0) {
      totalContentProcessed = allContent.length;
      for (const content of allContent) {
        try {
          const createdAt = new Date(content.createdAt).getTime();
          const updatedAt = new Date(content.updatedAt).getTime();
          if (content.workflowStatus === "completed") {
            const processingTime = updatedAt - createdAt;
            processingTimes.push(processingTime);
          }
          if (createdAt < staleThreshold) {
            if (["completed", "failed", "rejected"].includes(content.workflowStatus)) {
              staleContentCount++;
              await state.delete("content", content.contentId);
              await state.delete("workflow", content.contentId);
              deletedContentIds.push(content.contentId);
              logger.info("Deleted stale content", {
                contentId: content.contentId,
                age: Math.round((now - createdAt) / (24 * 60 * 60 * 1e3)) + " days",
                status: content.workflowStatus
              });
            }
          }
        } catch (error) {
          logger.warn("Error processing content item", {
            contentId: content.contentId,
            error: error instanceof Error ? error.message : "Unknown error"
          });
        }
      }
    }
    const averageProcessingTime = processingTimes.length > 0 ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length : 0;
    const metrics = {
      processedAt: (/* @__PURE__ */ new Date()).toISOString(),
      staleContentCount,
      totalContentProcessed,
      deletedContentCount: deletedContentIds.length,
      averageProcessingTime: Math.round(averageProcessingTime),
      // in milliseconds
      activeContentCount: totalContentProcessed - deletedContentIds.length
    };
    logger.info("Daily processing completed", { metrics });
    await state.set("system", "daily_metrics", metrics);
    await state.set("system", "daily_processing_last_run", {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      deletedContentIds: deletedContentIds.slice(0, 100)
      // Store first 100 IDs for reference
    });
    return {
      success: true,
      metrics
    };
  } catch (error) {
    logger.error("Daily processing job failed", { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
};
export {
  config,
  handler
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vLi4vc3JjL3N0ZXBzL2Nyb25zL2RhaWx5LXByb2Nlc3Npbmcuc3RlcC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyoqXHJcbiAqIENyb24gU3RlcDogRGFpbHkgUHJvY2Vzc2luZ1xyXG4gKiBcclxuICogUnVucyBvbmNlIHBlciBkYXkgdG8gcGVyZm9ybSBtYWludGVuYW5jZSB0YXNrczpcclxuICogLSBDbGVhbiB1cCBzdGFsZSBjb250ZW50IGRhdGFcclxuICogLSBBZ2dyZWdhdGUgYmFzaWMgbWV0cmljc1xyXG4gKiAtIExvZyByZXN1bHRzIGZvciBvYnNlcnZhYmlsaXR5XHJcbiAqL1xyXG5cclxuaW1wb3J0IHsgQ3JvbkNvbmZpZywgSGFuZGxlcnMgfSBmcm9tICdtb3RpYSc7XHJcblxyXG5leHBvcnQgY29uc3QgY29uZmlnOiBDcm9uQ29uZmlnID0ge1xyXG4gIG5hbWU6ICdEYWlseVByb2Nlc3NpbmcnLFxyXG4gIHR5cGU6ICdjcm9uJyxcclxuICBjcm9uOiAnMCAyICogKiAqJywgLy8gUnVuIGRhaWx5IGF0IDI6MDAgQU0gVVRDXHJcbiAgZW1pdHM6IFtdLFxyXG4gIGZsb3dzOiBbJ2NvbnRlbnQtd29ya2Zsb3cnXVxyXG59O1xyXG5cclxuaW1wb3J0IHR5cGUgeyBDb250ZW50U3RhdGUgfSBmcm9tICcuLi8uLi90eXBlcy9pbmRleC5qcyc7XHJcblxyXG5leHBvcnQgY29uc3QgaGFuZGxlcjogSGFuZGxlcnNbJ0RhaWx5UHJvY2Vzc2luZyddID0gYXN5bmMgKGlucHV0LCB7IHN0YXRlLCBsb2dnZXIgfSkgPT4ge1xyXG4gIHRyeSB7XHJcbiAgICBsb2dnZXIuaW5mbygnU3RhcnRpbmcgZGFpbHkgcHJvY2Vzc2luZyBqb2InKTtcclxuXHJcbiAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xyXG4gICAgY29uc3QgU1RBTEVfQUdFX0RBWVMgPSA5MDsgLy8gQ29udGVudCBvbGRlciB0aGFuIDkwIGRheXMgaXMgY29uc2lkZXJlZCBzdGFsZVxyXG4gICAgY29uc3Qgc3RhbGVUaHJlc2hvbGQgPSBub3cgLSAoU1RBTEVfQUdFX0RBWVMgKiAyNCAqIDYwICogNjAgKiAxMDAwKTtcclxuXHJcbiAgICAvLyBHZXQgYWxsIGNvbnRlbnQgZnJvbSBzdGF0ZVxyXG4gICAgY29uc3QgYWxsQ29udGVudCA9IGF3YWl0IHN0YXRlLmdldEdyb3VwKCdjb250ZW50JykgYXMgQ29udGVudFN0YXRlW10gfCBudWxsO1xyXG5cclxuICAgIGxldCBzdGFsZUNvbnRlbnRDb3VudCA9IDA7XHJcbiAgICBsZXQgdG90YWxDb250ZW50UHJvY2Vzc2VkID0gMDtcclxuICAgIGxldCBkZWxldGVkQ29udGVudElkczogc3RyaW5nW10gPSBbXTtcclxuICAgIGNvbnN0IHByb2Nlc3NpbmdUaW1lczogbnVtYmVyW10gPSBbXTtcclxuXHJcbiAgICBpZiAoYWxsQ29udGVudCAmJiBhbGxDb250ZW50Lmxlbmd0aCA+IDApIHtcclxuICAgICAgdG90YWxDb250ZW50UHJvY2Vzc2VkID0gYWxsQ29udGVudC5sZW5ndGg7XHJcblxyXG4gICAgICAvLyBQcm9jZXNzIGVhY2ggY29udGVudCBpdGVtXHJcbiAgICAgIGZvciAoY29uc3QgY29udGVudCBvZiBhbGxDb250ZW50KSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIGNvbnN0IGNyZWF0ZWRBdCA9IG5ldyBEYXRlKGNvbnRlbnQuY3JlYXRlZEF0KS5nZXRUaW1lKCk7XHJcbiAgICAgICAgICBjb25zdCB1cGRhdGVkQXQgPSBuZXcgRGF0ZShjb250ZW50LnVwZGF0ZWRBdCkuZ2V0VGltZSgpO1xyXG4gICAgICAgICAgXHJcbiAgICAgICAgICAvLyBDYWxjdWxhdGUgcHJvY2Vzc2luZyB0aW1lICh0aW1lIGZyb20gY3JlYXRpb24gdG8gY29tcGxldGlvbiBvciBsYXN0IHVwZGF0ZSlcclxuICAgICAgICAgIGlmIChjb250ZW50LndvcmtmbG93U3RhdHVzID09PSAnY29tcGxldGVkJykge1xyXG4gICAgICAgICAgICBjb25zdCBwcm9jZXNzaW5nVGltZSA9IHVwZGF0ZWRBdCAtIGNyZWF0ZWRBdDtcclxuICAgICAgICAgICAgcHJvY2Vzc2luZ1RpbWVzLnB1c2gocHJvY2Vzc2luZ1RpbWUpO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIC8vIENoZWNrIGlmIGNvbnRlbnQgaXMgc3RhbGUgKG9sZGVyIHRoYW4gdGhyZXNob2xkKVxyXG4gICAgICAgICAgaWYgKGNyZWF0ZWRBdCA8IHN0YWxlVGhyZXNob2xkKSB7XHJcbiAgICAgICAgICAgIC8vIE9ubHkgZGVsZXRlIGlmIGNvbnRlbnQgaXMgaW4gYSBmaW5hbCBzdGF0ZSAoY29tcGxldGVkLCBmYWlsZWQsIHJlamVjdGVkKVxyXG4gICAgICAgICAgICAvLyBLZWVwIHBlbmRpbmcvcHJvY2Vzc2luZyBjb250ZW50IGV2ZW4gaWYgb2xkXHJcbiAgICAgICAgICAgIGlmIChbJ2NvbXBsZXRlZCcsICdmYWlsZWQnLCAncmVqZWN0ZWQnXS5pbmNsdWRlcyhjb250ZW50LndvcmtmbG93U3RhdHVzKSkge1xyXG4gICAgICAgICAgICAgIHN0YWxlQ29udGVudENvdW50Kys7XHJcbiAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgLy8gRGVsZXRlIHN0YWxlIGNvbnRlbnRcclxuICAgICAgICAgICAgICBhd2FpdCBzdGF0ZS5kZWxldGUoJ2NvbnRlbnQnLCBjb250ZW50LmNvbnRlbnRJZCk7XHJcbiAgICAgICAgICAgICAgYXdhaXQgc3RhdGUuZGVsZXRlKCd3b3JrZmxvdycsIGNvbnRlbnQuY29udGVudElkKTtcclxuICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICBkZWxldGVkQ29udGVudElkcy5wdXNoKGNvbnRlbnQuY29udGVudElkKTtcclxuICAgICAgICAgICAgICBsb2dnZXIuaW5mbygnRGVsZXRlZCBzdGFsZSBjb250ZW50JywgeyBcclxuICAgICAgICAgICAgICAgIGNvbnRlbnRJZDogY29udGVudC5jb250ZW50SWQsIFxyXG4gICAgICAgICAgICAgICAgYWdlOiBNYXRoLnJvdW5kKChub3cgLSBjcmVhdGVkQXQpIC8gKDI0ICogNjAgKiA2MCAqIDEwMDApKSArICcgZGF5cycsXHJcbiAgICAgICAgICAgICAgICBzdGF0dXM6IGNvbnRlbnQud29ya2Zsb3dTdGF0dXMgXHJcbiAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgbG9nZ2VyLndhcm4oJ0Vycm9yIHByb2Nlc3NpbmcgY29udGVudCBpdGVtJywgeyBcclxuICAgICAgICAgICAgY29udGVudElkOiBjb250ZW50LmNvbnRlbnRJZCwgXHJcbiAgICAgICAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6ICdVbmtub3duIGVycm9yJyBcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIENhbGN1bGF0ZSBhdmVyYWdlIHByb2Nlc3NpbmcgdGltZVxyXG4gICAgY29uc3QgYXZlcmFnZVByb2Nlc3NpbmdUaW1lID0gcHJvY2Vzc2luZ1RpbWVzLmxlbmd0aCA+IDBcclxuICAgICAgPyBwcm9jZXNzaW5nVGltZXMucmVkdWNlKChzdW0sIHRpbWUpID0+IHN1bSArIHRpbWUsIDApIC8gcHJvY2Vzc2luZ1RpbWVzLmxlbmd0aFxyXG4gICAgICA6IDA7XHJcblxyXG4gICAgLy8gQWdncmVnYXRlIG1ldHJpY3NcclxuICAgIGNvbnN0IG1ldHJpY3MgPSB7XHJcbiAgICAgIHByb2Nlc3NlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXHJcbiAgICAgIHN0YWxlQ29udGVudENvdW50LFxyXG4gICAgICB0b3RhbENvbnRlbnRQcm9jZXNzZWQsXHJcbiAgICAgIGRlbGV0ZWRDb250ZW50Q291bnQ6IGRlbGV0ZWRDb250ZW50SWRzLmxlbmd0aCxcclxuICAgICAgYXZlcmFnZVByb2Nlc3NpbmdUaW1lOiBNYXRoLnJvdW5kKGF2ZXJhZ2VQcm9jZXNzaW5nVGltZSksIC8vIGluIG1pbGxpc2Vjb25kc1xyXG4gICAgICBhY3RpdmVDb250ZW50Q291bnQ6IHRvdGFsQ29udGVudFByb2Nlc3NlZCAtIGRlbGV0ZWRDb250ZW50SWRzLmxlbmd0aFxyXG4gICAgfTtcclxuXHJcbiAgICBsb2dnZXIuaW5mbygnRGFpbHkgcHJvY2Vzc2luZyBjb21wbGV0ZWQnLCB7IG1ldHJpY3MgfSk7XHJcblxyXG4gICAgLy8gUGVyc2lzdCBtZXRyaWNzIGZvciBvYnNlcnZhYmlsaXR5XHJcbiAgICBhd2FpdCBzdGF0ZS5zZXQoJ3N5c3RlbScsICdkYWlseV9tZXRyaWNzJywgbWV0cmljcyk7XHJcblxyXG4gICAgLy8gU3RvcmUgbGFzdCBydW4gdGltZXN0YW1wXHJcbiAgICBhd2FpdCBzdGF0ZS5zZXQoJ3N5c3RlbScsICdkYWlseV9wcm9jZXNzaW5nX2xhc3RfcnVuJywge1xyXG4gICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcclxuICAgICAgZGVsZXRlZENvbnRlbnRJZHM6IGRlbGV0ZWRDb250ZW50SWRzLnNsaWNlKDAsIDEwMCkgLy8gU3RvcmUgZmlyc3QgMTAwIElEcyBmb3IgcmVmZXJlbmNlXHJcbiAgICB9KTtcclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICBtZXRyaWNzXHJcbiAgICB9O1xyXG5cclxuICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgbG9nZ2VyLmVycm9yKCdEYWlseSBwcm9jZXNzaW5nIGpvYiBmYWlsZWQnLCB7IGVycm9yIH0pO1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgc3VjY2VzczogZmFsc2UsXHJcbiAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6ICdVbmtub3duIGVycm9yJ1xyXG4gICAgfTtcclxu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
