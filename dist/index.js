import { GoogleGenAI } from "@google/genai";
import config from "./config/config.js";
const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
const stream = await ai.models.generateContentStream({
    model: "gemini-3.5-flash",
    contents: [{ role: "user", parts: [{ text: "Say hello in 3 languages" }] }],
});
for await (const chunk of stream) {
    process.stdout.write(chunk.text ?? "");
}
console.log();
//# sourceMappingURL=index.js.map