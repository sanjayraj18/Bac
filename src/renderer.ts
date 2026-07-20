import { AgentEvent } from "./event.js";

export function render(event: AgentEvent): void {
  switch (event.type) {
    case "text":
      process.stdout.write(event.text);
      break;

    case "tool_start":
      console.log(`\n[tool] ${event.name} ${JSON.stringify(event.args)}`);
      break;

    case "tool_result": {
      const out =
        event.output.length > 300
          ? event.output.slice(0, 300) + "…"
          : event.output;
      console.log(`[result] ${out}`);
      break;
    }

    case "turn_end":
      console.log(`  [tokens: ${event.inTokens} in / ${event.outTokens} out]`);
      break;

    case "retry":
      console.log(
        `  [retry ${event.attempt}/${event.max}] ${event.reason}, retrying…`,
      );
      break;

    case "compacted":
      console.log(`  [compacted: summarized ${event.summarized} messages]`);
      break;

    case "error":
      console.log(`\n[error] ${event.message}`);
      break;
  }
}
