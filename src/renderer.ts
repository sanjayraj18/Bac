import pc from "picocolors";
import { AgentEvent } from "./event.js";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
let spinnerTimer: NodeJS.Timeout | null = null;
let frame = 0;

function startSpinner() {
  stopSpinner();
  frame = 0;
  spinnerTimer = setInterval(() => {
    process.stdout.write(`\r${pc.cyan(FRAMES[frame])} ${pc.dim("thinking…")}`);
    frame = (frame + 1) % FRAMES.length;
  }, 80);
}

function stopSpinner() {
  if (spinnerTimer) {
    clearInterval(spinnerTimer);
    spinnerTimer = null;
    process.stdout.write("\r\x1b[K");
  }
}

export function render(event: AgentEvent): void {
  if (event.type !== "thinking_start") stopSpinner();
  switch (event.type) {
    case "thinking_start":
      startSpinner();
      break;

    case "thinking_end":
      break;

    case "text":
      process.stdout.write(event.text);
      break;

    case "tool_start":
      console.log(
        pc.cyan(`\n⏵ ${event.name}`) + pc.dim(` ${JSON.stringify(event.args)}`),
      );
      break;

    case "tool_result": {
      const out =
        event.output.length > 300
          ? event.output.slice(0, 300) + "…"
          : event.output;
      console.log(pc.dim(`  ${out}`));
      break;
    }

    case "turn_end":
      console.log(pc.dim(`  [${event.inTokens} in / ${event.outTokens} out]`));
      break;

    case "retry":
      console.log(
        pc.yellow(`  [retry ${event.attempt}/${event.max}] ${event.reason}`),
      );
      break;

    case "compacted":
      console.log(pc.magenta(`  [compacted ${event.summarized} messages]`));
      break;

    case "error":
      console.log(pc.red(`\n✖ ${event.message}`));
      break;
  }
}
