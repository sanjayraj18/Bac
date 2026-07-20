import type { Content } from "@google/genai";
import * as readline from "node:readline/promises";
import { runAgent } from "./agent.js";
import { handleCommand } from "./command.js";
import { render } from "./renderer.js";
import {
  listSessions,
  loadSession,
  newSessionId,
  saveSession,
} from "./sessions.js";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const resume = process.argv.includes("--resume");
let sessionId: string;
let history: Content[];

if (resume && listSessions().length > 0) {
  sessionId = listSessions().sort().at(-1)!;
  history = loadSession(sessionId);
  console.log(`Resumed session ${sessionId} (${history.length} messages)\n`);
} else {
  sessionId = newSessionId();
  history = [];
  console.log(`New session ${sessionId}\n`);
}

const confirm = async (question: string): Promise<boolean> => {
  const answer = (await rl.question(`\n${question}\nallow? (y/n) `))
    .trim()
    .toLowerCase();
  return answer === "y" || answer === "yes";
};

console.log('bac v0.1 — type a task, or "exit" to quit\n');

while (true) {
  const input = (await rl.question("you: ")).trim();
  if (input === "exit" || input === "quit") {
    break;
  }
  if (input === "") {
    continue;
  }
  if (handleCommand(input, history)) {
    console.log();
    continue;
  }
  history.push({ role: "user", parts: [{ text: input }] });
  try {
    await runAgent(history, render, confirm);
  } catch (err) {
    render({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
  saveSession(sessionId, history);
  console.log();
}

rl.close();
