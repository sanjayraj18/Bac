import { Type, type FunctionDeclaration } from "@google/genai";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

function safePath(P: string): string {
  const cwd = process.cwd();
  const absolutePath = resolve(P);
  const relativePath = relative(cwd, absolutePath);

  const inside =
    relativePath && !relativePath.startsWith("..") && !isAbsolute(relativePath);

  if (!inside) {
    throw new Error(
      `Path "${P}" is outside the project directory and is not allowed.`,
    );
  }
  return absolutePath;
}

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
    parameters: {
      type: Type.OBJECT,
      properties: {
        pattern: {
          type: Type.STRING,
          description: "The regex pattern to search for",
        },
        path: {
          type: Type.STRING,
          description:
            "Directory or file to search in. Defaults to the current directory.",
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "edit",
    description:
      "Replace an exact string in a file with a new string. The old_string must appear exactly once.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING, description: "File path to write to" },
        old_string: {
          type: Type.STRING,
          description:
            "The exact text to find. Must appear exactly once in the file.",
        },
        new_string: {
          type: Type.STRING,
          description: "The text to replace old_string with.",
        },
      },
      required: ["path", "old_string", "new_string"],
    },
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
        writeFileSync(safePath(String(args.path)), content);
        return `Wrote ${content.length} bytes to ${args.path}`;
      }
      case "read": {
        const path = safePath(String(args.path));
        const content = readFileSync(path, {
          encoding: "utf-8",
        });
        return content
          .split("\n")
          .map((line, i) => `${String(i + 1).padStart(4)}  ${line}`)
          .join("\n");
      }
      case "grep": {
        const pattern = String(args.pattern);
        const searchPath = args.path ? String(args.path) : ".";

        try {
          const output = execSync(
            `grep -rn -e '${pattern}' ${searchPath} | head -100`,
            { encoding: "utf-8", timeout: 30_000 },
          );
          return output.trim() || "No matches found";
        } catch (err) {
          if ((err as { status?: number }).status === 1) {
            return "No matches found";
          }
          throw err;
        }
      }
      case "edit": {
        const path = safePath(String(args.path));
        const old_string = String(args.old_string);
        const new_string = String(args.new_string);

        const content = readFileSync(path, { encoding: "utf-8" });
        const count = content.split(old_string).length - 1;
        if (count == 0) {
          return "not found, re-read the file";
        }
        if (count > 1) {
          return `found ${count} times, add more surrounding context to make it unique`;
        }

        const updated = content.replace(old_string, new_string);
        writeFileSync(path, updated);
        return `Edited ${path} successfully.`;
      }
      default:
        return `Error: unknown tool "${name}"`;
    }
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
