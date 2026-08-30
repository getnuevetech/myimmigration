/**
 * Phase S4 CLI — dry-run by default; pass --apply to write.
 * Usage: npx tsx scripts/reclassify-legacy-cases.ts [--apply] [--limit=100]
 */
import { applyLegacyCaseReclassification } from "../src/lib/situation-reclassify-apply";

async function main() {
  const apply = process.argv.includes("--apply");
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) || 500 : 500;

  const result = await applyLegacyCaseReclassification({ dryRun: !apply, limit });
  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry_run",
        scanned: result.scanned,
        kept: result.kept,
        reclassified: result.reclassified,
        sample: result.decisions.slice(0, 10),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
