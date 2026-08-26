import "server-only";
import { db } from "./db";
import { runStage } from "./ai/orchestrator";
import { STAGE_KEYS } from "./constants";
import { getNumberSetting } from "./settings";
import { formatCaseNumber } from "./case-number";
import { logSystem } from "./syslog";
import { getCaseEvidenceBrief } from "./evidence/brief";
import { getCasePresentationBrief } from "./case-presentation";
import { mergeSupportedText } from "./case-presentation-brief";
import { guardLetterDraftWithEvidence } from "./evidence/letter-guard";
import { classifyImmigrationInquiry } from "./immigration-inquiry";
import { resolveClosingCopy } from "./goal-conversation";
import { resolveReadinessCopy } from "./goal-readiness";

// Closing remarks & final review: a dedicated AI stage (admin-configurable
// like every other pipeline stage) writes the case's closing summary; a
// deterministic builder covers the no-AI case. Cases auto-close after an
// admin-set number of days once completed, or when abandoned.

async function deterministicClosing(caseId: string, reason: "completed" | "abandoned" | "manual"): Promise<string> {
  const c = await db.case.findUnique({
    where: { id: caseId },
    include: {
      issues: true,
      pathSteps: { orderBy: { sortOrder: "asc" } },
      documents: { where: { deletedAt: null } },
      deadlines: true,
    },
  });
  if (!c) return "";
  const done = c.pathSteps.filter((s) => s.status === "done").length;
  const resolved = c.issues.filter((i) => i.state === "resolved").length;
  const open = c.issues.length - resolved;
  const opened = c.createdAt.toLocaleDateString("en-US");
  const lastActivity = c.updatedAt.toLocaleDateString("en-US");
  const evidenceBrief = await getCaseEvidenceBrief(caseId).catch(() => null);
  const presentation = await getCasePresentationBrief(caseId).catch(() => null);
  const guardBrief = { supportedText: mergeSupportedText(presentation?.supportedText, evidenceBrief?.supportedText) };

  const inquiry = classifyImmigrationInquiry({ situation: c.situation, goal: c.goal });
  const closing = resolveClosingCopy({ inquiryMode: inquiry.mode, query: `${c.situation} ${c.goal}` });
  const lines: string[] = [];
  lines.push(
    reason === "abandoned"
      ? closing.abandonedLead(opened, lastActivity)
      : closing.completedLead(opened, new Date().toLocaleDateString("en-US")),
  );
  lines.push("");
  if (presentation) {
    lines.push(`Approved posture: ${presentation.contract.hero.current_posture}.`);
    if (presentation.contract.hero.next_best_action) {
      lines.push(`Approved next action: ${presentation.contract.hero.next_best_action.title}.`);
    }
    lines.push(presentation.contract.what_this_means.summary);
    for (const finding of presentation.contract.findings) {
      lines.push(`• ${finding.title}: ${finding.state === "resolved" ? "resolved." : finding.conclusion || "see the analysis for the remaining step."}`);
    }
  } else {
    lines.push(`What was covered: ${c.issues.length} item${c.issues.length === 1 ? "" : "s"} were identified and analyzed${resolved ? `, ${resolved} resolved` : ""}${open ? `, ${open} still open` : ""}. You completed ${done} of ${c.pathSteps.length} path steps and provided ${c.documents.length} document${c.documents.length === 1 ? "" : "s"}. ${resolveReadinessCopy({
      inquiryMode: inquiry.mode,
      query: `${c.situation} ${c.goal}`,
    }).closingReached(c.readinessScore)}`);
    if (evidenceBrief) {
      lines.push(`Compiled evidence position: ${evidenceBrief.currentPosition}. Evidence status: ${evidenceBrief.status.replace(/_/g, " ")}.`);
      if (evidenceBrief.pendingActions.length) lines.push(`Evidence-derived actions to keep in mind: ${evidenceBrief.pendingActions.slice(0, 3).join("; ")}.`);
    }
    for (const i of c.issues) {
      lines.push(`• ${i.caseYear ? `${i.caseYear} — ` : ""}${i.title}: ${i.state === "resolved" ? "resolved." : i.conclusion || "see the analysis for the remaining step."}`);
    }
  }
  const openSteps = c.pathSteps.filter((s) => s.status !== "done");
  if (openSteps.length && reason !== "completed") {
    lines.push("");
    lines.push(`If you pick this back up, the next step was: ${openSteps[0].title}.`);
  }
  lines.push("");
  lines.push(reason === "completed" ? closing.completedKeep : closing.abandonedKeep);
  return guardLetterDraftWithEvidence(lines.join("\n"), guardBrief.supportedText ? guardBrief : null).text;
}

