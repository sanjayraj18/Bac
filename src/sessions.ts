import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { NeutralMessage } from "./providers/types.js";

const SESSION_DIR = join(homedir(), ".bac", "sessions");

function ensureDir() {
  if (!existsSync(SESSION_DIR)) {
    mkdirSync(SESSION_DIR, { recursive: true });
  }
}

export function saveSession(id: string, history: NeutralMessage[]): void {
  ensureDir();
  const file = join(SESSION_DIR, `${id}.json`);
  writeFileSync(file, JSON.stringify(history, null, 2));
}

export function loadSession(id: string): NeutralMessage[] {
  const file = join(SESSION_DIR, `${id}.json`);
  if (!existsSync(file)) throw new Error(`Session "${id}" not found`);
  return JSON.parse(readFileSync(file, "utf-8")) as NeutralMessage[];
}

export function listSessions(): string[] {
  ensureDir();
  return readdirSync(SESSION_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

export function newSessionId(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
