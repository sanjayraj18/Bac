import { GoogleGenAI, Part, type Content } from "@google/genai";
import { maybeCompact } from "./compaction.js";
import config from "./config/config.js";
import { EventSink } from "./event.js";
import { buildSystemPrompt } from "./prompt.js";
import { executeTool, toolSchemas } from "./tools.js";

export type confirmFn = (question: string) => Promise<boolean>;

const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
const MODEL = "gemini-3.5-flash";

async function callModelWithRetry(
  history: Content[],
  emit: EventSink,
  attempts = 4,
) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await ai.models.generateContentStream({
        model: MODEL,
        contents: history,
        config: {
          systemInstruction: buildSystemPrompt(),
          tools: [{ functionDeclarations: toolSchemas }],
        },
      });
    } catch (err) {
      const status = (err as { status?: number }).status ?? 0;
      const code = (err as { cause?: { code?: string } }).cause?.code ?? "";
      const retryable =
        status === 429 ||
        status >= 500 ||
        code === "ECONNRESET" ||
        code === "ETIMEDOUT";
      if (!retryable || i === attempts - 1) throw err;
      const waitMs = 2 ** i * 2000; // 2s, 4s, 8s

      emit({
        type: "retry",
        attempt: i + 1,
        max: attempts,
        reason: String(status || code),
      });

      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw new Error("unreachable");
}

export async function runAgent(
  history: Content[],
  emit: EventSink,
  confirm: confirmFn,
) {
  let lastPromptTokens = 0;
  while (true) {
    await maybeCompact(history, lastPromptTokens);
    const stream = await callModelWithRetry(history, emit);

    const modelParts: Part[] = [];
    let usage:
      | { promptTokenCount?: number; candidatesTokenCount?: number }
      | undefined;

    for await (const chunk of stream) {
      if (chunk.usageMetadata) usage = chunk.usageMetadata;

      for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
        if (part.text && !part.thought) emit({ type: "text", text: part.text });
        modelParts.push(part);
      }
    }
    process.stdout.write("\n");
    if (usage) {
      lastPromptTokens = usage.promptTokenCount ?? 0;

      emit({
        type: "turn_end",
        inTokens: lastPromptTokens,
        outTokens: usage.candidatesTokenCount ?? 0,
      });
    }

    history.push({ role: "model", parts: modelParts });

    const toolCallParts = modelParts.filter((p) => p.functionCall);
    if (toolCallParts.length === 0) {
      return;
    }

    const resultParts: Part[] = [];
    for (const part of toolCallParts) {
      const call = part.functionCall!;
      emit({ type: "tool_start", name: call.name ?? "", args: call.args });

      const output = await executeTool(
        call.name ?? "",
        (call.args ?? {}) as Record<string, unknown>,
        confirm,
      );

      emit({ type: "tool_result", name: call.name ?? "", output });

      resultParts.push({
        functionResponse: { name: call.name ?? "", response: { output } },
      });
    }
    history.push({ role: "user", parts: resultParts });
  }
}
