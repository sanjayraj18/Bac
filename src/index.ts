import type { Content } from "@google/genai";
import { runAgent } from "./agent.js";

const task =
  process.argv.slice(2).join(" ") ||
  "How many files are in the current directory?";

const history: Content[] = [{ role: "user", parts: [{ text: task }] }];

await runAgent(history);
