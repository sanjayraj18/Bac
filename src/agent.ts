import { GoogleGenAI, Part, type Content } from "@google/genai";
import config from "./config/config.js";
import { executeTool, toolSchemas } from "./tools.js";

const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
const MODEL = "gemini-3.5-flash";

export async function runAgent(history: Content[]) {
  while (true) {
    const stream = await ai.models.generateContentStream({
      model: MODEL,
      contents: history,
      config: { tools: [{ functionDeclarations: toolSchemas }] },
    });

    const modelParts: Part[] = [];
    for await (const chunk of stream) {
      for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
        if (part.text && !part.thought) process.stdout.write(part.text);
        modelParts.push(part);
      }
    }
    process.stdout.write("\n");

    history.push({ role: "model", parts: modelParts });

    const toolCallParts = modelParts.filter((p) => p.functionCall);
    if (toolCallParts.length === 0) {
      return;
    }

    const resultParts: Part[] = [];
    for (const part of toolCallParts) {
      const call = part.functionCall!;
      console.log(`  [tool] ${call.name} ${JSON.stringify(call.args)}`);

      const output = executeTool(
        call.name ?? "",
        (call.args ?? {}) as Record<string, unknown>,
      );

      console.log(
        `[result] ${output.length > 300 ? output.slice(0, 300) + "…" : output}`,
      );

      resultParts.push({
        functionResponse: { name: call.name ?? "", response: { output } },
      });
    }
    history.push({ role: "user", parts: resultParts });
  }
}