/** Generate closing remarks (AI stage when configured, deterministic otherwise) and close the case. */
export async function closeCase(caseId: string, reason: "completed" | "abandoned" | "manual"): Promise<void> {
  const c = await db.case.findUnique({
    where: { id: caseId },
    include: { issues: true, pathSteps: true, documents: { where: { deletedAt: null } } },
  });
  if (!c || c.status === "closed") return;
  const evidenceBrief = await getCaseEvidenceBrief(caseId).catch(() => null);
  const presentation = await getCasePresentationBrief(caseId).catch(() => null);
  const guardBrief = { supportedText: mergeSupportedText(presentation?.supportedText, evidenceBrief?.supportedText) };

  const inquiry = classifyImmigrationInquiry({ situation: c.situation, goal: c.goal });
  const closing = resolveClosingCopy({ inquiryMode: inquiry.mode, query: `${c.situation} ${c.goal}` });
  let remarks = "";
  try {
    const outcome = await runStage(STAGE_KEYS.CLOSING, {
      input: JSON.stringify({
        reason,
        situation: c.situation,
        goal: c.goal,
        inquiry_mode: inquiry.mode,
        readiness: c.readinessScore,
        approved_presentation: presentation
          ? {
              current_posture: presentation.contract.hero.current_posture,
              next_best_action: presentation.contract.hero.next_best_action,
              nearest_deadline: presentation.contract.hero.nearest_deadline,
              summary: presentation.contract.what_this_means.summary,
              findings: presentation.contract.findings.map((finding) => ({
                title: finding.title,
                state: finding.state,
                conclusion: finding.conclusion,
              })),
            }
          : null,
        issues: c.issues.map((i) => ({ title: i.title, state: i.state, conclusion: i.conclusion, case_year: i.caseYear })),
        steps_done: c.pathSteps.filter((s) => s.status === "done").map((s) => s.title),
        steps_open: c.pathSteps.filter((s) => s.status !== "done").map((s) => s.title),
        documents: c.documents.map((d) => d.docKind),
        evidence_brief: evidenceBrief
          ? {
              status: evidenceBrief.status,
              current_position: evidenceBrief.currentPosition,
              summary: evidenceBrief.summary,
              facts: evidenceBrief.facts,
              events: evidenceBrief.events,
              unknowns: evidenceBrief.unknowns,
              pending_actions: evidenceBrief.pendingActions,
            }
          : null,
      }),
    });
    const parsed = outcome.stepOutputs.find((o) => o.data)?.data as Record<string, unknown> | undefined;
    if (parsed && typeof parsed.closing_remarks === "string" && parsed.closing_remarks.trim()) {
      remarks = String(parsed.closing_remarks);
    } else if (outcome.usedAi) {
      remarks = outcome.stepOutputs.find((o) => o.rawText.trim())?.rawText ?? "";
    }
  } catch (err) {
    await logSystem("error", "ai_call", "Closing-remarks stage failed — using the deterministic summary", String(err));
  }
  if (!remarks.trim()) remarks = await deterministicClosing(caseId, reason);
  else remarks = guardLetterDraftWithEvidence(remarks, guardBrief.supportedText ? guardBrief : null).text;

  await db.case.update({
    where: { id: caseId },
    data: { status: "closed", closedAt: new Date(), closedReason: reason, closingRemarks: remarks },
  });
  if (c.userId) {
    await db.notification.create({
      data: {
        userId: c.userId,
        kind: "case_closed",
        title: closing.notificationTitle(formatCaseNumber(c.number)),
        body: reason === "abandoned" ? closing.notificationAbandonedBody : closing.notificationCompletedBody,
        link: `/app/cases/${caseId}`,
      },
    });
  }
}

/**
 * Auto-close sweep (runs from the maintenance endpoint):
 * - COMPLETED cases (every path step done) close N days after their last activity.
 * - ABANDONED cases (no activity at all) close after M days.
 * Both windows are admin-set in Settings → Cases.
 */
export async function autoCloseCases(): Promise<number> {
  const completedDays = await getNumberSetting("cases.autoclose_completed_days", 14);
  const abandonedDays = await getNumberSetting("cases.autoclose_abandoned_days", 60);
  const candidates = await db.case.findMany({
    where: { status: { notIn: ["closed"] }, userId: { not: null } },
    include: { pathSteps: true },
  });
  let closed = 0;
  const now = Date.now();
  for (const c of candidates) {
    const idleDays = (now - c.updatedAt.getTime()) / 86400000;
    const complete = c.pathSteps.length > 0 && c.pathSteps.every((s) => s.status === "done");
    try {
      if (complete && completedDays > 0 && idleDays >= completedDays) {
        await closeCase(c.id, "completed");
        closed++;
      } else if (!complete && abandonedDays > 0 && idleDays >= abandonedDays) {
        await closeCase(c.id, "abandoned");
        closed++;
      }
    } catch (err) {
      await logSystem("error", "cases", `Auto-close failed for case ${formatCaseNumber(c.number)}`, String(err));
    }
  }
  return closed;
}
