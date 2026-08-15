import Anthropic from "@anthropic-ai/sdk";
import { getRuntimeEnvValues } from "@/lib/platform/runtime-env";

export async function getAnthropicClient(): Promise<Anthropic> {
  const runtimeValues = await getRuntimeEnvValues(["ANTHROPIC_API_KEY"]);
  const apiKey = runtimeValues.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured in admin settings or environment variables.");
  }
  return new Anthropic({ apiKey });
}
