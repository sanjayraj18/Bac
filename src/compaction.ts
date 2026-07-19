import { Content, GoogleGenAI } from "@google/genai";
import config from "./config/config.js";

const COMPACT_THRESHOLD = 20000;
const KEEP_RECENT = 6;

const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
const MODEL = "gemini-3.5-flash";

export async function maybeCompact(
  history: Content[],
  lastPromptTokens: number,
): Promise<void> {
  if (lastPromptTokens < COMPACT_THRESHOLD) return;
  if (history.length <= KEEP_RECENT + 2) return;

  const toSummarize = history.slice(0, history.length - KEEP_RECENT);
  const toKeep = history.slice(history.length - KEEP_RECENT);

  const summaryResponse = await ai.models.generateContent({
    model: MODEL,
    contents: [
      ...toSummarize,
      {
        role: "user",
        parts: [
          {
            text: "Summarize our conversation so far into a concise brief: what was asked, what was done, key files and decisions, and current state. This summary will replace the earlier messages, so include everything needed to continue the work.",
          },
        ],
      },
    ],
  });

  const summaryText =
    summaryResponse.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("") ?? "(summary failed)";

  const summaryMessage: Content = {
    role: "user",
    parts: [{ text: `[Earlier conversation summary]\n${summaryText}` }],
  };

  history.length = 0;
  history.push(summaryMessage, ...toKeep);

  console.log(
    `  [compacted: summarized ${toSummarize.length} messages into 1]`,
  );
}
