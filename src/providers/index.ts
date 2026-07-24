import config from "../config/config.js";
import { GeminiProvider } from "./gemini.js";
import { GroqProvider } from "./groq.js";
import { Provider } from "./types.js";

export function getProvider(): Provider {
  const which = (process.env.Provider ?? "gemini").toLowerCase();

  switch (which) {
    case "gemini":
      if (!config.GEMINI_API_KEY) throw new Error("GEMINI API KEY not set");
      return new GeminiProvider(config.GEMINI_API_KEY);
    case "groq":
      if (!config.GROQ_API_KEY) throw new Error("GROQ API KEY not set");
      return new GroqProvider(config.GROQ_API_KEY);
    default:
      throw new Error(`Unknown PROVIDER "${which}" (use "gemini" or "groq")`);
  }
}
