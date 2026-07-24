import type { NeutralMessage } from "./providers/types.js";
import { listSessions, loadSession } from "./sessions.js";

export function handleCommand(
  input: string,
  history: NeutralMessage[],
): boolean {
  if (!input.startsWith("/")) return false;

  const [cmd] = input.slice(1).split(" ");

  switch (cmd) {
    case "clear":
      history.length = 0;
      console.log("History cleaned");
      return true;

    case "sessions": {
      const ids = listSessions();
      if (ids.length === 0) console.log("No saved sessions.");
      else ids.forEach((id) => console.log(`  ${id}`));
      return true;
    }

    case "tokens":
      console.log(`  ${history.length} messages in current history`);
      return true;

    case "resume": {
      const arg = input.slice(1).split(" ")[1];
      const ids = listSessions();
      const id = arg ?? ids.sort().at(-1);
      if (!id) {
        console.log("No sessions to resume.");
        return true;
      }
      const loaded = loadSession(id);
      history.length = 0;
      history.push(...loaded);
      console.log(`Resumed ${id} (${loaded.length} messages).`);
      return true;
    }

    case "help":
      console.log(
        [
          "Commands:",
          "  /clear     — wipe the conversation history",
          "  /sessions  — list saved sessions",
          "  /tokens    — show current history size",
          "  /help      — this list",
          "  exit       — quit",
        ].join("\n"),
      );
      return true;

    default:
      console.log(`Unknown command: /${cmd}  (try /help)`);
      return true;
  }
}
