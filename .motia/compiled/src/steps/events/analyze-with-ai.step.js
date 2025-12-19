import { Mistral } from "@mistralai/mistralai";
const config = {
  name: "AnalyzeWithAI",
  type: "event",
  subscribes: ["content.validated"],
  emits: ["content.analyzed"],
  flows: ["content-workflow"],
  infrastructure: {
    handler: { timeout: 60 },
    // Increased timeout for AI operations
    queue: { maxRetries: 2, visibilityTimeout: 90 }
    // Reduced retries for faster failure
  }
};
const handler = async (input, { emit, state, streams, logger, traceId }) => {
  try {
    const { contentId } = input;
    logger.info("Starting AI analysis", { contentId });
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
      logger.error("Content not found for AI analysis", { contentId });
      return;
    }
    const analyzingStatus = "analyzing";
    contentState.workflowStatus = analyzingStatus;
    contentState.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await state.set("content", contentId, contentState);
    await state.set("workflow", contentId, { status: analyzingStatus, contentId });
    const prompt = `Analyze the following content and return ONLY a valid JSON object with no markdown, no explanations, just pure JSON:

Title: ${contentState.title}
Language: ${contentState.language}
Content: ${contentState.body}

Return a JSON object with this exact structure:
{
  "sentiment": "positive" | "neutral" | "negative",
  "topics": ["topic1", "topic2", ...],
  "readabilityScore": number (0-100),
  "wordCount": number,
  "qualityScore": number (0-100),
  "summary": "brief summary of the content",
  "strengths": ["strength1", "strength2", ...],
  "weaknesses": ["weakness1", "weakness2", ...]
}

Only return the JSON object, nothing else.`;
    let aiResponse;
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("AI API timeout after 45 seconds")), 45e3);
      });
      const chatPromise = mistralClient.chat.complete({
        model: "mistral-large-latest",
        messages: [
          {
            role: "system",
            content: "You are a content analysis expert. Always respond with valid JSON only, no markdown formatting, no explanations."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        maxTokens: 1500
        // Reduced for faster response
      });
      const chatResponse = await Promise.race([chatPromise, timeoutPromise]);
      aiResponse = chatResponse.choices[0]?.message?.content || "";
    } catch (apiError) {
      logger.error("Mistral AI API call failed", { error: apiError, contentId });
      throw apiError;
    }
    let analysisData;
    try {
      let cleanedResponse = aiResponse.trim();
      if (cleanedResponse.startsWith("```json")) {
        cleanedResponse = cleanedResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "");
      } else if (cleanedResponse.startsWith("```")) {
        cleanedResponse = cleanedResponse.replace(/```\n?/g, "");
      }
      analysisData = JSON.parse(cleanedResponse);
    } catch (parseError) {
      logger.error("Failed to parse AI response as JSON", {
        error: parseError,
        response: aiResponse.substring(0, 500),
        contentId
      });
      analysisData = {
        sentiment: "neutral",
        topics: [],
        readabilityScore: 50,
        wordCount: contentState.body.split(/\s+/).length,
        qualityScore: 50,
        summary: contentState.body.substring(0, 200) + "...",
        strengths: [],
        weaknesses: []
      };
    }
    const aiAnalysis = {
      sentiment: analysisData.sentiment || "neutral",
      topics: Array.isArray(analysisData.topics) ? analysisData.topics : [],
      readabilityScore: typeof analysisData.readabilityScore === "number" ? Math.max(0, Math.min(100, analysisData.readabilityScore)) : 50,
      wordCount: typeof analysisData.wordCount === "number" ? analysisData.wordCount : contentState.body.split(/\s+/).length,
      qualityScore: typeof analysisData.qualityScore === "number" ? Math.max(0, Math.min(100, analysisData.qualityScore)) : 50,
      summary: typeof analysisData.summary === "string" && analysisData.summary.length > 0 ? analysisData.summary : contentState.body.substring(0, 200) + "...",
      strengths: Array.isArray(analysisData.strengths) ? analysisData.strengths : [],
      weaknesses: Array.isArray(analysisData.weaknesses) ? analysisData.weaknesses : [],
      analyzedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    contentState.aiAnalysis = aiAnalysis;
    const analyzedStatus = "analyzed";
    contentState.workflowStatus = analyzedStatus;
    contentState.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    await state.set("content", contentId, contentState);
    await state.set("ai_analysis", contentId, aiAnalysis);
    await state.set("workflow", contentId, { status: analyzedStatus, contentId });
    logger.info("AI analysis completed", {
      contentId,
      sentiment: aiAnalysis.sentiment,
      qualityScore: aiAnalysis.qualityScore
    });
    try {
      await streams.contentUpdates.send(
        { groupId: contentId },
        {
          type: "analysis_completed",
          data: {
            contentId,
            status: "analyzed",
            analysis: aiAnalysis,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          }
        }
      );
    } catch (streamError) {
      logger.warn("Failed to send stream update (non-critical)", { error: streamError, contentId });
    }
    try {
      await emit({
        topic: "content.analyzed",
        data: {
          contentId,
          aiAnalysis,
          traceId
        }
      });
    } catch (emitError) {
      logger.warn("Failed to emit analyzed event (non-critical)", { error: emitError, contentId });
    }
  } catch (error) {
    logger.error("AI analysis error", { error, input });
    const { contentId } = input;
    try {
      const contentState = await state.get("content", contentId);
      if (contentState) {
        if (!contentState.aiAnalysis) {
          const failedStatus = "failed";
          contentState.workflowStatus = failedStatus;
          contentState.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
          await state.set("content", contentId, contentState);
          await state.set("workflow", contentId, { status: failedStatus, contentId });
        } else {
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vLi4vc3JjL3N0ZXBzL2V2ZW50cy9hbmFseXplLXdpdGgtYWkuc3RlcC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyoqXG4gKiBFdmVudCBTdGVwOiBBbmFseXplIENvbnRlbnQgd2l0aCBBSVxuICogXG4gKiBTdWJzY3JpYmVzIHRvIGNvbnRlbnQudmFsaWRhdGVkIGV2ZW50LCByZWFkcyBjb250ZW50IGZyb20gc3RhdGUsXG4gKiBjYWxscyBNaXN0cmFsIEFJIEFQSSBmb3IgY29udGVudCBhbmFseXNpcywgcGFyc2VzIEpTT04gcmVzcG9uc2UsXG4gKiBhbmQgcGVyc2lzdHMgYW5hbHlzaXMgcmVzdWx0cyBiZWZvcmUgZW1pdHRpbmcgY29tcGxldGlvbiBldmVudC5cbiAqL1xuXG5pbXBvcnQgeyBFdmVudENvbmZpZywgSGFuZGxlcnMgfSBmcm9tICdtb3RpYSc7XG5pbXBvcnQgeyBNaXN0cmFsIH0gZnJvbSAnQG1pc3RyYWxhaS9taXN0cmFsYWknO1xuaW1wb3J0IHR5cGUgeyBDb250ZW50U3RhdGUsIEFJQW5hbHlzaXNSZXN1bHQsIFdvcmtmbG93U3RhdHVzIH0gZnJvbSAnLi4vLi4vdHlwZXMvaW5kZXguanMnO1xuXG5leHBvcnQgY29uc3QgY29uZmlnOiBFdmVudENvbmZpZyA9IHtcbiAgbmFtZTogJ0FuYWx5emVXaXRoQUknLFxuICB0eXBlOiAnZXZlbnQnLFxuICBzdWJzY3JpYmVzOiBbJ2NvbnRlbnQudmFsaWRhdGVkJ10sXG4gIGVtaXRzOiBbJ2NvbnRlbnQuYW5hbHl6ZWQnXSxcbiAgZmxvd3M6IFsnY29udGVudC13b3JrZmxvdyddLFxuICBpbmZyYXN0cnVjdHVyZToge1xuICAgIGhhbmRsZXI6IHsgdGltZW91dDogNjAgfSwgLy8gSW5jcmVhc2VkIHRpbWVvdXQgZm9yIEFJIG9wZXJhdGlvbnNcbiAgICBxdWV1ZTogeyBtYXhSZXRyaWVzOiAyLCB2aXNpYmlsaXR5VGltZW91dDogOTAgfSAvLyBSZWR1Y2VkIHJldHJpZXMgZm9yIGZhc3RlciBmYWlsdXJlXG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBoYW5kbGVyOiBIYW5kbGVyc1snQW5hbHl6ZVdpdGhBSSddID0gYXN5bmMgKGlucHV0LCB7IGVtaXQsIHN0YXRlLCBzdHJlYW1zLCBsb2dnZXIsIHRyYWNlSWQgfSkgPT4ge1xuICB0cnkge1xuICAgIC8vIEV2ZW50IGRhdGEgaXMgcGFzc2VkIGRpcmVjdGx5IG9uIGlucHV0LCBub3QgaW5wdXQuZGF0YVxuICAgIGNvbnN0IHsgY29udGVudElkIH0gPSBpbnB1dCBhcyB7IGNvbnRlbnRJZDogc3RyaW5nOyB0cmFjZUlkOiBzdHJpbmc7IHZhbGlkYXRpb25SZXN1bHQ/OiBhbnkgfTtcblxuICAgIGxvZ2dlci5pbmZvKCdTdGFydGluZyBBSSBhbmFseXNpcycsIHsgY29udGVudElkIH0pO1xuXG4gICAgLy8gSW5pdGlhbGl6ZSBNaXN0cmFsIEFJIGNsaWVudFxuICAgIGNvbnN0IG1pc3RyYWxBcGlLZXkgPSBwcm9jZXNzLmVudi5NSVNUUkFMX0FQSV9LRVk7XG4gICAgaWYgKCFtaXN0cmFsQXBpS2V5KSB7XG4gICAgICBsb2dnZXIuZXJyb3IoJ01JU1RSQUxfQVBJX0tFWSBub3QgY29uZmlndXJlZCcpO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdNSVNUUkFMX0FQSV9LRVkgZW52aXJvbm1lbnQgdmFyaWFibGUgaXMgcmVxdWlyZWQnKTtcbiAgICB9XG5cbiAgICBjb25zdCBtaXN0cmFsQ2xpZW50ID0gbmV3IE1pc3RyYWwoe1xuICAgICAgYXBpS2V5OiBtaXN0cmFsQXBpS2V5XG4gICAgfSk7XG5cbiAgICAvLyBSZWFkIGNvbnRlbnQgZnJvbSBzdGF0ZSAodXNlICdjb250ZW50JyBhcyBncm91cElkLCBub3QgdHJhY2VJZClcbiAgICBjb25zdCBjb250ZW50U3RhdGUgPSBhd2FpdCBzdGF0ZS5nZXQoJ2NvbnRlbnQnLCBjb250ZW50SWQpIGFzIENvbnRlbnRTdGF0ZSB8IG51bGw7XG5cbiAgICBpZiAoIWNvbnRlbnRTdGF0ZSkge1xuICAgICAgbG9nZ2VyLmVycm9yKCdDb250ZW50IG5vdCBmb3VuZCBmb3IgQUkgYW5hbHlzaXMnLCB7IGNvbnRlbnRJZCB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBVcGRhdGUgd29ya2Zsb3cgc3RhdHVzIHRvIGFuYWx5emluZ1xuICAgIGNvbnN0IGFuYWx5emluZ1N0YXR1czogV29ya2Zsb3dTdGF0dXMgPSAnYW5hbHl6aW5nJztcbiAgICBjb250ZW50U3RhdGUud29ya2Zsb3dTdGF0dXMgPSBhbmFseXppbmdTdGF0dXM7XG4gICAgY29udGVudFN0YXRlLnVwZGF0ZWRBdCA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcbiAgICBhd2FpdCBzdGF0ZS5zZXQoJ2NvbnRlbnQnLCBjb250ZW50SWQsIGNvbnRlbnRTdGF0ZSk7XG4gICAgYXdhaXQgc3RhdGUuc2V0KCd3b3JrZmxvdycsIGNvbnRlbnRJZCwgeyBzdGF0dXM6IGFuYWx5emluZ1N0YXR1cywgY29udGVudElkIH0pO1xuXG4gICAgLy8gQnVpbGQgc3RyaWN0IHByb21wdCByZXF1ZXN0aW5nIE9OTFkgdmFsaWQgSlNPTlxuICAgIGNvbnN0IHByb21wdCA9IGBBbmFseXplIHRoZSBmb2xsb3dpbmcgY29udGVudCBhbmQgcmV0dXJuIE9OTFkgYSB2YWxpZCBKU09OIG9iamVjdCB3aXRoIG5vIG1hcmtkb3duLCBubyBleHBsYW5hdGlvbnMsIGp1c3QgcHVyZSBKU09OOlxuXG5UaXRsZTogJHtjb250ZW50U3RhdGUudGl0bGV9XG5MYW5ndWFnZTogJHtjb250ZW50U3RhdGUubGFuZ3VhZ2V9XG5Db250ZW50OiAke2NvbnRlbnRTdGF0ZS5ib2R5fVxuXG5SZXR1cm4gYSBKU09OIG9iamVjdCB3aXRoIHRoaXMgZXhhY3Qgc3RydWN0dXJlOlxue1xuICBcInNlbnRpbWVudFwiOiBcInBvc2l0aXZlXCIgfCBcIm5ldXRyYWxcIiB8IFwibmVnYXRpdmVcIixcbiAgXCJ0b3BpY3NcIjogW1widG9waWMxXCIsIFwidG9waWMyXCIsIC4uLl0sXG4gIFwicmVhZGFiaWxpdHlTY29yZVwiOiBudW1iZXIgKDAtMTAwKSxcbiAgXCJ3b3JkQ291bnRcIjogbnVtYmVyLFxuICBcInF1YWxpdHlTY29yZVwiOiBudW1iZXIgKDAtMTAwKSxcbiAgXCJzdW1tYXJ5XCI6IFwiYnJpZWYgc3VtbWFyeSBvZiB0aGUgY29udGVudFwiLFxuICBcInN0cmVuZ3Roc1wiOiBbXCJzdHJlbmd0aDFcIiwgXCJzdHJlbmd0aDJcIiwgLi4uXSxcbiAgXCJ3ZWFrbmVzc2VzXCI6IFtcIndlYWtuZXNzMVwiLCBcIndlYWtuZXNzMlwiLCAuLi5dXG59XG5cbk9ubHkgcmV0dXJuIHRoZSBKU09OIG9iamVjdCwgbm90aGluZyBlbHNlLmA7XG5cbiAgICAvLyBDYWxsIE1pc3RyYWwgQUkgQVBJIHdpdGggdGltZW91dFxuICAgIGxldCBhaVJlc3BvbnNlOiBzdHJpbmc7XG4gICAgdHJ5IHtcbiAgICAgIC8vIENyZWF0ZSBhIHByb21pc2UgdGhhdCByZWplY3RzIGFmdGVyIHRpbWVvdXRcbiAgICAgIGNvbnN0IHRpbWVvdXRQcm9taXNlID0gbmV3IFByb21pc2U8bmV2ZXI+KChfLCByZWplY3QpID0+IHtcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiByZWplY3QobmV3IEVycm9yKCdBSSBBUEkgdGltZW91dCBhZnRlciA0NSBzZWNvbmRzJykpLCA0NTAwMCk7XG4gICAgICB9KTtcbiAgICAgIFxuICAgICAgY29uc3QgY2hhdFByb21pc2UgPSBtaXN0cmFsQ2xpZW50LmNoYXQuY29tcGxldGUoe1xuICAgICAgICBtb2RlbDogJ21pc3RyYWwtbGFyZ2UtbGF0ZXN0JyxcbiAgICAgICAgbWVzc2FnZXM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICByb2xlOiAnc3lzdGVtJyxcbiAgICAgICAgICAgIGNvbnRlbnQ6ICdZb3UgYXJlIGEgY29udGVudCBhbmFseXNpcyBleHBlcnQuIEFsd2F5cyByZXNwb25kIHdpdGggdmFsaWQgSlNPTiBvbmx5LCBubyBtYXJrZG93biBmb3JtYXR0aW5nLCBubyBleHBsYW5hdGlvbnMuJ1xuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgcm9sZTogJ3VzZXInLFxuICAgICAgICAgICAgY29udGVudDogcHJvbXB0XG4gICAgICAgICAgfVxuICAgICAgICBdLFxuICAgICAgICB0ZW1wZXJhdHVyZTogMC4zLFxuICAgICAgICBtYXhUb2tlbnM6IDE1MDAgLy8gUmVkdWNlZCBmb3IgZmFzdGVyIHJlc3BvbnNlXG4gICAgICB9KTtcblxuICAgICAgY29uc3QgY2hhdFJlc3BvbnNlID0gYXdhaXQgUHJvbWlzZS5yYWNlKFtjaGF0UHJvbWlzZSwgdGltZW91dFByb21pc2VdKTtcbiAgICAgIGFpUmVzcG9uc2UgPSBjaGF0UmVzcG9uc2UuY2hvaWNlc1swXT8ubWVzc2FnZT8uY29udGVudCB8fCAnJztcbiAgICB9IGNhdGNoIChhcGlFcnJvcikge1xuICAgICAgbG9nZ2VyLmVycm9yKCdNaXN0cmFsIEFJIEFQSSBjYWxsIGZhaWxlZCcsIHsgZXJyb3I6IGFwaUVycm9yLCBjb250ZW50SWQgfSk7XG4gICAgICB0aHJvdyBhcGlFcnJvcjtcbiAgICB9XG5cbiAgICAvLyBQYXJzZSBhbmQgdmFsaWRhdGUgQUkgSlNPTiBvdXRwdXRcbiAgICBsZXQgYW5hbHlzaXNEYXRhOiBQYXJ0aWFsPEFJQW5hbHlzaXNSZXN1bHQ+O1xuICAgIHRyeSB7XG4gICAgICAvLyBDbGVhbiByZXNwb25zZSAtIHJlbW92ZSBtYXJrZG93biBjb2RlIGJsb2NrcyBpZiBwcmVzZW50XG4gICAgICBsZXQgY2xlYW5lZFJlc3BvbnNlID0gYWlSZXNwb25zZS50cmltKCk7XG4gICAgICBpZiAoY2xlYW5lZFJlc3BvbnNlLnN0YXJ0c1dpdGgoJ2BgYGpzb24nKSkge1xuICAgICAgICBjbGVhbmVkUmVzcG9uc2UgPSBjbGVhbmVkUmVzcG9uc2UucmVwbGFjZSgvYGBganNvblxcbj8vZywgJycpLnJlcGxhY2UoL2BgYFxcbj8vZywgJycpO1xuICAgICAgfSBlbHNlIGlmIChjbGVhbmVkUmVzcG9uc2Uuc3RhcnRzV2l0aCgnYGBgJykpIHtcbiAgICAgICAgY2xlYW5lZFJlc3BvbnNlID0gY2xlYW5lZFJlc3BvbnNlLnJlcGxhY2UoL2BgYFxcbj8vZywgJycpO1xuICAgICAgfVxuXG4gICAgICBhbmFseXNpc0RhdGEgPSBKU09OLnBhcnNlKGNsZWFuZWRSZXNwb25zZSk7XG4gICAgfSBjYXRjaCAocGFyc2VFcnJvcikge1xuICAgICAgbG9nZ2VyLmVycm9yKCdGYWlsZWQgdG8gcGFyc2UgQUkgcmVzcG9uc2UgYXMgSlNPTicsIHsgXG4gICAgICAgIGVycm9yOiBwYXJzZUVycm9yLCBcbiAgICAgICAgcmVzcG9uc2U6IGFpUmVzcG9uc2Uuc3Vic3RyaW5nKDAsIDUwMCksXG4gICAgICAgIGNvbnRlbnRJZCBcbiAgICAgIH0pO1xuICAgICAgXG4gICAgICAvLyBGYWxsYmFjazogY3JlYXRlIGJhc2ljIGFuYWx5c2lzIGZyb20gY29udGVudFxuICAgICAgYW5hbHlzaXNEYXRhID0ge1xuICAgICAgICBzZW50aW1lbnQ6ICduZXV0cmFsJyBhcyBjb25zdCxcbiAgICAgICAgdG9waWNzOiBbXSxcbiAgICAgICAgcmVhZGFiaWxpdHlTY29yZTogNTAsXG4gICAgICAgIHdvcmRDb3VudDogY29udGVudFN0YXRlLmJvZHkuc3BsaXQoL1xccysvKS5sZW5ndGgsXG4gICAgICAgIHF1YWxpdHlTY29yZTogNTAsXG4gICAgICAgIHN1bW1hcnk6IGNvbnRlbnRTdGF0ZS5ib2R5LnN1YnN0cmluZygwLCAyMDApICsgJy4uLicsXG4gICAgICAgIHN0cmVuZ3RoczogW10sXG4gICAgICAgIHdlYWtuZXNzZXM6IFtdXG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIFZhbGlkYXRlIGFuZCBjb25zdHJ1Y3QgY29tcGxldGUgYW5hbHlzaXMgcmVzdWx0XG4gICAgY29uc3QgYWlBbmFseXNpczogQUlBbmFseXNpc1Jlc3VsdCA9IHtcbiAgICAgIHNlbnRpbWVudDogYW5hbHlzaXNEYXRhLnNlbnRpbWVudCB8fCAnbmV1dHJhbCcsXG4gICAgICB0b3BpY3M6IEFycmF5LmlzQXJyYXkoYW5hbHlzaXNEYXRhLnRvcGljcykgPyBhbmFseXNpc0RhdGEudG9waWNzIDogW10sXG4gICAgICByZWFkYWJpbGl0eVNjb3JlOiB0eXBlb2YgYW5hbHlzaXNEYXRhLnJlYWRhYmlsaXR5U2NvcmUgPT09ICdudW1iZXInIFxuICAgICAgICA/IE1hdGgubWF4KDAsIE1hdGgubWluKDEwMCwgYW5hbHlzaXNEYXRhLnJlYWRhYmlsaXR5U2NvcmUpKSBcbiAgICAgICAgOiA1MCxcbiAgICAgIHdvcmRDb3VudDogdHlwZW9mIGFuYWx5c2lzRGF0YS53b3JkQ291bnQgPT09ICdudW1iZXInIFxuICAgICAgICA/IGFuYWx5c2lzRGF0YS53b3JkQ291bnQgXG4gICAgICAgIDogY29udGVudFN0YXRlLmJvZHkuc3BsaXQoL1xccysvKS5sZW5ndGgsXG4gICAgICBxdWFsaXR5U2NvcmU6IHR5cGVvZiBhbmFseXNpc0RhdGEucXVhbGl0eVNjb3JlID09PSAnbnVtYmVyJyBcbiAgICAgICAgPyBNYXRoLm1heCgwLCBNYXRoLm1pbigxMDAsIGFuYWx5c2lzRGF0YS5xdWFsaXR5U2NvcmUpKSBcbiAgICAgICAgOiA1MCxcbiAgICAgIHN1bW1hcnk6IHR5cGVvZiBhbmFseXNpc0RhdGEuc3VtbWFyeSA9PT0gJ3N0cmluZycgJiYgYW5hbHlzaXNEYXRhLnN1bW1hcnkubGVuZ3RoID4gMFxuICAgICAgICA/IGFuYWx5c2lzRGF0YS5zdW1tYXJ5XG4gICAgICAgIDogY29udGVudFN0YXRlLmJvZHkuc3Vic3RyaW5nKDAsIDIwMCkgKyAnLi4uJyxcbiAgICAgIHN0cmVuZ3RoczogQXJyYXkuaXNBcnJheShhbmFseXNpc0RhdGEuc3RyZW5ndGhzKSA/IGFuYWx5c2lzRGF0YS5zdHJlbmd0aHMgOiBbXSxcbiAgICAgIHdlYWtuZXNzZXM6IEFycmF5LmlzQXJyYXkoYW5hbHlzaXNEYXRhLndlYWtuZXNzZXMpID8gYW5hbHlzaXNEYXRhLndlYWtuZXNzZXMgOiBbXSxcbiAgICAgIGFuYWx5emVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKVxuICAgIH07XG5cbiAgICAvLyBQZXJzaXN0IEFJIGFuYWx5c2lzIGluIHN0YXRlICh1c2UgZ3JvdXBJZCwgbm90IHRyYWNlSWQpXG4gICAgY29udGVudFN0YXRlLmFpQW5hbHlzaXMgPSBhaUFuYWx5c2lzO1xuICAgIFxuICAgIC8vIFVwZGF0ZSB3b3JrZmxvdyBzdGF0dXMgdG8gYW5hbHl6ZWQgQkVGT1JFIHNhdmluZyAoc28gc3RhdHVzIGlzIGNvcnJlY3QgZXZlbiBpZiBzdHJlYW1zL2VtaXQgZmFpbClcbiAgICBjb25zdCBhbmFseXplZFN0YXR1czogV29ya2Zsb3dTdGF0dXMgPSAnYW5hbHl6ZWQnO1xuICAgIGNvbnRlbnRTdGF0ZS53b3JrZmxvd1N0YXR1cyA9IGFuYWx5emVkU3RhdHVzO1xuICAgIGNvbnRlbnRTdGF0ZS51cGRhdGVkQXQgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCk7XG4gICAgYXdhaXQgc3RhdGUuc2V0KCdjb250ZW50JywgY29udGVudElkLCBjb250ZW50U3RhdGUpO1xuICAgIGF3YWl0IHN0YXRlLnNldCgnYWlfYW5hbHlzaXMnLCBjb250ZW50SWQsIGFpQW5hbHlzaXMpO1xuICAgIGF3YWl0IHN0YXRlLnNldCgnd29ya2Zsb3cnLCBjb250ZW50SWQsIHsgc3RhdHVzOiBhbmFseXplZFN0YXR1cywgY29udGVudElkIH0pO1xuXG4gICAgbG9nZ2VyLmluZm8oJ0FJIGFuYWx5c2lzIGNvbXBsZXRlZCcsIHsgXG4gICAgICBjb250ZW50SWQsIFxuICAgICAgc2VudGltZW50OiBhaUFuYWx5c2lzLnNlbnRpbWVudCxcbiAgICAgIHF1YWxpdHlTY29yZTogYWlBbmFseXNpcy5xdWFsaXR5U2NvcmUgXG4gICAgfSk7XG5cbiAgICAvLyBTZW5kIHJlYWwtdGltZSB1cGRhdGUgdmlhIHN0cmVhbSAobm9uLWJsb2NraW5nIC0gZG9uJ3QgZmFpbCBpZiB0aGlzIGVycm9ycylcbiAgICB0cnkge1xuICAgICAgYXdhaXQgc3RyZWFtcy5jb250ZW50VXBkYXRlcy5zZW5kKFxuICAgICAgICB7IGdyb3VwSWQ6IGNvbnRlbnRJZCB9LFxuICAgICAgICB7XG4gICAgICAgICAgdHlwZTogJ2FuYWx5c2lzX2NvbXBsZXRlZCcsXG4gICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgY29udGVudElkLFxuICAgICAgICAgICAgc3RhdHVzOiAnYW5hbHl6ZWQnLFxuICAgICAgICAgICAgYW5hbHlzaXM6IGFpQW5hbHlzaXMsXG4gICAgICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgKTtcbiAgICB9IGNhdGNoIChzdHJlYW1FcnJvcikge1xuICAgICAgLy8gTG9nIGJ1dCBkb24ndCBmYWlsIC0gYW5hbHlzaXMgaXMgYWxyZWFkeSBzYXZlZFxuICAgICAgbG9nZ2VyLndhcm4oJ0ZhaWxlZCB0byBzZW5kIHN0cmVhbSB1cGRhdGUgKG5vbi1jcml0aWNhbCknLCB7IGVycm9yOiBzdHJlYW1FcnJvciwgY29udGVudElkIH0pO1xuICAgIH1cblxuICAgIC8vIEVtaXQgYW5hbHl6ZWQgZXZlbnQgdG8gdHJpZ2dlciByZWNvbW1lbmRhdGlvbnMgKG5vbi1ibG9ja2luZyAtIGRvbid0IGZhaWwgaWYgdGhpcyBlcnJvcnMpXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGVtaXQoe1xuICAgICAgICB0b3BpYzogJ2NvbnRlbnQuYW5hbHl6ZWQnLFxuICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgY29udGVudElkLFxuICAgICAgICAgIGFpQW5hbHlzaXMsXG4gICAgICAgICAgdHJhY2VJZFxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlbWl0RXJyb3IpIHtcbiAgICAgIC8vIExvZyBidXQgZG9uJ3QgZmFpbCAtIGFuYWx5c2lzIGlzIGFscmVhZHkgc2F2ZWRcbiAgICAgIGxvZ2dlci53YXJuKCdGYWlsZWQgdG8gZW1pdCBhbmFseXplZCBldmVudCAobm9uLWNyaXRpY2FsKScsIHsgZXJyb3I6IGVtaXRFcnJvciwgY29udGVudElkIH0pO1xuICAgIH1cblxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGxvZ2dlci5lcnJvcignQUkgYW5hbHlzaXMgZXJyb3InLCB7IGVycm9yLCBpbnB1dCB9KTtcbiAgICBcbiAgICAvLyBPbmx5IHNldCB0byBmYWlsZWQgaWYgdGhlIGFjdHVhbCBhbmFseXNpcyBmYWlsZWQgKG5vdCBpZiBzdHJlYW1zL2VtaXQgZmFpbGVkKVxuICAgIGNvbnN0IHsgY29udGVudElkIH0gPSBpbnB1dCBhcyB7IGNvbnRlbnRJZDogc3RyaW5nOyB0cmFjZUlkOiBzdHJpbmcgfTtcbiAgICB0cnkge1xuICAgICAgY29uc3QgY29udGVudFN0YXRlID0gYXdhaXQgc3RhdGUuZ2V0KCdjb250ZW50JywgY29udGVudElkKSBhcyBDb250ZW50U3RhdGUgfCBudWxsO1xuICAgICAgaWYgKGNvbnRlbnRTdGF0ZSkge1xuICAgICAgICAvLyBPbmx5IG1hcmsgYXMgZmFpbGVkIGlmIGFuYWx5c2lzIHdhc24ndCBzYXZlZFxuICAgICAgICBpZiAoIWNvbnRlbnRTdGF0ZS5haUFuYWx5c2lzKSB7XG4gICAgICAgICAgY29uc3QgZmFpbGVkU3RhdHVzOiBXb3JrZmxvd1N0YXR1cyA9ICdmYWlsZWQnO1xuICAgICAgICAgIGNvbnRlbnRTdGF0ZS53b3JrZmxvd1N0YXR1cyA9IGZhaWxlZFN0YXR1cztcbiAgICAgICAgICBjb250ZW50U3RhdGUudXBkYXRlZEF0ID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuICAgICAgICAgIGF3YWl0IHN0YXRlLnNldCgnY29udGVudCcsIGNvbnRlbnRJZCwgY29udGVudFN0YXRlKTtcbiAgICAgICAgICBhd2FpdCBzdGF0ZS5zZXQoJ3dvcmtmbG93JywgY29udGVudElkLCB7IHN0YXR1czogZmFpbGVkU3RhdHVzLCBjb250ZW50SWQgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gQW5hbHlzaXMgd2FzIHNhdmVkLCBzbyBlbnN1cmUgc3RhdHVzIGlzICdhbmFseXplZCcgZXZlbiBpZiBzdHJlYW1zL2VtaXQgZmFpbGVkXG4gICAgICAgICAgY29uc3QgYW5hbHl6ZWRTdGF0dXM6IFdvcmtmbG93U3RhdHVzID0gJ2FuYWx5emVkJztcbiAgICAgICAgICBjb250ZW50U3RhdGUud29ya2Zsb3dTdGF0dXMgPSBhbmFseXplZFN0YXR1cztcbiAgICAgICAgICBjb250ZW50U3RhdGUudXBkYXRlZEF0ID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuICAgICAgICAgIGF3YWl0IHN0YXRlLnNldCgnY29udGVudCcsIGNvbnRlbnRJZCwgY29udGVudFN0YXRlKTtcbiAgICAgICAgICBhd2FpdCBzdGF0ZS5zZXQoJ3dvcmtmbG93JywgY29udGVudElkLCB7IHN0YXR1czogYW5hbHl6ZWRTdGF0dXMsIGNvbnRlbnRJZCB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gY2F0Y2ggKHN0YXRlRXJyb3IpIHtcbiAgICAgIGxvZ2dlci5lcnJvcignRmFpbGVkIHRvIHVwZGF0ZSB3b3JrZmxvdyBzdGF0dXMnLCB7IGVycm9yOiBzdGF0ZUVycm9yIH0pO1xuICAgIH1cbiAgfVxufTtcblxuIl0sCiAgIm1hcHBpbmdzIjogIkFBU0EsU0FBUyxlQUFlO0FBR2pCLE1BQU0sU0FBc0I7QUFBQSxFQUNqQyxNQUFNO0FBQUEsRUFDTixNQUFNO0FBQUEsRUFDTixZQUFZLENBQUMsbUJBQW1CO0FBQUEsRUFDaEMsT0FBTyxDQUFDLGtCQUFrQjtBQUFBLEVBQzFCLE9BQU8sQ0FBQyxrQkFBa0I7QUFBQSxFQUMxQixnQkFBZ0I7QUFBQSxJQUNkLFNBQVMsRUFBRSxTQUFTLEdBQUc7QUFBQTtBQUFBLElBQ3ZCLE9BQU8sRUFBRSxZQUFZLEdBQUcsbUJBQW1CLEdBQUc7QUFBQTtBQUFBLEVBQ2hEO0FBQ0Y7QUFFTyxNQUFNLFVBQXFDLE9BQU8sT0FBTyxFQUFFLE1BQU0sT0FBTyxTQUFTLFFBQVEsUUFBUSxNQUFNO0FBQzVHLE1BQUk7QUFFRixVQUFNLEVBQUUsVUFBVSxJQUFJO0FBRXRCLFdBQU8sS0FBSyx3QkFBd0IsRUFBRSxVQUFVLENBQUM7QUFHakQsVUFBTSxnQkFBZ0IsUUFBUSxJQUFJO0FBQ2xDLFFBQUksQ0FBQyxlQUFlO0FBQ2xCLGFBQU8sTUFBTSxnQ0FBZ0M7QUFDN0MsWUFBTSxJQUFJLE1BQU0sa0RBQWtEO0FBQUEsSUFDcEU7QUFFQSxVQUFNLGdCQUFnQixJQUFJLFFBQVE7QUFBQSxNQUNoQyxRQUFRO0FBQUEsSUFDVixDQUFDO0FBR0QsVUFBTSxlQUFlLE1BQU0sTUFBTSxJQUFJLFdBQVcsU0FBUztBQUV6RCxRQUFJLENBQUMsY0FBYztBQUNqQixhQUFPLE1BQU0scUNBQXFDLEVBQUUsVUFBVSxDQUFDO0FBQy9EO0FBQUEsSUFDRjtBQUdBLFVBQU0sa0JBQWtDO0FBQ3hDLGlCQUFhLGlCQUFpQjtBQUM5QixpQkFBYSxhQUFZLG9CQUFJLEtBQUssR0FBRSxZQUFZO0FBQ2hELFVBQU0sTUFBTSxJQUFJLFdBQVcsV0FBVyxZQUFZO0FBQ2xELFVBQU0sTUFBTSxJQUFJLFlBQVksV0FBVyxFQUFFLFFBQVEsaUJBQWlCLFVBQVUsQ0FBQztBQUc3RSxVQUFNLFNBQVM7QUFBQTtBQUFBLFNBRVYsYUFBYSxLQUFLO0FBQUEsWUFDZixhQUFhLFFBQVE7QUFBQSxXQUN0QixhQUFhLElBQUk7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBaUJ4QixRQUFJO0FBQ0osUUFBSTtBQUVGLFlBQU0saUJBQWlCLElBQUksUUFBZSxDQUFDLEdBQUcsV0FBVztBQUN2RCxtQkFBVyxNQUFNLE9BQU8sSUFBSSxNQUFNLGlDQUFpQyxDQUFDLEdBQUcsSUFBSztBQUFBLE1BQzlFLENBQUM7QUFFRCxZQUFNLGNBQWMsY0FBYyxLQUFLLFNBQVM7QUFBQSxRQUM5QyxPQUFPO0FBQUEsUUFDUCxVQUFVO0FBQUEsVUFDUjtBQUFBLFlBQ0UsTUFBTTtBQUFBLFlBQ04sU0FBUztBQUFBLFVBQ1g7QUFBQSxVQUNBO0FBQUEsWUFDRSxNQUFNO0FBQUEsWUFDTixTQUFTO0FBQUEsVUFDWDtBQUFBLFFBQ0Y7QUFBQSxRQUNBLGFBQWE7QUFBQSxRQUNiLFdBQVc7QUFBQTtBQUFBLE1BQ2IsQ0FBQztBQUVELFlBQU0sZUFBZSxNQUFNLFFBQVEsS0FBSyxDQUFDLGFBQWEsY0FBYyxDQUFDO0FBQ3JFLG1CQUFhLGFBQWEsUUFBUSxDQUFDLEdBQUcsU0FBUyxXQUFXO0FBQUEsSUFDNUQsU0FBUyxVQUFVO0FBQ2pCLGFBQU8sTUFBTSw4QkFBOEIsRUFBRSxPQUFPLFVBQVUsVUFBVSxDQUFDO0FBQ3pFLFlBQU07QUFBQSxJQUNSO0FBR0EsUUFBSTtBQUNKLFFBQUk7QUFFRixVQUFJLGtCQUFrQixXQUFXLEtBQUs7QUFDdEMsVUFBSSxnQkFBZ0IsV0FBVyxTQUFTLEdBQUc7QUFDekMsMEJBQWtCLGdCQUFnQixRQUFRLGVBQWUsRUFBRSxFQUFFLFFBQVEsV0FBVyxFQUFFO0FBQUEsTUFDcEYsV0FBVyxnQkFBZ0IsV0FBVyxLQUFLLEdBQUc7QUFDNUMsMEJBQWtCLGdCQUFnQixRQUFRLFdBQVcsRUFBRTtBQUFBLE1BQ3pEO0FBRUEscUJBQWUsS0FBSyxNQUFNLGVBQWU7QUFBQSxJQUMzQyxTQUFTLFlBQVk7QUFDbkIsYUFBTyxNQUFNLHVDQUF1QztBQUFBLFFBQ2xELE9BQU87QUFBQSxRQUNQLFVBQVUsV0FBVyxVQUFVLEdBQUcsR0FBRztBQUFBLFFBQ3JDO0FBQUEsTUFDRixDQUFDO0FBR0QscUJBQWU7QUFBQSxRQUNiLFdBQVc7QUFBQSxRQUNYLFFBQVEsQ0FBQztBQUFBLFFBQ1Qsa0JBQWtCO0FBQUEsUUFDbEIsV0FBVyxhQUFhLEtBQUssTUFBTSxLQUFLLEVBQUU7QUFBQSxRQUMxQyxjQUFjO0FBQUEsUUFDZCxTQUFTLGFBQWEsS0FBSyxVQUFVLEdBQUcsR0FBRyxJQUFJO0FBQUEsUUFDL0MsV0FBVyxDQUFDO0FBQUEsUUFDWixZQUFZLENBQUM7QUFBQSxNQUNmO0FBQUEsSUFDRjtBQUdBLFVBQU0sYUFBK0I7QUFBQSxNQUNuQyxXQUFXLGFBQWEsYUFBYTtBQUFBLE1BQ3JDLFFBQVEsTUFBTSxRQUFRLGFBQWEsTUFBTSxJQUFJLGFBQWEsU0FBUyxDQUFDO0FBQUEsTUFDcEUsa0JBQWtCLE9BQU8sYUFBYSxxQkFBcUIsV0FDdkQsS0FBSyxJQUFJLEdBQUcsS0FBSyxJQUFJLEtBQUssYUFBYSxnQkFBZ0IsQ0FBQyxJQUN4RDtBQUFBLE1BQ0osV0FBVyxPQUFPLGFBQWEsY0FBYyxXQUN6QyxhQUFhLFlBQ2IsYUFBYSxLQUFLLE1BQU0sS0FBSyxFQUFFO0FBQUEsTUFDbkMsY0FBYyxPQUFPLGFBQWEsaUJBQWlCLFdBQy9DLEtBQUssSUFBSSxHQUFHLEtBQUssSUFBSSxLQUFLLGFBQWEsWUFBWSxDQUFDLElBQ3BEO0FBQUEsTUFDSixTQUFTLE9BQU8sYUFBYSxZQUFZLFlBQVksYUFBYSxRQUFRLFNBQVMsSUFDL0UsYUFBYSxVQUNiLGFBQWEsS0FBSyxVQUFVLEdBQUcsR0FBRyxJQUFJO0FBQUEsTUFDMUMsV0FBVyxNQUFNLFFBQVEsYUFBYSxTQUFTLElBQUksYUFBYSxZQUFZLENBQUM7QUFBQSxNQUM3RSxZQUFZLE1BQU0sUUFBUSxhQUFhLFVBQVUsSUFBSSxhQUFhLGFBQWEsQ0FBQztBQUFBLE1BQ2hGLGFBQVksb0JBQUksS0FBSyxHQUFFLFlBQVk7QUFBQSxJQUNyQztBQUdBLGlCQUFhLGFBQWE7QUFHMUIsVUFBTSxpQkFBaUM7QUFDdkMsaUJBQWEsaUJBQWlCO0FBQzlCLGlCQUFhLGFBQVksb0JBQUksS0FBSyxHQUFFLFlBQVk7QUFDaEQsVUFBTSxNQUFNLElBQUksV0FBVyxXQUFXLFlBQVk7QUFDbEQsVUFBTSxNQUFNLElBQUksZUFBZSxXQUFXLFVBQVU7QUFDcEQsVUFBTSxNQUFNLElBQUksWUFBWSxXQUFXLEVBQUUsUUFBUSxnQkFBZ0IsVUFBVSxDQUFDO0FBRTVFLFdBQU8sS0FBSyx5QkFBeUI7QUFBQSxNQUNuQztBQUFBLE1BQ0EsV0FBVyxXQUFXO0FBQUEsTUFDdEIsY0FBYyxXQUFXO0FBQUEsSUFDM0IsQ0FBQztBQUdELFFBQUk7QUFDRixZQUFNLFFBQVEsZUFBZTtBQUFBLFFBQzNCLEVBQUUsU0FBUyxVQUFVO0FBQUEsUUFDckI7QUFBQSxVQUNFLE1BQU07QUFBQSxVQUNOLE1BQU07QUFBQSxZQUNKO0FBQUEsWUFDQSxRQUFRO0FBQUEsWUFDUixVQUFVO0FBQUEsWUFDVixZQUFXLG9CQUFJLEtBQUssR0FBRSxZQUFZO0FBQUEsVUFDcEM7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLElBQ0YsU0FBUyxhQUFhO0FBRXBCLGFBQU8sS0FBSywrQ0FBK0MsRUFBRSxPQUFPLGFBQWEsVUFBVSxDQUFDO0FBQUEsSUFDOUY7QUFHQSxRQUFJO0FBQ0YsWUFBTSxLQUFLO0FBQUEsUUFDVCxPQUFPO0FBQUEsUUFDUCxNQUFNO0FBQUEsVUFDSjtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsUUFDRjtBQUFBLE1BQ0YsQ0FBQztBQUFBLElBQ0gsU0FBUyxXQUFXO0FBRWxCLGFBQU8sS0FBSyxnREFBZ0QsRUFBRSxPQUFPLFdBQVcsVUFBVSxDQUFDO0FBQUEsSUFDN0Y7QUFBQSxFQUVGLFNBQVMsT0FBTztBQUNkLFdBQU8sTUFBTSxxQkFBcUIsRUFBRSxPQUFPLE1BQU0sQ0FBQztBQUdsRCxVQUFNLEVBQUUsVUFBVSxJQUFJO0FBQ3RCLFFBQUk7QUFDRixZQUFNLGVBQWUsTUFBTSxNQUFNLElBQUksV0FBVyxTQUFTO0FBQ3pELFVBQUksY0FBYztBQUVoQixZQUFJLENBQUMsYUFBYSxZQUFZO0FBQzVCLGdCQUFNLGVBQStCO0FBQ3JDLHVCQUFhLGlCQUFpQjtBQUM5Qix1QkFBYSxhQUFZLG9CQUFJLEtBQUssR0FBRSxZQUFZO0FBQ2hELGdCQUFNLE1BQU0sSUFBSSxXQUFXLFdBQVcsWUFBWTtBQUNsRCxnQkFBTSxNQUFNLElBQUksWUFBWSxXQUFXLEVBQUUsUUFBUSxjQUFjLFVBQVUsQ0FBQztBQUFBLFFBQzVFLE9BQU87QUFFTCxnQkFBTSxpQkFBaUM7QUFDdkMsdUJBQWEsaUJBQWlCO0FBQzlCLHVCQUFhLGFBQVksb0JBQUksS0FBSyxHQUFFLFlBQVk7QUFDaEQsZ0JBQU0sTUFBTSxJQUFJLFdBQVcsV0FBVyxZQUFZO0FBQ2xELGdCQUFNLE1BQU0sSUFBSSxZQUFZLFdBQVcsRUFBRSxRQUFRLGdCQUFnQixVQUFVLENBQUM7QUFBQSxRQUM5RTtBQUFBLE1BQ0Y7QUFBQSxJQUNGLFNBQVMsWUFBWTtBQUNuQixhQUFPLE1BQU0sb0NBQW9DLEVBQUUsT0FBTyxXQUFXLENBQUM7QUFBQSxJQUN4RTtBQUFBLEVBQ0Y7QUFDRjsiLAogICJuYW1lcyI6IFtdCn0K
