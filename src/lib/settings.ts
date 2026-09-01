import { db } from "./db";

/** Legacy fork brand names that must never appear customer-facing. */
const LEGACY_APP_NAMES = new Set(["taxonme", "myimmigration"]);

function sanitizeBrandValue(key: string, value: string): string {
  if (key === "app.name" && LEGACY_APP_NAMES.has(value.trim().toLowerCase())) {
    return "ImmigrationOnMe";
  }
  if (value.includes("TaxOnMe") || value.includes("MyImmigration")) {
    return value.replaceAll("MyImmigration", "ImmigrationOnMe").replaceAll("TaxOnMe", "ImmigrationOnMe");
  }
  return value;
}

// All app variables are stored in the Setting table and managed from the admin backend.
// Nothing business-facing is hardcoded; these helpers only read/write the DB.

export async function getSetting(key: string, fallback = ""): Promise<string> {
  const row = await db.setting.findUnique({ where: { key } });
  if (!row) return fallback;
  return sanitizeBrandValue(key, row.value);
}

export async function getSettings(prefix?: string) {
  const rows = await db.setting.findMany({
    where: prefix ? { key: { startsWith: prefix } } : undefined,
    orderBy: [{ group: "asc" }, { key: "asc" }],
  });
  return rows.map((r) => ({ ...r, value: sanitizeBrandValue(r.key, r.value) }));
}

export async function getSettingsMap(keys: string[]): Promise<Record<string, string>> {
  const rows = await db.setting.findMany({ where: { key: { in: keys } } });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = sanitizeBrandValue(r.key, r.value);
  return map;
}

export async function setSetting(key: string, value: string) {
  const cleaned = sanitizeBrandValue(key, value);
  await db.setting.upsert({
    where: { key },
    update: { value: cleaned },
    create: { key, value: cleaned },
  });
}

export async function getBoolSetting(key: string, fallback = false): Promise<boolean> {
  const v = await getSetting(key, fallback ? "true" : "false");
  return v === "true" || v === "1";
}

export async function getNumberSetting(key: string, fallback = 0): Promise<number> {
  const v = await getSetting(key, String(fallback));
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Exported for unit checks — pure brand sanitize. */
export function sanitizeBrandSettingForTests(key: string, value: string): string {
  return sanitizeBrandValue(key, value);
}
