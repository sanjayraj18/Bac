import OpenAI from "openai";
import { AgentEvent } from "../event.js";
import {
  NeutralMessage,
  NeutralTool,
  Provider,
  ProviderStream,
} from "./types.js";

export class GroqProvider implements Provider {
  readonly name = "Groq";
  private ai: OpenAI;
  private model: string;

  constructor(apiKey: string, model = "llama-3.3-70b-versatile") {
    this.ai = new OpenAI({
      apiKey,
      baseURL: "https://api.groq.com/openai/v1", // ← Groq's OpenAI-compatible endpoint
    });
    this.model = model;
  }

  private toContents(
    messages: NeutralMessage[],
    systemPrompt: string,
  ): OpenAI.Chat.ChatCompletionMessageParam[] {
    const out: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt }, // ← DIFF 1: system is a MESSAGE, not a separate field
    ];
    for (const m of messages) {
      if (m.role === "user") {
        out.push({ role: "user", content: m.text });
      } else if (m.role === "assistant") {
        const msg: OpenAI.Chat.ChatCompletionAssistantMessageParam = {
          role: "assistant", // ← DIFF 2: stays "assistant" (Gemini renamed to "model")
          content: m.text || null,
        };
        if (m.toolCalls?.length) {
          msg.tool_calls = m.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: { name: tc.name, arguments: JSON.stringify(tc.args) }, // ← args as STRING
          }));
        }
        out.push(msg);
      } else {
        // DIFF 3: OpenAI HAS a real "tool" role (Gemini faked it as a user turn)
        out.push({
          role: "tool",
          tool_call_id: m.toolCallId,
          content: m.output,
        });
      }
    }
    return out;
  }

  stream(
    messages: NeutralMessage[],
    tools: NeutralTool[],
    systemPrompt: string,
  ): ProviderStream {
    const ai = this.ai;
    const model = this.model;

    let assistant: NeutralMessage = {
      role: "assistant",
      text: "",
      toolCalls: [],
    };
    let done = false;

    const contents = this.toContents(messages, systemPrompt);

    async function* run(): AsyncGenerator<AgentEvent> {
      const stream = await ai.chat.completions.create({
        model,
        messages: contents,
        tools: tools.map((t) => ({
          type: "function" as const,
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        })),
        stream: true,
        stream_options: { include_usage: true }, // ← ask for token counts in the stream
      });

      let text = "";
      const partials: Record<
        number,
        { id: string; name: string; argStr: string }
      > = {};
      let inTok = 0,
        outTok = 0;

      for await (const chunk of stream) {
        if (chunk.usage) {
          inTok = chunk.usage.prompt_tokens ?? 0;
          outTok = chunk.usage.completion_tokens ?? 0;
        }
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          text += delta.content;
          yield { type: "text", text: delta.content };
        }

        // tool calls arrive in FRAGMENTS across chunks, keyed by index — accumulate them
        for (const tc of delta.tool_calls ?? []) {
          const idx = tc.index;
          partials[idx] ??= { id: "", name: "", argStr: "" };
          if (tc.id) partials[idx].id = tc.id;
          if (tc.function?.name) partials[idx].name = tc.function.name;
          if (tc.function?.arguments)
            partials[idx].argStr += tc.function.arguments;
        }
      }

      yield { type: "turn_end", inTokens: inTok, outTokens: outTok };

      const toolCalls = Object.values(partials).map((p) => ({
        id: p.id || `call_${p.name}`,
        name: p.name,
        args: safeParse(p.argStr), // ← parse the accumulated JSON string back to an object
      }));

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

function safeParse(s: string): Record<string, unknown> {
  if (!s.trim()) return {};
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
