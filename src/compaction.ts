import { getProvider } from "./providers/index.js";
import type { NeutralMessage } from "./providers/types.js";

const COMPACT_THRESHOLD = 20000;
const KEEP_RECENT = 6;

export async function maybeCompact(
  history: NeutralMessage[],
  lastPromptTokens: number,
): Promise<void> {
  if (lastPromptTokens < COMPACT_THRESHOLD) return;
  if (history.length <= KEEP_RECENT + 2) return;

  // Don't let the kept slice start on an orphaned tool result.
  let keepFrom = history.length - KEEP_RECENT;
  while (keepFrom > 0 && history[keepFrom]?.role === "tool") {
    keepFrom--;
  }

  const toSummarize = history.slice(0, keepFrom);
  const toKeep = history.slice(keepFrom);

  // Reuse the provider abstraction to summarize: a one-off conversation
  // ending in a "please summarize" user message.
  const provider = getProvider();
  const summaryRequest: NeutralMessage[] = [
    ...toSummarize,
    {
      role: "user",
      text: "Summarize our conversation so far into a concise brief: what was asked, what was done, key files and decisions, and current state. This summary will replace the earlier messages, so include everything needed to continue the work.",
    },
  ];

  const stream = provider.stream(
    summaryRequest,
    [], // no tools for the summarizer
    "You are a summarizer. Produce a dense, factual brief.",
  );

  // drain the stream so result() becomes available (we discard the live events)
  for await (const _event of stream) {
    // intentionally empty — we only want the final assembled message
  }
  const summaryMsg = await stream.result();
  const summaryText =
    summaryMsg.role === "assistant" ? summaryMsg.text : "(summary failed)";

  const summaryMessage: NeutralMessage = {
    role: "user",
    text: `[Earlier conversation summary]\n${summaryText}`,
  };

  history.length = 0;
  history.push(summaryMessage, ...toKeep);
}
