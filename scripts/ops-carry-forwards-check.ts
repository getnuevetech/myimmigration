/**
 * Ops carry-forwards — gate override wiring, posture rename, monitoring.
 * Run: tsx scripts/ops-carry-forwards-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isPrimaFacieIssuedPosture,
  postureCustomerLabel,
  POSTURE_PENDING_PRIMA_FACIE_ISSUED,
  POSTURE_PRIMA_FACIE_PENDING_LEGACY,
} from "../src/lib/evidence/case-posture";
import { buildFactLedger } from "../src/lib/evidence/fact-ledger";
import { VAWA_PRIMA_FACIE_FIXTURE } from "../src/lib/situation-brief";
import { withGateOverride } from "../src/lib/approval-gate";

const root = join(__dirname, "..");
function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

// 1) Posture rename + dual-read
{
  assert.equal(isPrimaFacieIssuedPosture(POSTURE_PENDING_PRIMA_FACIE_ISSUED), true);
  assert.equal(isPrimaFacieIssuedPosture(POSTURE_PRIMA_FACIE_PENDING_LEGACY), true);
  assert.equal(isPrimaFacieIssuedPosture("FILED_PENDING"), false);
  assert.match(postureCustomerLabel(POSTURE_PENDING_PRIMA_FACIE_ISSUED), /prima facie/i);
  assert.equal(postureCustomerLabel(POSTURE_PENDING_PRIMA_FACIE_ISSUED).includes("PRIMA_FACIE"), false);

  const ledger = buildFactLedger(VAWA_PRIMA_FACIE_FIXTURE);
  assert.equal(ledger.current_posture?.value, POSTURE_PENDING_PRIMA_FACIE_ISSUED);
}

// 2) Gate override wiring
{
  const overrideLib = read("src/lib/approval-gate-override.ts");
  assert.ok(overrideLib.includes("withGateOverride"));
  assert.ok(overrideLib.includes("finalizeCaseVersion"));
  assert.ok(overrideLib.includes("applyStaffApprovalGateOverride"));

  const action = read("src/actions/approval-gate.ts");
  assert.ok(action.includes("overrideApprovalGateAction"));
  assert.ok(action.includes("requireAdminArea"));

  const adminPage = read("src/app/admin/cases/[id]/page.tsx");
  assert.ok(adminPage.includes("ApprovalGateOverridePanel"));

  const panel = read("src/components/admin/approval-gate-override.tsx");
  assert.ok(panel.includes("overrideApprovalGateAction"));
  assert.ok(panel.includes("Override BLOCK"));

  const sample = withGateOverride(
    {
      gate_result: "BLOCK",
      rule_ids: ["BLOCK-STATE-STALE-DERIVED-OUTPUT"],
      blocks: [],
      warnings: [],
      reasons: ["stale"],
      logical_analysis_id: null,
      case_version_id: null,
      case_id: null,
      evaluated_at: new Date().toISOString(),
      override_by: null,
      override_time: null,
      override_reason: null,
      previous_gate_result: null,
    },
    { overrideBy: "admin@example.com", overrideReason: "Verified printout from USCIS account" },
  );
  assert.equal(sample.previous_gate_result, "BLOCK");
  assert.notEqual(sample.gate_result, "BLOCK");
}

// 3) Monitoring fields on admin analytics
{
  const analytics = read("src/lib/admin-analytics.ts");
  assert.ok(analytics.includes("logicalSuccessRate"));
  assert.ok(analytics.includes("ceilingBreaches30"));
  assert.ok(analytics.includes("tokenBudgetHint"));
  assert.ok(analytics.includes("totalModelCalls"));

  const dash = read("src/app/admin/page.tsx");
  assert.ok(dash.includes("Logical success rate"));
  assert.ok(dash.includes("Ceiling breaches"));
}

console.log("ops-carry-forwards-check: ok");
