import { GoogleGenerativeAI } from "@google/generative-ai";
import { getRuntimeEnvValues } from "@/lib/platform/runtime-env";

export async function getGoogleAIClient(): Promise<GoogleGenerativeAI> {
  const runtimeValues = await getRuntimeEnvValues(["GOOGLE_AI_API_KEY"]);
  const apiKey = runtimeValues.get("GOOGLE_AI_API_KEY");
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY is not configured in admin settings or environment variables.");
  }
  return new GoogleGenerativeAI(apiKey);
}
