import type { Content } from "@google/genai";
import * as readline from "node:readline/promises";
import { runAgent } from "./agent.js";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const confirm = async (question: string): Promise<boolean> => {
  const answer = (await rl.question(`\n${question}\nallow? (y/n) `))
    .trim()
    .toLowerCase();
  return answer === "y" || answer === "yes";
};

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
  try {
    await runAgent(history, confirm);
  } catch (err) {
    console.log(
      `\n[error] ${err instanceof Error ? err.message : err}\nTry again or type a new task.`,
    );
  }

  console.log();
}

rl.close();
