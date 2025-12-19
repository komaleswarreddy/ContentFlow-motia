import { Mistral } from "@mistralai/mistralai";
const config = {
  name: "GenerateImprovedContent",
  type: "event",
  subscribes: ["content.improvement.requested"],
  emits: ["content.improvement.completed"],
  flows: ["content-workflow"],
  infrastructure: {
    handler: { timeout: 60 },
    queue: { maxRetries: 2, visibilityTimeout: 90 }
  }
};
const handler = async (input, { emit, state, streams, logger, traceId }) => {
  const { contentId } = input;
  try {
    logger.info("Starting content improvement generation", { contentId });
    const mistralApiKey = process.env.MISTRAL_API_KEY;
    if (!mistralApiKey) {
      logger.error("MISTRAL_API_KEY not configured");
      throw new Error("MISTRAL_API_KEY environment variable is required");
    }
    const mistralClient = new Mistral({
      apiKey: mistralApiKey
    });
    const contentState = await state.get("content", contentId);
    if (!contentState) {
      logger.error("Content not found for improvement", { contentId });
      return;
    }
    if (!contentState.aiAnalysis) {
      logger.error("AI analysis not found - cannot generate improvement without analysis", { contentId });
      return;
    }
    const generatingStatus = {
      originalBody: contentState.body,
      improvedBody: "",
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      status: "generating"
    };
    contentState.improvedContent = generatingStatus;
    contentState.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await state.set("content", contentId, contentState);
    try {
      await streams.contentUpdates.send(
        { groupId: contentId },
        {
          type: "improvement_started",
          data: {
            contentId,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          }
        }
      );
    } catch (streamError) {
      logger.warn("Failed to send stream update (non-critical)", { error: streamError });
    }
    const { aiAnalysis } = contentState;
    const weaknessesContext = aiAnalysis.weaknesses.length > 0 ? `Areas to improve: ${aiAnalysis.weaknesses.join(", ")}.` : "";
    const strengthsContext = aiAnalysis.strengths.length > 0 ? `Preserve these strengths: ${aiAnalysis.strengths.join(", ")}.` : "";
    const prompt = `You are a professional editor. Your task is to improve the following content while preserving its original meaning, intent, and tone.

Original Content:
Title: ${contentState.title}
Body: ${contentState.body}

Analysis Insights:
- Current quality score: ${aiAnalysis.qualityScore}/100
- Readability score: ${aiAnalysis.readabilityScore}/100
- Sentiment: ${aiAnalysis.sentiment}
${weaknessesContext}
${strengthsContext}

Instructions:
1. Improve clarity, structure, and overall impact
2. Fix any grammatical or stylistic issues
3. Enhance readability without changing the core message
4. Do NOT add new ideas or change the meaning
5. Do NOT include any explanations or markdown formatting
6. Return ONLY the improved content text, nothing else

Improved content:`;
    let improvedBody;
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("AI API timeout after 50 seconds")), 5e4);
      });
      const chatPromise = mistralClient.chat.complete({
        model: "mistral-large-latest",
        messages: [
          {
            role: "system",
            content: "You are a professional content editor. You improve content while preserving meaning. Always respond with only the improved content, no explanations or formatting."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.4,
        maxTokens: 3e3
        // Reduced for faster response
      });
      const chatResponse = await Promise.race([chatPromise, timeoutPromise]);
      improvedBody = chatResponse.choices[0]?.message?.content || "";
      improvedBody = improvedBody.trim();
      if (improvedBody.startsWith("```")) {
        improvedBody = improvedBody.replace(/```[\w]*\n?/g, "").trim();
      }
    } catch (apiError) {
      logger.error("Mistral AI API call failed", { error: apiError, contentId });
      contentState.improvedContent = {
        originalBody: contentState.body,
        improvedBody: "",
        generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        status: "failed"
      };
      contentState.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      await state.set("content", contentId, contentState);
      throw apiError;
    }
    if (!improvedBody) {
      throw new Error("Empty response from AI");
    }
    const completedImprovement = {
      originalBody: contentState.body,
      improvedBody,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      status: "completed"
    };
    contentState.improvedContent = completedImprovement;
    contentState.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await state.set("content", contentId, contentState);
    logger.info("Content improvement generated successfully", { contentId });
    try {
      await streams.contentUpdates.send(
        { groupId: contentId },
        {
          type: "improvement_completed",
          data: {
            contentId,
            improvedContent: completedImprovement,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          }
        }
      );
    } catch (streamError) {
      logger.warn("Failed to send stream update (non-critical)", { error: streamError });
    }
    try {
      await emit({
        topic: "content.improvement.completed",
        data: {
          contentId,
          traceId
        }
      });
    } catch (emitError) {
      logger.warn("Failed to emit completion event (non-critical)", { error: emitError });
    }
  } catch (error) {
    logger.error("Content improvement generation failed", { error, contentId });
    try {
      const contentState = await state.get("content", contentId);
      if (contentState && contentState.improvedContent?.status === "generating") {
        contentState.improvedContent.status = "failed";
        contentState.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        await state.set("content", contentId, contentState);
      }
    } catch (stateError) {
      logger.error("Failed to update failure status", { error: stateError });
    }
  }
};
export {
  config,
  handler
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vLi4vc3JjL3N0ZXBzL2V2ZW50cy9nZW5lcmF0ZS1pbXByb3ZlZC1jb250ZW50LnN0ZXAudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qKlxuICogRXZlbnQgU3RlcDogR2VuZXJhdGUgSW1wcm92ZWQgQ29udGVudFxuICogXG4gKiBTdWJzY3JpYmVzIHRvIGNvbnRlbnQuaW1wcm92ZW1lbnQucmVxdWVzdGVkIGV2ZW50LCByZWFkcyBvcmlnaW5hbCBjb250ZW50XG4gKiBhbmQgQUkgYW5hbHlzaXMgZnJvbSBzdGF0ZSwgZ2VuZXJhdGVzIGFuIGltcHJvdmVkIHZlcnNpb24gdXNpbmcgTWlzdHJhbCBBSSxcbiAqIGFuZCBwZXJzaXN0cyB0aGUgaW1wcm92ZWQgY29udGVudCB3aXRob3V0IG92ZXJ3cml0aW5nIHRoZSBvcmlnaW5hbC5cbiAqL1xuXG5pbXBvcnQgeyBFdmVudENvbmZpZywgSGFuZGxlcnMgfSBmcm9tICdtb3RpYSc7XG5pbXBvcnQgeyBNaXN0cmFsIH0gZnJvbSAnQG1pc3RyYWxhaS9taXN0cmFsYWknO1xuaW1wb3J0IHR5cGUgeyBDb250ZW50U3RhdGUsIEltcHJvdmVkQ29udGVudCB9IGZyb20gJy4uLy4uL3R5cGVzL2luZGV4LmpzJztcblxuZXhwb3J0IGNvbnN0IGNvbmZpZzogRXZlbnRDb25maWcgPSB7XG4gIG5hbWU6ICdHZW5lcmF0ZUltcHJvdmVkQ29udGVudCcsXG4gIHR5cGU6ICdldmVudCcsXG4gIHN1YnNjcmliZXM6IFsnY29udGVudC5pbXByb3ZlbWVudC5yZXF1ZXN0ZWQnXSxcbiAgZW1pdHM6IFsnY29udGVudC5pbXByb3ZlbWVudC5jb21wbGV0ZWQnXSxcbiAgZmxvd3M6IFsnY29udGVudC13b3JrZmxvdyddLFxuICBpbmZyYXN0cnVjdHVyZToge1xuICAgIGhhbmRsZXI6IHsgdGltZW91dDogNjAgfSxcbiAgICBxdWV1ZTogeyBtYXhSZXRyaWVzOiAyLCB2aXNpYmlsaXR5VGltZW91dDogOTAgfVxuICB9XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlcjogSGFuZGxlcnNbJ0dlbmVyYXRlSW1wcm92ZWRDb250ZW50J10gPSBhc3luYyAoaW5wdXQsIHsgZW1pdCwgc3RhdGUsIHN0cmVhbXMsIGxvZ2dlciwgdHJhY2VJZCB9KSA9PiB7XG4gIGNvbnN0IHsgY29udGVudElkIH0gPSBpbnB1dCBhcyB7IGNvbnRlbnRJZDogc3RyaW5nOyB0cmFjZUlkOiBzdHJpbmcgfTtcblxuICB0cnkge1xuICAgIGxvZ2dlci5pbmZvKCdTdGFydGluZyBjb250ZW50IGltcHJvdmVtZW50IGdlbmVyYXRpb24nLCB7IGNvbnRlbnRJZCB9KTtcblxuICAgIC8vIEluaXRpYWxpemUgTWlzdHJhbCBBSSBjbGllbnRcbiAgICBjb25zdCBtaXN0cmFsQXBpS2V5ID0gcHJvY2Vzcy5lbnYuTUlTVFJBTF9BUElfS0VZO1xuICAgIGlmICghbWlzdHJhbEFwaUtleSkge1xuICAgICAgbG9nZ2VyLmVycm9yKCdNSVNUUkFMX0FQSV9LRVkgbm90IGNvbmZpZ3VyZWQnKTtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTUlTVFJBTF9BUElfS0VZIGVudmlyb25tZW50IHZhcmlhYmxlIGlzIHJlcXVpcmVkJyk7XG4gICAgfVxuXG4gICAgY29uc3QgbWlzdHJhbENsaWVudCA9IG5ldyBNaXN0cmFsKHtcbiAgICAgIGFwaUtleTogbWlzdHJhbEFwaUtleVxuICAgIH0pO1xuXG4gICAgLy8gUmVhZCBjb250ZW50IGZyb20gc3RhdGVcbiAgICBjb25zdCBjb250ZW50U3RhdGUgPSBhd2FpdCBzdGF0ZS5nZXQoJ2NvbnRlbnQnLCBjb250ZW50SWQpIGFzIENvbnRlbnRTdGF0ZSB8IG51bGw7XG5cbiAgICBpZiAoIWNvbnRlbnRTdGF0ZSkge1xuICAgICAgbG9nZ2VyLmVycm9yKCdDb250ZW50IG5vdCBmb3VuZCBmb3IgaW1wcm92ZW1lbnQnLCB7IGNvbnRlbnRJZCB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIWNvbnRlbnRTdGF0ZS5haUFuYWx5c2lzKSB7XG4gICAgICBsb2dnZXIuZXJyb3IoJ0FJIGFuYWx5c2lzIG5vdCBmb3VuZCAtIGNhbm5vdCBnZW5lcmF0ZSBpbXByb3ZlbWVudCB3aXRob3V0IGFuYWx5c2lzJywgeyBjb250ZW50SWQgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gTWFyayBpbXByb3ZlbWVudCBhcyBnZW5lcmF0aW5nIChwcmVzZXJ2ZSBvcmlnaW5hbCBib2R5IGZvciBjb21wYXJpc29uKVxuICAgIGNvbnN0IGdlbmVyYXRpbmdTdGF0dXM6IEltcHJvdmVkQ29udGVudCA9IHtcbiAgICAgIG9yaWdpbmFsQm9keTogY29udGVudFN0YXRlLmJvZHksXG4gICAgICBpbXByb3ZlZEJvZHk6ICcnLFxuICAgICAgZ2VuZXJhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgIHN0YXR1czogJ2dlbmVyYXRpbmcnXG4gICAgfTtcbiAgICBjb250ZW50U3RhdGUuaW1wcm92ZWRDb250ZW50ID0gZ2VuZXJhdGluZ1N0YXR1cztcbiAgICBjb250ZW50U3RhdGUudXBkYXRlZEF0ID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuICAgIGF3YWl0IHN0YXRlLnNldCgnY29udGVudCcsIGNvbnRlbnRJZCwgY29udGVudFN0YXRlKTtcblxuICAgIC8vIFNlbmQgcmVhbC10aW1lIHVwZGF0ZVxuICAgIHRyeSB7XG4gICAgICBhd2FpdCBzdHJlYW1zLmNvbnRlbnRVcGRhdGVzLnNlbmQoXG4gICAgICAgIHsgZ3JvdXBJZDogY29udGVudElkIH0sXG4gICAgICAgIHtcbiAgICAgICAgICB0eXBlOiAnaW1wcm92ZW1lbnRfc3RhcnRlZCcsXG4gICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgY29udGVudElkLFxuICAgICAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICk7XG4gICAgfSBjYXRjaCAoc3RyZWFtRXJyb3IpIHtcbiAgICAgIGxvZ2dlci53YXJuKCdGYWlsZWQgdG8gc2VuZCBzdHJlYW0gdXBkYXRlIChub24tY3JpdGljYWwpJywgeyBlcnJvcjogc3RyZWFtRXJyb3IgfSk7XG4gICAgfVxuXG4gICAgLy8gQnVpbGQgaW1wcm92ZW1lbnQgcHJvbXB0IHVzaW5nIGFuYWx5c2lzIGluc2lnaHRzXG4gICAgY29uc3QgeyBhaUFuYWx5c2lzIH0gPSBjb250ZW50U3RhdGU7XG4gICAgY29uc3Qgd2Vha25lc3Nlc0NvbnRleHQgPSBhaUFuYWx5c2lzLndlYWtuZXNzZXMubGVuZ3RoID4gMCBcbiAgICAgID8gYEFyZWFzIHRvIGltcHJvdmU6ICR7YWlBbmFseXNpcy53ZWFrbmVzc2VzLmpvaW4oJywgJyl9LmAgXG4gICAgICA6ICcnO1xuICAgIGNvbnN0IHN0cmVuZ3Roc0NvbnRleHQgPSBhaUFuYWx5c2lzLnN0cmVuZ3Rocy5sZW5ndGggPiAwIFxuICAgICAgPyBgUHJlc2VydmUgdGhlc2Ugc3RyZW5ndGhzOiAke2FpQW5hbHlzaXMuc3RyZW5ndGhzLmpvaW4oJywgJyl9LmAgXG4gICAgICA6ICcnO1xuXG4gICAgY29uc3QgcHJvbXB0ID0gYFlvdSBhcmUgYSBwcm9mZXNzaW9uYWwgZWRpdG9yLiBZb3VyIHRhc2sgaXMgdG8gaW1wcm92ZSB0aGUgZm9sbG93aW5nIGNvbnRlbnQgd2hpbGUgcHJlc2VydmluZyBpdHMgb3JpZ2luYWwgbWVhbmluZywgaW50ZW50LCBhbmQgdG9uZS5cblxuT3JpZ2luYWwgQ29udGVudDpcblRpdGxlOiAke2NvbnRlbnRTdGF0ZS50aXRsZX1cbkJvZHk6ICR7Y29udGVudFN0YXRlLmJvZHl9XG5cbkFuYWx5c2lzIEluc2lnaHRzOlxuLSBDdXJyZW50IHF1YWxpdHkgc2NvcmU6ICR7YWlBbmFseXNpcy5xdWFsaXR5U2NvcmV9LzEwMFxuLSBSZWFkYWJpbGl0eSBzY29yZTogJHthaUFuYWx5c2lzLnJlYWRhYmlsaXR5U2NvcmV9LzEwMFxuLSBTZW50aW1lbnQ6ICR7YWlBbmFseXNpcy5zZW50aW1lbnR9XG4ke3dlYWtuZXNzZXNDb250ZXh0fVxuJHtzdHJlbmd0aHNDb250ZXh0fVxuXG5JbnN0cnVjdGlvbnM6XG4xLiBJbXByb3ZlIGNsYXJpdHksIHN0cnVjdHVyZSwgYW5kIG92ZXJhbGwgaW1wYWN0XG4yLiBGaXggYW55IGdyYW1tYXRpY2FsIG9yIHN0eWxpc3RpYyBpc3N1ZXNcbjMuIEVuaGFuY2UgcmVhZGFiaWxpdHkgd2l0aG91dCBjaGFuZ2luZyB0aGUgY29yZSBtZXNzYWdlXG40LiBEbyBOT1QgYWRkIG5ldyBpZGVhcyBvciBjaGFuZ2UgdGhlIG1lYW5pbmdcbjUuIERvIE5PVCBpbmNsdWRlIGFueSBleHBsYW5hdGlvbnMgb3IgbWFya2Rvd24gZm9ybWF0dGluZ1xuNi4gUmV0dXJuIE9OTFkgdGhlIGltcHJvdmVkIGNvbnRlbnQgdGV4dCwgbm90aGluZyBlbHNlXG5cbkltcHJvdmVkIGNvbnRlbnQ6YDtcblxuICAgIC8vIENhbGwgTWlzdHJhbCBBSSBBUEkgd2l0aCB0aW1lb3V0XG4gICAgbGV0IGltcHJvdmVkQm9keTogc3RyaW5nO1xuICAgIHRyeSB7XG4gICAgICAvLyBDcmVhdGUgYSBwcm9taXNlIHRoYXQgcmVqZWN0cyBhZnRlciB0aW1lb3V0XG4gICAgICBjb25zdCB0aW1lb3V0UHJvbWlzZSA9IG5ldyBQcm9taXNlPG5ldmVyPigoXywgcmVqZWN0KSA9PiB7XG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4gcmVqZWN0KG5ldyBFcnJvcignQUkgQVBJIHRpbWVvdXQgYWZ0ZXIgNTAgc2Vjb25kcycpKSwgNTAwMDApO1xuICAgICAgfSk7XG4gICAgICBcbiAgICAgIGNvbnN0IGNoYXRQcm9taXNlID0gbWlzdHJhbENsaWVudC5jaGF0LmNvbXBsZXRlKHtcbiAgICAgICAgbW9kZWw6ICdtaXN0cmFsLWxhcmdlLWxhdGVzdCcsXG4gICAgICAgIG1lc3NhZ2VzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgcm9sZTogJ3N5c3RlbScsXG4gICAgICAgICAgICBjb250ZW50OiAnWW91IGFyZSBhIHByb2Zlc3Npb25hbCBjb250ZW50IGVkaXRvci4gWW91IGltcHJvdmUgY29udGVudCB3aGlsZSBwcmVzZXJ2aW5nIG1lYW5pbmcuIEFsd2F5cyByZXNwb25kIHdpdGggb25seSB0aGUgaW1wcm92ZWQgY29udGVudCwgbm8gZXhwbGFuYXRpb25zIG9yIGZvcm1hdHRpbmcuJ1xuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgcm9sZTogJ3VzZXInLFxuICAgICAgICAgICAgY29udGVudDogcHJvbXB0XG4gICAgICAgICAgfVxuICAgICAgICBdLFxuICAgICAgICB0ZW1wZXJhdHVyZTogMC40LFxuICAgICAgICBtYXhUb2tlbnM6IDMwMDAgLy8gUmVkdWNlZCBmb3IgZmFzdGVyIHJlc3BvbnNlXG4gICAgICB9KTtcblxuICAgICAgY29uc3QgY2hhdFJlc3BvbnNlID0gYXdhaXQgUHJvbWlzZS5yYWNlKFtjaGF0UHJvbWlzZSwgdGltZW91dFByb21pc2VdKTtcbiAgICAgIGltcHJvdmVkQm9keSA9IGNoYXRSZXNwb25zZS5jaG9pY2VzWzBdPy5tZXNzYWdlPy5jb250ZW50IHx8ICcnO1xuICAgICAgXG4gICAgICAvLyBDbGVhbiByZXNwb25zZVxuICAgICAgaW1wcm92ZWRCb2R5ID0gaW1wcm92ZWRCb2R5LnRyaW0oKTtcbiAgICAgIGlmIChpbXByb3ZlZEJvZHkuc3RhcnRzV2l0aCgnYGBgJykpIHtcbiAgICAgICAgaW1wcm92ZWRCb2R5ID0gaW1wcm92ZWRCb2R5LnJlcGxhY2UoL2BgYFtcXHddKlxcbj8vZywgJycpLnRyaW0oKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChhcGlFcnJvcikge1xuICAgICAgbG9nZ2VyLmVycm9yKCdNaXN0cmFsIEFJIEFQSSBjYWxsIGZhaWxlZCcsIHsgZXJyb3I6IGFwaUVycm9yLCBjb250ZW50SWQgfSk7XG4gICAgICBcbiAgICAgIC8vIE1hcmsgYXMgZmFpbGVkXG4gICAgICBjb250ZW50U3RhdGUuaW1wcm92ZWRDb250ZW50ID0ge1xuICAgICAgICBvcmlnaW5hbEJvZHk6IGNvbnRlbnRTdGF0ZS5ib2R5LFxuICAgICAgICBpbXByb3ZlZEJvZHk6ICcnLFxuICAgICAgICBnZW5lcmF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICBzdGF0dXM6ICdmYWlsZWQnXG4gICAgICB9O1xuICAgICAgY29udGVudFN0YXRlLnVwZGF0ZWRBdCA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcbiAgICAgIGF3YWl0IHN0YXRlLnNldCgnY29udGVudCcsIGNvbnRlbnRJZCwgY29udGVudFN0YXRlKTtcbiAgICAgIFxuICAgICAgdGhyb3cgYXBpRXJyb3I7XG4gICAgfVxuXG4gICAgaWYgKCFpbXByb3ZlZEJvZHkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRW1wdHkgcmVzcG9uc2UgZnJvbSBBSScpO1xuICAgIH1cblxuICAgIC8vIFBlcnNpc3QgaW1wcm92ZWQgY29udGVudCAoa2VlcCBvcmlnaW5hbCBib2R5IGZvciBjb21wYXJpc29uKVxuICAgIGNvbnN0IGNvbXBsZXRlZEltcHJvdmVtZW50OiBJbXByb3ZlZENvbnRlbnQgPSB7XG4gICAgICBvcmlnaW5hbEJvZHk6IGNvbnRlbnRTdGF0ZS5ib2R5LFxuICAgICAgaW1wcm92ZWRCb2R5LFxuICAgICAgZ2VuZXJhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgIHN0YXR1czogJ2NvbXBsZXRlZCdcbiAgICB9O1xuICAgIGNvbnRlbnRTdGF0ZS5pbXByb3ZlZENvbnRlbnQgPSBjb21wbGV0ZWRJbXByb3ZlbWVudDtcbiAgICBjb250ZW50U3RhdGUudXBkYXRlZEF0ID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuICAgIGF3YWl0IHN0YXRlLnNldCgnY29udGVudCcsIGNvbnRlbnRJZCwgY29udGVudFN0YXRlKTtcblxuICAgIGxvZ2dlci5pbmZvKCdDb250ZW50IGltcHJvdmVtZW50IGdlbmVyYXRlZCBzdWNjZXNzZnVsbHknLCB7IGNvbnRlbnRJZCB9KTtcblxuICAgIC8vIFNlbmQgcmVhbC10aW1lIHVwZGF0ZVxuICAgIHRyeSB7XG4gICAgICBhd2FpdCBzdHJlYW1zLmNvbnRlbnRVcGRhdGVzLnNlbmQoXG4gICAgICAgIHsgZ3JvdXBJZDogY29udGVudElkIH0sXG4gICAgICAgIHtcbiAgICAgICAgICB0eXBlOiAnaW1wcm92ZW1lbnRfY29tcGxldGVkJyxcbiAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICBjb250ZW50SWQsXG4gICAgICAgICAgICBpbXByb3ZlZENvbnRlbnQ6IGNvbXBsZXRlZEltcHJvdmVtZW50LFxuICAgICAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICk7XG4gICAgfSBjYXRjaCAoc3RyZWFtRXJyb3IpIHtcbiAgICAgIGxvZ2dlci53YXJuKCdGYWlsZWQgdG8gc2VuZCBzdHJlYW0gdXBkYXRlIChub24tY3JpdGljYWwpJywgeyBlcnJvcjogc3RyZWFtRXJyb3IgfSk7XG4gICAgfVxuXG4gICAgLy8gRW1pdCBjb21wbGV0aW9uIGV2ZW50XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGVtaXQoe1xuICAgICAgICB0b3BpYzogJ2NvbnRlbnQuaW1wcm92ZW1lbnQuY29tcGxldGVkJyxcbiAgICAgICAgZGF0YToge1xuICAgICAgICAgIGNvbnRlbnRJZCxcbiAgICAgICAgICB0cmFjZUlkXG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGVtaXRFcnJvcikge1xuICAgICAgbG9nZ2VyLndhcm4oJ0ZhaWxlZCB0byBlbWl0IGNvbXBsZXRpb24gZXZlbnQgKG5vbi1jcml0aWNhbCknLCB7IGVycm9yOiBlbWl0RXJyb3IgfSk7XG4gICAgfVxuXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgbG9nZ2VyLmVycm9yKCdDb250ZW50IGltcHJvdmVtZW50IGdlbmVyYXRpb24gZmFpbGVkJywgeyBlcnJvciwgY29udGVudElkIH0pO1xuICAgIFxuICAgIC8vIEVuc3VyZSBzdGF0ZSByZWZsZWN0cyBmYWlsdXJlXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGNvbnRlbnRTdGF0ZSA9IGF3YWl0IHN0YXRlLmdldCgnY29udGVudCcsIGNvbnRlbnRJZCkgYXMgQ29udGVudFN0YXRlIHwgbnVsbDtcbiAgICAgIGlmIChjb250ZW50U3RhdGUgJiYgY29udGVudFN0YXRlLmltcHJvdmVkQ29udGVudD8uc3RhdHVzID09PSAnZ2VuZXJhdGluZycpIHtcbiAgICAgICAgY29udGVudFN0YXRlLmltcHJvdmVkQ29udGVudC5zdGF0dXMgPSAnZmFpbGVkJztcbiAgICAgICAgY29udGVudFN0YXRlLnVwZGF0ZWRBdCA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcbiAgICAgICAgYXdhaXQgc3RhdGUuc2V0KCdjb250ZW50JywgY29udGVudElkLCBjb250ZW50U3RhdGUpO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKHN0YXRlRXJyb3IpIHtcbiAgICAgIGxvZ2dlci5lcnJvcignRmFpbGVkIHRvIHVwZGF0ZSBmYWlsdXJlIHN0YXR1cycsIHsgZXJyb3I6IHN0YXRlRXJyb3IgfSk7XG4gICAgfVxuICB9XG59O1xuXG4iXSwKICAibWFwcGluZ3MiOiAiQUFTQSxTQUFTLGVBQWU7QUFHakIsTUFBTSxTQUFzQjtBQUFBLEVBQ2pDLE1BQU07QUFBQSxFQUNOLE1BQU07QUFBQSxFQUNOLFlBQVksQ0FBQywrQkFBK0I7QUFBQSxFQUM1QyxPQUFPLENBQUMsK0JBQStCO0FBQUEsRUFDdkMsT0FBTyxDQUFDLGtCQUFrQjtBQUFBLEVBQzFCLGdCQUFnQjtBQUFBLElBQ2QsU0FBUyxFQUFFLFNBQVMsR0FBRztBQUFBLElBQ3ZCLE9BQU8sRUFBRSxZQUFZLEdBQUcsbUJBQW1CLEdBQUc7QUFBQSxFQUNoRDtBQUNGO0FBRU8sTUFBTSxVQUErQyxPQUFPLE9BQU8sRUFBRSxNQUFNLE9BQU8s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
