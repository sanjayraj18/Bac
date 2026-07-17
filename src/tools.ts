import { Type, type FunctionDeclaration } from "@google/genai";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

export const toolSchemas: FunctionDeclaration[] = [
  {
    name: "bash",
    description:
      "Run a shell command on the user's machine. Returns stdout and stderr.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        command: {
          type: Type.STRING,
          description: "The shell command to execute",
        },
      },
      required: ["command"],
    },
  },
  {
    name: "write",
    description: "Create or overwrite a file with the given content.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: "File path to write to" },
        content: {
          type: Type.STRING,
          description: "Full content of the file",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "read",
    description:
      "Read a file from disk and return its contents with line numbers.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: "File Path to read to" },
      },
      required: ["path"],
    },
  },
  {
    name: "grep",
    description:
      "Search for a regex pattern across files in the project. Returns matching lines with file path and line number.",
    parameters: {},
  },
];

export function executeTool(
  name: string,
  args: Record<string, unknown>,
): string {
  try {
    switch (name) {
      case "bash": {
        const output = execSync(String(args.command), {
          encoding: "utf-8",
          timeout: 30_000,
        });
        return output.trim() || "(command succeded with no outputs)";
      }
      case "write": {
        const content = String(args.content);
        writeFileSync(String(args.path), content);
        return `Wrote ${content.length} bytes to ${args.path}`;
      }
      case "read": {
        const path = String(args.path);
        const content = readFileSync(path, {
          encoding: "utf-8",
        });
        return content
          .split("\n")
          .map((line, i) => `${String(i + 1).padStart(4)}  ${line}`)
          .join("\n");
      }
      default:
        return `Error: unknown tool "${name}"`;
    }
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
