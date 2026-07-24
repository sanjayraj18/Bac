import { maybeCompact } from "./compaction.js";
import { EventSink } from "./event.js";
import { buildSystemPrompt } from "./prompt.js";
import { getProvider } from "./providers/index.js";
import { NeutralMessage, NeutralTool, Provider } from "./providers/types.js";
import { executeTool, toolSchemas } from "./tools.js";

export type confirmFn = (question: string) => Promise<boolean>;

const neutralTools: NeutralTool[] = toolSchemas.map((t) => ({
  name: t.name,
  description: t.description,
  parameters: t.parameters as Record<string, unknown>,
}));

async function streamTurnWithRetry(
  provider: Provider,
  history: NeutralMessage[],
  emit: EventSink,
  attempts = 4,
): Promise<{ assistant: NeutralMessage; inTokens: number }> {
  for (let i = 0; i < attempts; i++) {
    emit({ type: "thinking_start" });
    let sawEvent = false;
    try {
      const stream = provider.stream(
        history,
        neutralTools,
        buildSystemPrompt(),
      );

      let inTokens = 0;
      for await (const event of stream) {
        if (!sawEvent) {
          emit({ type: "thinking_end" });
          sawEvent = true;
        }
        if (event.type === "turn_end") inTokens = event.inTokens;
        emit(event);
      }

      return { assistant: await stream.result(), inTokens };
    } catch (err) {
      if (!sawEvent) emit({ type: "thinking_end" });
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
  history: NeutralMessage[],
  emit: EventSink,
  confirm: confirmFn,
) {
  const provider = getProvider();
  let lastPromptTokens = 0;
  while (true) {
    await maybeCompact(history, lastPromptTokens);

    const { assistant, inTokens } = await streamTurnWithRetry(
      provider,
      history,
      emit,
    );
    lastPromptTokens = inTokens;
    history.push(assistant);

    const toolCalls =
      assistant.role === "assistant" ? (assistant.toolCalls ?? []) : [];
    if (toolCalls.length === 0) return;

    for (const call of toolCalls) {
      emit({ type: "tool_start", name: call.name, args: call.args });
      const output = await executeTool(call.name, call.args, confirm);
      emit({ type: "tool_result", name: call.name, output });

      history.push({
        role: "tool",
        toolCallId: call.id,
        name: call.name,
        output,
      });
    }
  }
}
