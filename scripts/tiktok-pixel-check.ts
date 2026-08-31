/**
 * TikTok Pixel is wired sitewide via root layout + setting.
 * Run: npx tsx scripts/tiktok-pixel-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

{
  const layout = read("src/app/layout.tsx");
  assert.ok(layout.includes("TikTokPixel"));
  assert.ok(layout.includes("analytics.tiktok_pixel_id"));
}

{
  const pixel = read("src/components/tiktok-pixel.tsx");
  assert.ok(pixel.includes("next/script"));
  assert.ok(pixel.includes("ttq.load"));
  assert.ok(pixel.includes("ttq.page"));
  assert.ok(pixel.includes("afterInteractive"));
  assert.ok(pixel.includes("analytics.tiktok.com"));
}

{
  const seed = read("prisma/seed.ts");
  assert.ok(seed.includes("analytics.tiktok_pixel_id"));
  assert.ok(seed.includes("DAASLUJC77U47UVQELH0"));
}

console.log("tiktok-pixel-check: ok");
