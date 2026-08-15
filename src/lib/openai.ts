import OpenAI from "openai";
import { getRuntimeEnvValues } from "@/lib/platform/runtime-env";

export async function getOpenAIClient(): Promise<OpenAI> {
  const runtimeValues = await getRuntimeEnvValues(["OPENAI_API_KEY"]);
  const apiKey = runtimeValues.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured in admin settings or environment variables.");
  }
  return new OpenAI({ apiKey });
}
