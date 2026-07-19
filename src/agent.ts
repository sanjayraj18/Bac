import { GoogleGenAI, Part, type Content } from "@google/genai";
import { maybeCompact } from "./compaction.js";
import config from "./config/config.js";
import { buildSystemPrompt } from "./prompt.js";
import { executeTool, toolSchemas } from "./tools.js";

export type confirmFn = (question: string) => Promise<boolean>;

const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
const MODEL = "gemini-3.5-flash";

async function callModelWithRetry(history: Content[], attempts = 4) {
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
      console.log(
        `  [retry ${i + 1}/${attempts}] ${status || code}, waiting ${waitMs / 1000}s…`,
      );
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw new Error("unreachable");
}

export async function runAgent(history: Content[], confirm: confirmFn) {
  while (true) {
    const stream = await callModelWithRetry(history);

    const modelParts: Part[] = [];
    let usage:
      | { promptTokenCount?: number; candidatesTokenCount?: number }
      | undefined;

    for await (const chunk of stream) {
      if (chunk.usageMetadata) usage = chunk.usageMetadata;

      for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
        if (part.text && !part.thought) process.stdout.write(part.text);
        modelParts.push(part);
      }
    }
    process.stdout.write("\n");
    if (usage) {
      const inTok = usage.promptTokenCount ?? 0;
      const outTok = usage.candidatesTokenCount ?? 0;
      await maybeCompact(history, inTok);
      console.log(`  [tokens: ${inTok} in / ${outTok} out]`);
    }

    history.push({ role: "model", parts: modelParts });

    const toolCallParts = modelParts.filter((p) => p.functionCall);
    if (toolCallParts.length === 0) {
      return;
    }

    const resultParts: Part[] = [];
    for (const part of toolCallParts) {
      const call = part.functionCall!;
      console.log(`[tool] ${call.name} ${JSON.stringify(call.args)}`);

      const output = executeTool(
        call.name ?? "",
        (call.args ?? {}) as Record<string, unknown>,
        confirm,
      );

      resultParts.push({
        functionResponse: { name: call.name ?? "", response: { output } },
      });
    }
    history.push({ role: "user", parts: resultParts });
  }
}
