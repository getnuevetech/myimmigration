/**
 * Ban TaxOnMe / IRS customer-facing leftovers in ImmigrationOnMe product code.
 * Run: npm run test:brand-immigration
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { sanitizeBrandSettingForTests } from "../src/lib/settings";

const root = join(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === "docs") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

{
  assert.equal(sanitizeBrandSettingForTests("app.name", "TaxOnMe"), "ImmigrationOnMe");
  assert.equal(sanitizeBrandSettingForTests("app.name", "MyImmigration"), "ImmigrationOnMe");
  assert.equal(
    sanitizeBrandSettingForTests("app.disclaimer", "Welcome to TaxOnMe"),
    "Welcome to ImmigrationOnMe",
  );
}

{
  const composer = readFileSync(join(root, "src/lib/conversation/assistant-composer.ts"), "utf8");
  assert.ok(!/An IRS CP503 is a collection reminder/i.test(composer));
  assert.ok(composer.includes("ImmigrationOnMe helps with U.S. immigration"));

  const need = readFileSync(join(root, "src/lib/conversation/need-to-know.ts"), "utf8");
  assert.ok(!need.includes("CP503"));
  assert.ok(need.includes("I-797C"));

  const intent = readFileSync(join(root, "src/lib/conversation/intent-interpreter.ts"), "utf8");
  assert.ok(!intent.includes('"tax_collection"'));
  assert.ok(intent.includes("out_of_scope_non_immigration"));
}

{
  // Ban customer-facing TaxOnMe string literals in product src (comments about the fork OK).
  const files = walk(join(root, "src"));
  const hits: string[] = [];
  const literalRe = /["'`][^"'`\n]*TaxOnMe[^"'`\n]*["'`]|["'`][^"'`\n]*taxonme[^"'`\n]*["'`]/i;
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    // settings.ts may mention TaxOnMe only as a legacy value to rewrite — allow sanitize map.
    if (file.endsWith("/settings.ts")) continue;
    if (literalRe.test(text)) hits.push(file.replace(root + "/", ""));
  }
  assert.equal(hits.length, 0, `TaxOnMe string literals in src: ${hits.join(", ")}`);
}

{
  const migration = readFileSync(
    join(root, "prisma/migrations/20260901180000_repair_taxonme_branding/migration.sql"),
    "utf8",
  );
  assert.ok(migration.includes("ImmigrationOnMe"));
  assert.ok(migration.includes("app.name"));
}

console.log("brand-immigration-check: ok");
