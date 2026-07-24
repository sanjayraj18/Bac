import dotenv from "dotenv";
dotenv.config();

if (!process.env.GEMINI_API_KEY) {
  throw new Error("No api key found");
}

if (!process.env.GROQ_API_KEY) {
  throw new Error("No api key found");
}

const config = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
};

export default config;
