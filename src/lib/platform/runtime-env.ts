import { prisma } from "@/lib/db/prisma";

export const ADMIN_MANAGED_ENV_KEYS = [
  "OPENAI_API_KEY",
  "OPENAI_DEFAULT_MODEL",
  "OPENAI_FALLBACK_MODEL_SUMMARY",
  "OPENAI_FALLBACK_MODEL_GOAL",
  "OPENAI_FALLBACK_MODEL_DOCUMENT",
  "OPENAI_FALLBACK_MODEL_SITUATION",
  "OPENAI_FALLBACK_MODEL_PRESENTATION",
  "NEXT_PUBLIC_APP_URL",
  "AUTH_SESSION_SECRET",
  "PAYMENT_WEBHOOK_SECRET",
] as const;

export type AdminManagedEnvKey = (typeof ADMIN_MANAGED_ENV_KEYS)[number];

const ADMIN_MANAGED_ENV_KEY_SET = new Set<string>(ADMIN_MANAGED_ENV_KEYS);

export function isAdminManagedEnvKey(value: string): value is AdminManagedEnvKey {
  return ADMIN_MANAGED_ENV_KEY_SET.has(value);
}

export function isSecretEnvKey(key: AdminManagedEnvKey): boolean {
  return /KEY|SECRET|TOKEN|PASSWORD/i.test(key);
}

export async function getRuntimeEnvValues(keys: string[]): Promise<Map<string, string>> {
  const values = new Map<string, string>();

  for (const key of keys) {
    const envValue = process.env[key];
    if (envValue) {
      values.set(key, envValue);
    }
  }

  if (keys.length === 0) {
    return values;
  }

  try {
    const records = await prisma.setting.findMany({
      where: { key: { in: keys } },
      select: { key: true, value: true },
    });

    for (const record of records) {
      if (record.value.trim().length > 0) {
        values.set(record.key, record.value);
      }
    }
  } catch {
    return values;
  }

  return values;
}

