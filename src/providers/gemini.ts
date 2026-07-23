import { Content, GoogleGenAI, Part } from "@google/genai";
import {
  NeutralMessage,
  NeutralTool,
  NeutralToolCall,
  Provider,
  ProviderStream,
} from "./types.js";
import { AgentEvent } from "../event.js";

export class GeminiProvider implements Provider {
  readonly name = "Gemini";
  private ai: GoogleGenAI;
  private model: string;

  constructor(apiKey: string, model = "gemini-3.5-flash") {
    this.ai = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  private toContents(messages: NeutralMessage[]): Content[] {
    return messages.map((m): Content => {
      if (m.role == "user") {
        return { role: "user", parts: [{ text: m.text }] };
      }
      if (m.role == "assistant") {
        const parts: Part[] = [];
        if (m.text) parts.push({ text: m.text });
        for (const tc of m.toolCalls ?? []) {
          parts.push({ functionCall: { name: tc.name, args: tc.args } });
        }
        return { role: "model", parts };
      }
      return {
        role: "user", // ← Gemini has no "tool" role, so disguise it as a user turn
        parts: [
          {
            functionResponse: { name: m.name, response: { output: m.output } },
          },
        ],
      };
    });
  }

  stream(
    messages: NeutralMessage[],
    tools: NeutralTool[],
    systemPrompt: string,
  ): ProviderStream {
    const ai = this.ai;
    const model = this.model;

    const contents = this.toContents(messages);

    let assistant: NeutralMessage = {
      role: "assistant",
      text: "",
      toolCalls: [],
    };
    let done = false;

    async function* run(): AsyncGenerator<AgentEvent> {
      const stream = await ai.models.generateContentStream({
        model,
        contents,
        config: {
          systemInstruction: systemPrompt,
          tools: [{ functionDeclarations: tools as any }],
        },
      });

      let text = ""; // collect all the model's words
      const toolCalls: NeutralToolCall[] = []; // collect all tool requests
      let inTok = 0;
      let outTok = 0; // collect token counts

      for await (const chunk of stream) {
        if (chunk.usageMetadata) {
          // token counts arrive near the end
          inTok = chunk.usageMetadata.promptTokenCount ?? 0;
          outTok = chunk.usageMetadata.candidatesTokenCount ?? 0;
        }
        for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
          if (part.text && !part.thought) {
            text += part.text; // Job 2: collect for final message
            yield { type: "text", text: part.text }; // Job 1: emit live for the screen
          }
          if (part.functionCall) {
            toolCalls.push({
              // Job 2: collect the tool request
              id: part.functionCall.id ?? `call_${toolCalls.length}`,
              name: part.functionCall.name ?? "",
              args: (part.functionCall.args ?? {}) as Record<string, unknown>,
            });
          }
        }
      }

      yield { type: "turn_end", inTokens: inTok, outTokens: outTok };
      assistant = { role: "assistant", text, toolCalls };
      done = true;
    }

    const iterable = run();
    return {
      [Symbol.asyncIterator]: () => iterable[Symbol.asyncIterator](),
      async result() {
        if (!done) throw new Error("result() called before stream consumed");
        return assistant;
      },
    };
  }
}
