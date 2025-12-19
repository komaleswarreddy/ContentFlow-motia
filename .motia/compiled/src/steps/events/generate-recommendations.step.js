const config = {
  name: "GenerateRecommendations",
  type: "event",
  subscribes: ["content.analyzed"],
  emits: ["content.completed"],
  flows: ["content-workflow"]
};
const handler = async (input, { emit, state, streams, logger, traceId }) => {
  try {
    const { contentId, aiAnalysis } = input;
    logger.info("Generating recommendations", { contentId });
    const contentState = await state.get("content", contentId);
    if (!contentState) {
      logger.error("Content not found for recommendations", { contentId });
      return;
    }
    const recommendations = [];
    if (aiAnalysis.qualityScore >= 80 && aiAnalysis.sentiment === "positive") {
      recommendations.push({
        id: `rec_${contentId}_publish_1`,
        type: "publish",
        title: "Ready to Publish",
        description: "Content meets high quality standards and is ready for publication.",
        priority: "high",
        actionableSteps: [
          "Review final content for typos",
          "Add relevant tags/categories",
          "Schedule publication",
          "Share on social media channels"
        ]
      });
    } else if (aiAnalysis.qualityScore >= 60) {
      recommendations.push({
        id: `rec_${contentId}_publish_2`,
        type: "publish",
        title: "Publish with Minor Edits",
        description: "Content is good but could benefit from minor improvements before publishing.",
        priority: "medium",
        actionableSteps: [
          "Address identified weaknesses",
          "Enhance strengths",
          "Review and publish"
        ]
      });
    } else {
      recommendations.push({
        id: `rec_${contentId}_review_1`,
        type: "review",
        title: "Needs Review Before Publishing",
        description: "Content requires significant improvements before it's ready for publication.",
        priority: "high",
        actionableSteps: [
          "Address all identified weaknesses",
          "Improve quality score above 60",
          "Get peer review",
          "Revise and resubmit"
        ]
      });
    }
    if (aiAnalysis.weaknesses.length > 0) {
      recommendations.push({
        id: `rec_${contentId}_improve_1`,
        type: "improve",
        title: "Address Content Weaknesses",
        description: `Focus on improving: ${aiAnalysis.weaknesses.slice(0, 3).join(", ")}`,
        priority: aiAnalysis.qualityScore < 60 ? "high" : "medium",
        actionableSteps: aiAnalysis.weaknesses.slice(0, 5).map((w) => `Work on: ${w}`)
      });
    }
    if (aiAnalysis.readabilityScore < 60) {
      recommendations.push({
        id: `rec_${contentId}_optimize_1`,
        type: "optimize",
        title: "Improve Readability",
        description: "Content readability can be improved for better audience engagement.",
        priority: "medium",
        actionableSteps: [
          "Use shorter sentences",
          "Break up long paragraphs",
          "Add subheadings for structure",
          "Simplify complex vocabulary where possible"
        ]
      });
    }
    if (aiAnalysis.topics.length > 0 && aiAnalysis.topics.length < 3) {
      recommendations.push({
        id: `rec_${contentId}_optimize_2`,
        type: "optimize",
        title: "Expand Topic Coverage",
        description: "Consider adding more related topics to improve SEO and depth.",
        priority: "low",
        actionableSteps: [
          "Research related subtopics",
          "Add supporting examples",
          "Include relevant keywords naturally"
        ]
      });
    }
    contentState.recommendations = recommendations;
    const completedStatus = "completed";
    contentState.workflowStatus = completedStatus;
    contentState.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await state.set("content", contentId, contentState);
    await state.set("recommendations", contentId, recommendations);
    await state.set("workflow", contentId, { status: completedStatus, contentId });
    logger.info("Recommendations generated", {
      contentId,
      recommendationCount: recommendations.length
    });
    try {
      await streams.contentUpdates.send(
        { groupId: contentId },
        {
          type: "recommendations_completed",
          data: {
            contentId,
            status: "completed",
            recommendations,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          }
        }
      );
    } catch (streamError) {
      logger.warn("Failed to send stream update (non-critical)", { error: streamError, contentId });
    }
    try {
      await emit({
        topic: "content.completed",
        data: {
          contentId,
          recommendations,
          traceId
        }
      });
    } catch (emitError) {
      logger.warn("Failed to emit completed event (non-critical)", { error: emitError, contentId });
    }
  } catch (error) {
    logger.error("Recommendation generation error", { error, input });
    const { contentId } = input;
    try {
      const contentState = await state.get("content", contentId);
      if (contentState) {
        if (contentState.recommendations && contentState.recommendations.length > 0) {
          const completedStatus = "completed";
          contentState.workflowStatus = completedStatus;
          contentState.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
          await state.set("content", contentId, contentState);
          await state.set("workflow", contentId, { status: completedStatus, contentId });
        } else if (contentState.aiAnalysis) {
          const analyzedStatus = "analyzed";
          contentState.workflowStatus = analyzedStatus;
          contentState.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
          await state.set("content", contentId, contentState);
          await state.set("workflow", contentId, { status: analyzedStatus, contentId });
        }
      }
    } catch (stateError) {
      logger.error("Failed to update workflow status", { error: stateError });
    }
  }
};
export {
  config,
  handler
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vLi4vc3JjL3N0ZXBzL2V2ZW50cy9nZW5lcmF0ZS1yZWNvbW1lbmRhdGlvbnMuc3RlcC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyoqXHJcbiAqIEV2ZW50IFN0ZXA6IEdlbmVyYXRlIFJlY29tbWVuZGF0aW9uc1xyXG4gKiBcclxuICogU3Vic2NyaWJlcyB0byBjb250ZW50LmFuYWx5emVkIGV2ZW50LCByZWFkcyBBSSBhbmFseXNpcyBmcm9tIHN0YXRlLFxyXG4gKiBnZW5lcmF0ZXMgYWN0aW9uYWJsZSBwdWJsaXNoaW5nIGFuZCBpbXByb3ZlbWVudCByZWNvbW1lbmRhdGlvbnMsXHJcbiAqIGFuZCBwZXJzaXN0cyByZWNvbW1lbmRhdGlvbnMgYmVmb3JlIGVtaXR0aW5nIGNvbXBsZXRpb24gZXZlbnQuXHJcbiAqL1xyXG5cclxuaW1wb3J0IHsgRXZlbnRDb25maWcsIEhhbmRsZXJzIH0gZnJvbSAnbW90aWEnO1xyXG5pbXBvcnQgdHlwZSB7IENvbnRlbnRTdGF0ZSwgQUlBbmFseXNpc1Jlc3VsdCwgUmVjb21tZW5kYXRpb24sIFdvcmtmbG93U3RhdHVzIH0gZnJvbSAnLi4vLi4vdHlwZXMvaW5kZXguanMnO1xyXG5cclxuZXhwb3J0IGNvbnN0IGNvbmZpZzogRXZlbnRDb25maWcgPSB7XHJcbiAgbmFtZTogJ0dlbmVyYXRlUmVjb21tZW5kYXRpb25zJyxcclxuICB0eXBlOiAnZXZlbnQnLFxyXG4gIHN1YnNjcmliZXM6IFsnY29udGVudC5hbmFseXplZCddLFxyXG4gIGVtaXRzOiBbJ2NvbnRlbnQuY29tcGxldGVkJ10sXHJcbiAgZmxvd3M6IFsnY29udGVudC13b3JrZmxvdyddXHJcbn07XHJcblxyXG5leHBvcnQgY29uc3QgaGFuZGxlcjogSGFuZGxlcnNbJ0dlbmVyYXRlUmVjb21tZW5kYXRpb25zJ10gPSBhc3luYyAoaW5wdXQsIHsgZW1pdCwgc3RhdGUsIHN0cmVhbXMsIGxvZ2dlciwgdHJhY2VJZCB9KSA9PiB7XHJcbiAgdHJ5IHtcclxuICAgIC8vIEV2ZW50IGRhdGEgaXMgcGFzc2VkIGRpcmVjdGx5IG9uIGlucHV0LCBub3QgaW5wdXQuZGF0YVxyXG4gICAgY29uc3QgeyBjb250ZW50SWQsIGFpQW5hbHlzaXMgfSA9IGlucHV0IGFzIHsgXHJcbiAgICAgIGNvbnRlbnRJZDogc3RyaW5nOyBcclxuICAgICAgYWlBbmFseXNpczogQUlBbmFseXNpc1Jlc3VsdDtcclxuICAgICAgdHJhY2VJZDogc3RyaW5nO1xyXG4gICAgfTtcclxuXHJcbiAgICBsb2dnZXIuaW5mbygnR2VuZXJhdGluZyByZWNvbW1lbmRhdGlvbnMnLCB7IGNvbnRlbnRJZCB9KTtcclxuXHJcbiAgICAvLyBSZWFkIGNvbnRlbnQgc3RhdGUgdG8gZ2V0IGZ1bGwgY29udGV4dCAodXNlICdjb250ZW50JyBhcyBncm91cElkLCBub3QgdHJhY2VJZClcclxuICAgIGNvbnN0IGNvbnRlbnRTdGF0ZSA9IGF3YWl0IHN0YXRlLmdldCgnY29udGVudCcsIGNvbnRlbnRJZCkgYXMgQ29udGVudFN0YXRlIHwgbnVsbDtcclxuXHJcbiAgICBpZiAoIWNvbnRlbnRTdGF0ZSkge1xyXG4gICAgICBsb2dnZXIuZXJyb3IoJ0NvbnRlbnQgbm90IGZvdW5kIGZvciByZWNvbW1lbmRhdGlvbnMnLCB7IGNvbnRlbnRJZCB9KTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEdlbmVyYXRlIHJlY29tbWVuZGF0aW9ucyBiYXNlZCBvbiBBSSBhbmFseXNpc1xyXG4gICAgY29uc3QgcmVjb21tZW5kYXRpb25zOiBSZWNvbW1lbmRhdGlvbltdID0gW107XHJcblxyXG4gICAgLy8gRGVjaXNpb24gbG9naWM6IFB1Ymxpc2hpbmcgcmVjb21tZW5kYXRpb25zXHJcbiAgICBpZiAoYWlBbmFseXNpcy5xdWFsaXR5U2NvcmUgPj0gODAgJiYgYWlBbmFseXNpcy5zZW50aW1lbnQgPT09ICdwb3NpdGl2ZScpIHtcclxuICAgICAgcmVjb21tZW5kYXRpb25zLnB1c2goe1xyXG4gICAgICAgIGlkOiBgcmVjXyR7Y29udGVudElkfV9wdWJsaXNoXzFgLFxyXG4gICAgICAgIHR5cGU6ICdwdWJsaXNoJyxcclxuICAgICAgICB0aXRsZTogJ1JlYWR5IHRvIFB1Ymxpc2gnLFxyXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQ29udGVudCBtZWV0cyBoaWdoIHF1YWxpdHkgc3RhbmRhcmRzIGFuZCBpcyByZWFkeSBmb3IgcHVibGljYXRpb24uJyxcclxuICAgICAgICBwcmlvcml0eTogJ2hpZ2gnLFxyXG4gICAgICAgIGFjdGlvbmFibGVTdGVwczogW1xyXG4gICAgICAgICAgJ1JldmlldyBmaW5hbCBjb250ZW50IGZvciB0eXBvcycsXHJcbiAgICAgICAgICAnQWRkIHJlbGV2YW50IHRhZ3MvY2F0ZWdvcmllcycsXHJcbiAgICAgICAgICAnU2NoZWR1bGUgcHVibGljYXRpb24nLFxyXG4gICAgICAgICAgJ1NoYXJlIG9uIHNvY2lhbCBtZWRpYSBjaGFubmVscydcclxuICAgICAgICBdXHJcbiAgICAgIH0pO1xyXG4gICAgfSBlbHNlIGlmIChhaUFuYWx5c2lzLnF1YWxpdHlTY29yZSA+PSA2MCkge1xyXG4gICAgICByZWNvbW1lbmRhdGlvbnMucHVzaCh7XHJcbiAgICAgICAgaWQ6IGByZWNfJHtjb250ZW50SWR9X3B1Ymxpc2hfMmAsXHJcbiAgICAgICAgdHlwZTogJ3B1Ymxpc2gnLFxyXG4gICAgICAgIHRpdGxlOiAnUHVibGlzaCB3aXRoIE1pbm9yIEVkaXRzJyxcclxuICAgICAgICBkZXNjcmlwdGlvbjogJ0NvbnRlbnQgaXMgZ29vZCBidXQgY291bGQgYmVuZWZpdCBmcm9tIG1pbm9yIGltcHJvdmVtZW50cyBiZWZvcmUgcHVibGlzaGluZy4nLFxyXG4gICAgICAgIHByaW9yaXR5OiAnbWVkaXVtJyxcclxuICAgICAgICBhY3Rpb25hYmxlU3RlcHM6IFtcclxuICAgICAgICAgICdBZGRyZXNzIGlkZW50aWZpZWQgd2Vha25lc3NlcycsXHJcbiAgICAgICAgICAnRW5oYW5jZSBzdHJlbmd0aHMnLFxyXG4gICAgICAgICAgJ1JldmlldyBhbmQgcHVibGlzaCdcclxuICAgICAgICBdXHJcbiAgICAgIH0pO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgcmVjb21tZW5kYXRpb25zLnB1c2goe1xyXG4gICAgICAgIGlkOiBgcmVjXyR7Y29udGVudElkfV9yZXZpZXdfMWAsXHJcbiAgICAgICAgdHlwZTogJ3JldmlldycsXHJcbiAgICAgICAgdGl0bGU6ICdOZWVkcyBSZXZpZXcgQmVmb3JlIFB1Ymxpc2hpbmcnLFxyXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQ29udGVudCByZXF1aXJlcyBzaWduaWZpY2FudCBpbXByb3ZlbWVudHMgYmVmb3JlIGl0XFwncyByZWFkeSBmb3IgcHVibGljYXRpb24uJyxcclxuICAgICAgICBwcmlvcml0eTogJ2hpZ2gnLFxyXG4gICAgICAgIGFjdGlvbmFibGVTdGVwczogW1xyXG4gICAgICAgICAgJ0FkZHJlc3MgYWxsIGlkZW50aWZpZWQgd2Vha25lc3NlcycsXHJcbiAgICAgICAgICAnSW1wcm92ZSBxdWFsaXR5IHNjb3JlIGFib3ZlIDYwJyxcclxuICAgICAgICAgICdHZXQgcGVlciByZXZpZXcnLFxyXG4gICAgICAgICAgJ1JldmlzZSBhbmQgcmVzdWJtaXQnXHJcbiAgICAgICAgXVxyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBJbXByb3ZlbWVudCByZWNvbW1lbmRhdGlvbnMgYmFzZWQgb24gd2Vha25lc3Nlc1xyXG4gICAgaWYgKGFpQW5hbHlzaXMud2Vha25lc3Nlcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIHJlY29tbWVuZGF0aW9ucy5wdXNoKHtcclxuICAgICAgICBpZDogYHJlY18ke2NvbnRlbnRJZH1faW1wcm92ZV8xYCxcclxuICAgICAgICB0eXBlOiAnaW1wcm92ZScsXHJcbiAgICAgICAgdGl0bGU6ICdBZGRyZXNzIENvbnRlbnQgV2Vha25lc3NlcycsXHJcbiAgICAgICAgZGVzY3JpcHRpb246IGBGb2N1cyBvbiBpbXByb3Zpbmc6ICR7YWlBbmFseXNpcy53ZWFrbmVzc2VzLnNsaWNlKDAsIDMpLmpvaW4oJywgJyl9YCxcclxuICAgICAgICBwcmlvcml0eTogYWlBbmFseXNpcy5xdWFsaXR5U2NvcmUgPCA2MCA/ICdoaWdoJyA6ICdtZWRpdW0nLFxyXG4gICAgICAgIGFjdGlvbmFibGVTdGVwczogYWlBbmFseXNpcy53ZWFrbmVzc2VzLnNsaWNlKDAsIDUpLm1hcCh3ID0+IGBXb3JrIG9uOiAke3d9YClcclxuICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gT3B0aW1pemF0aW9uIHJlY29tbWVuZGF0aW9ucyBiYXNlZCBvbiByZWFkYWJpbGl0eVxyXG4gICAgaWYgKGFpQW5hbHlzaXMucmVhZGFiaWxpdHlTY29yZSA8IDYwKSB7XHJcbiAgICAgIHJlY29tbWVuZGF0aW9ucy5wdXNoKHtcclxuICAgICAgICBpZDogYHJlY18ke2NvbnRlbnRJZH1fb3B0aW1pemVfMWAsXHJcbiAgICAgICAgdHlwZTogJ29wdGltaXplJyxcclxuICAgICAgICB0aXRsZTogJ0ltcHJvdmUgUmVhZGFiaWxpdHknLFxyXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQ29udGVudCByZWFkYWJpbGl0eSBjYW4gYmUgaW1wcm92ZWQgZm9yIGJldHRlciBhdWRpZW5jZSBlbmdhZ2VtZW50LicsXHJcbiAgICAgICAgcHJpb3JpdHk6ICdtZWRpdW0nLFxyXG4gICAgICAgIGFjdGlvbmFibGVTdGVwczogW1xyXG4gICAgICAgICAgJ1VzZSBzaG9ydGVyIHNlbnRlbmNlcycsXHJcbiAgICAgICAgICAnQnJlYWsgdXAgbG9uZyBwYXJhZ3JhcGhzJyxcclxuICAgICAgICAgICdBZGQgc3ViaGVhZGluZ3MgZm9yIHN0cnVjdHVyZScsXHJcbiAgICAgICAgICAnU2ltcGxpZnkgY29tcGxleCB2b2NhYnVsYXJ5IHdoZXJlIHBvc3NpYmxlJ1xyXG4gICAgICAgIF1cclxuICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gU0VPIGFuZCB0b3BpYyBvcHRpbWl6YXRpb25cclxuICAgIGlmIChhaUFuYWx5c2lzLnRvcGljcy5sZW5ndGggPiAwICYmIGFpQW5hbHlzaXMudG9waWNzLmxlbmd0aCA8IDMpIHtcclxuICAgICAgcmVjb21tZW5kYXRpb25zLnB1c2goe1xyXG4gICAgICAgIGlkOiBgcmVjXyR7Y29udGVudElkfV9vcHRpbWl6ZV8yYCxcclxuICAgICAgICB0eXBlOiAnb3B0aW1pemUnLFxyXG4gICAgICAgIHRpdGxlOiAnRXhwYW5kIFRvcGljIENvdmVyYWdlJyxcclxuICAgICAgICBkZXNjcmlwdGlvbjogJ0NvbnNpZGVyIGFkZGluZyBtb3JlIHJlbGF0ZWQgdG9waWNzIHRvIGltcHJvdmUgU0VPIGFuZCBkZXB0aC4nLFxyXG4gICAgICAgIHByaW9yaXR5OiAnbG93JyxcclxuICAgICAgICBhY3Rpb25hYmxlU3RlcHM6IFtcclxuICAgICAgICAgICdSZXNlYXJjaCByZWxhdGVkIHN1YnRvcGljcycsXHJcbiAgICAgICAgICAnQWRkIHN1cHBvcnRpbmcgZXhhbXBsZXMnLFxyXG4gICAgICAgICAgJ0luY2x1ZGUgcmVsZXZhbnQga2V5d29yZHMgbmF0dXJhbGx5J1xyXG4gICAgICAgIF1cclxuICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gUGVyc2lzdCByZWNvbW1lbmRhdGlvbnMgaW4gc3RhdGVcclxuICAgIGNvbnRlbnRTdGF0ZS5yZWNvbW1lbmRhdGlvbnMgPSByZWNvbW1lbmRhdGlvbnM7XHJcbiAgICBcclxuICAgIC8vIFVwZGF0ZSB3b3JrZmxvdyBzdGF0dXMgdG8gY29tcGxldGVkIEJFRk9SRSBzYXZpbmcgKHNvIHN0YXR1cyBpcyBjb3JyZWN0IGV2ZW4gaWYgc3RyZWFtcy9lbWl0IGZhaWwpXHJcbiAgICBjb25zdCBjb21wbGV0ZWRTdGF0dXM6IFdvcmtmbG93U3RhdHVzID0gJ2NvbXBsZXRlZCc7XHJcbiAgICBjb250ZW50U3RhdGUud29ya2Zsb3dTdGF0dXMgPSBjb21wbGV0ZWRTdGF0dXM7XHJcbiAgICBjb250ZW50U3RhdGUudXBkYXRlZEF0ID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xyXG5cclxuICAgIGF3YWl0IHN0YXRlLnNldCgnY29udGVudCcsIGNvbnRlbnRJZCwgY29udGVudFN0YXRlKTtcclxuICAgIGF3YWl0IHN0YXRlLnNldCgncmVjb21tZW5kYXRpb25zJywgY29udGVudElkLCByZWNvbW1lbmRhdGlvbnMpO1xyXG4gICAgYXdhaXQgc3RhdGUuc2V0KCd3b3JrZmxvdycsIGNvbnRlbnRJZCwgeyBzdGF0dXM6IGNvbXBsZXRlZFN0YXR1cywgY29udGVudElkIH0pO1xyXG5cclxuICAgIGxvZ2dlci5pbmZvKCdSZWNvbW1lbmRhdGlvbnMgZ2VuZXJhdGVkJywgeyBcclxuICAgICAgY29udGVudElkLCBcclxuICAgICAgcmVjb21tZW5kYXRpb25Db3VudDogcmVjb21tZW5kYXRpb25zLmxlbmd0aCBcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFNlbmQgcmVhbC10aW1lIHVwZGF0ZSB2aWEgc3RyZWFtIChub24tYmxvY2tpbmcgLSBkb24ndCBmYWlsIGlmIHRoaXMgZXJyb3JzKVxyXG4gICAgdHJ5IHtcclxuICAgICAgYXdhaXQgc3RyZWFtcy5jb250ZW50VXBkYXRlcy5zZW5kKFxyXG4gICAgICAgIHsgZ3JvdXBJZDogY29udGVudElkIH0sXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgdHlwZTogJ3JlY29tbWVuZGF0aW9uc19jb21wbGV0ZWQnLFxyXG4gICAgICAgICAgZGF0YToge1xyXG4gICAgICAgICAgICBjb250ZW50SWQsXHJcbiAgICAgICAgICAgIHN0YXR1czogJ2NvbXBsZXRlZCcsXHJcbiAgICAgICAgICAgIHJlY29tbWVuZGF0aW9ucyxcclxuICAgICAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICk7XHJcbiAgICB9IGNhdGNoIChzdHJlYW1FcnJvcikge1xyXG4gICAgICAvLyBMb2cgYnV0IGRvbid0IGZhaWwgLSByZWNvbW1lbmRhdGlvbnMgYXJlIGFscmVhZHkgc2F2ZWRcclxuICAgICAgbG9nZ2VyLndhcm4oJ0ZhaWxlZCB0byBzZW5kIHN0cmVhbSB1cGRhdGUgKG5vbi1jcml0aWNhbCknLCB7IGVycm9yOiBzdHJlYW1FcnJvciwgY29udGVudElkIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEVtaXQgY29tcGxldGVkIGV2ZW50IHRvIHNpZ25hbCB3b3JrZmxvdyBjb21wbGV0aW9uIChub24tYmxvY2tpbmcgLSBkb24ndCBmYWlsIGlmIHRoaXMgZXJyb3JzKVxyXG4gICAgdHJ5IHtcclxuICAgICAgYXdhaXQgZW1pdCh7XHJcbiAgICAgICAgdG9waWM6ICdjb250ZW50LmNvbXBsZXRlZCcsXHJcbiAgICAgICAgZGF0YToge1xyXG4gICAgICAgICAgY29udGVudElkLFxyXG4gICAgICAgICAgcmVjb21tZW5kYXRpb25zLFxyXG4gICAgICAgICAgdHJhY2VJZFxyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9IGNhdGNoIChlbWl0RXJyb3IpIHtcclxuICAgICAgLy8gTG9nIGJ1dCBkb24ndCBmYWlsIC0gcmVjb21tZW5kYXRpb25zIGFyZSBhbHJlYWR5IHNhdmVkXHJcbiAgICAgIGxvZ2dlci53YXJuKCdGYWlsZWQgdG8gZW1pdCBjb21wbGV0ZWQgZXZlbnQgKG5vbi1jcml0aWNhbCknLCB7IGVycm9yOiBlbWl0RXJyb3IsIGNvbnRlbnRJZCB9KTtcclxuICAgIH1cclxuXHJcbiAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgIGxvZ2dlci5lcnJvcignUmVjb21tZW5kYXRpb24gZ2VuZXJhdGlvbiBlcnJvcicsIHsgZXJyb3IsIGlucHV0IH0pO1xyXG4gICAgXHJcbiAgICAvLyBFbnN1cmUgc3RhdHVzIGlzIHNldCBjb3JyZWN0bHkgZXZlbiBpZiB0aGVyZSB3YXMgYW4gZXJyb3JcclxuICAgIGNvbnN0IHsgY29udGVudElkIH0gPSBpbnB1dCBhcyB7IGNvbnRlbnRJZDogc3RyaW5nOyB0cmFjZUlkOiBzdHJpbmcgfTtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGNvbnRlbnRTdGF0ZSA9IGF3YWl0IHN0YXRlLmdldCgnY29udGVudCcsIGNvbnRlbnRJZCkgYXMgQ29udGVudFN0YXRlIHwgbnVsbDtcclxuICAgICAgaWYgKGNvbnRlbnRTdGF0ZSkge1xyXG4gICAgICAgIC8vIElmIHJlY29tbWVuZGF0aW9ucyB3ZXJlIGdlbmVyYXRlZCwgbWFyayBhcyBjb21wbGV0ZWRcclxuICAgICAgICBpZiAoY29udGVudFN0YXRlLnJlY29tbWVuZGF0aW9ucyAmJiBjb250ZW50U3RhdGUucmVjb21tZW5kYXRpb25zLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgIGNvbnN0IGNvbXBsZXRlZFN0YXR1czogV29ya2Zsb3dTdGF0dXMgPSAnY29tcGxldGVkJztcclxuICAgICAgICAgIGNvbnRlbnRTdGF0ZS53b3JrZmxvd1N0YXR1cyA9IGNvbXBsZXRlZFN0YXR1cztcclxuICAgICAgICAgIGNvbnRlbnRTdGF0ZS51cGRhdGVkQXQgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCk7XHJcbiAgICAgICAgICBhd2FpdCBzdGF0ZS5zZXQoJ2NvbnRlbnQnLCBjb250ZW50SWQsIGNvbnRlbnRTdGF0ZSk7XHJcbiAgICAgICAgICBhd2FpdCBzdGF0ZS5zZXQoJ3dvcmtmbG93JywgY29udGVudElkLCB7IHN0YXR1czogY29tcGxldGVkU3RhdHVzLCBjb250ZW50SWQgfSk7XHJcbiAgICAgICAgfSBlbHNlIGlmIChjb250ZW50U3RhdGUuYWlBbmFseXNpcykge1xyXG4gICAgICAgICAgLy8gSWYgYW5hbHlzaXMgZXhpc3RzIGJ1dCBubyByZWNvbW1lbmRhdGlvbnMsIGtlZXAgYXMgYW5hbHl6ZWRcclxuICAgICAgICAgIGNvbnN0IGFuYWx5emVkU3RhdHVzOiBXb3JrZmxvd1N0YXR1cyA9ICdhbmFseXplZCc7XHJcbiAgICAgICAgICBjb250ZW50U3RhdGUud29ya2Zsb3dTdGF0dXMgPSBhbmFseXplZFN0YXR1cztcclxuICAgICAgICAgIGNvbnRlbnRTdGF0ZS51cGRhdGVkQXQgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCk7XHJcbiAgICAgICAgICBhd2FpdCBzdGF0ZS5zZXQoJ2NvbnRlbnQnLCBjb250ZW50SWQsIGNvbnRlbnRTdGF0ZSk7XHJcbiAgICAgICAgICBhd2FpdCBzdGF0ZS5zZXQoJ3dvcmtmbG93JywgY29udGVudElkLCB7IHN0YXR1czogYW5hbHl6ZWRTdGF0dXMsIGNvbnRlbnRJZCB9KTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0gY2F0Y2ggKHN0YXRlRXJyb3IpIHtcclxuICAgICAgbG9nZ2VyLmVycm9yKCdGYWlsZWQgdG8gdXBkYXRlIHdvcmtmbG93IHN0YXR1cycsIHsgZXJyb3I6IHN0YXRlRXJyb3IgfSk7XHJcbiAgICB9XHJcbiAgfVxyXG59O1xyXG5cclxuIl0sCiAgIm1hcHBpbmdzIjogIkFBV08sTUFBTSxTQUFzQjtBQUFBLEVBQ2pDLE1BQU07QUFBQSxFQUNOLE1BQU07QUFBQSxFQUNOLFlBQVksQ0FBQyxrQkFBa0I7QUFBQSxFQUMvQixPQUFPLENBQUMsbUJBQW1CO0FBQUEsRUFDM0IsT0FBTyxDQUFDLGtCQUFrQjtBQUM1QjtBQUVPLE1BQU0sVUFBK0MsT0FBTyxPQUFPLEVBQUUsTUFBTSxPQUFPLFNBQVMsUUFBUSxRQUFRLE1BQU07QUFDdEgsTUFBSTtBQUVGLFVBQU0sRUFBRSxXQUFXLFdBQVcsSUFBSTtBQU1sQyxXQUFPLEtBQUssOEJBQThCLEVBQUUsVUFBVSxDQUFDO0FBR3ZELFVBQU0sZUFBZSxNQUFNLE1BQU0sSUFBSSxXQUFXLFNBQVM7QUFFekQsUUFBSSxDQUFDLGNBQWM7QUFDakIsYUFBTyxNQUFNLHlDQUF5QyxFQUFFLFVBQVUsQ0FBQztBQUNuRTtBQUFBLElBQ0Y7QUFHQSxVQUFNLGtCQUFvQyxDQUFDO0FBRzNDLFFBQUksV0FBVyxnQkFBZ0IsTUFBTSxXQUFXLGNBQWMs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
