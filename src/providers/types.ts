import { AgentEvent } from "../event.js";

export type NeutralMessage =
  | { role: "user"; text: String }
  | { role: "assistant"; text: string; toolCalls?: NeutralToolCall[] }
  | { role: "tool"; toolCallId: string; name: string; output: string };

export type NeutralToolCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
};

export type NeutralTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type ProviderStream = AsyncIterable<AgentEvent> & {
  result(): Promise<NeutralMessage>;
};

export interface Provider {
  readonly name: string;
  stream(
    messages: NeutralMessage[],
    tools: NeutralTool[],
    systemPrompt: string,
  ): ProviderStream;
}
