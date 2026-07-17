import type { Content } from "@google/genai";
import * as readline from "node:readline/promises";
import { runAgent } from "./agent.js";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const history: Content[] = [];

console.log('bac v0.1 — type a task, or "exit" to quit\n');

while (true) {
  const input = (await rl.question("you: ")).trim();
  if (input === "exit" || input === "quit") {
    break;
  }
  if (input === "") {
    continue;
  }

  history.push({ role: "user", parts: [{ text: input }] });
  await runAgent(history);
  console.log();
}

rl.close();
