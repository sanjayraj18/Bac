export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "tool_start"; name: string; args: unknown }
  | { type: "tool_result"; name: string; output: string }
  | { type: "turn_end"; inTokens: number; outTokens: number }
  | { type: "retry"; attempt: number; max: number; reason: string }
  | { type: "compacted"; summarized: number }
  | { type: "error"; message: string };

export type EventSink = (event: AgentEvent) => void;
