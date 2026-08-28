import "server-only";
import { db } from "./db";
import { readUpload } from "./uploads";
import { getSetting, getSettingsMap } from "./settings";
import { formatCaseNumber } from "./case-number";
import { resolveCasePresentation } from "./case-presentation";
import { parseCanonicalApprovedState, canonicalStateSummary } from "./canonical-case-state";
import { presentationReportSections, v5CustomerPresentationReportSections } from "./case-report-presentation";
import { authorityQueriesForInquiry, classifyImmigrationInquiry } from "./immigration-inquiry";
import { resolveReadinessCopy } from "./goal-readiness";
import { reportFileName, resolveReportChrome } from "./goal-chrome";
import { buildSituationBrief, parseSituationBrief, stripClarifiedNarrative } from "./situation-brief";
import { caseTypeLockFromBrief } from "./case-type-lock";
import { assembleV5CustomerPresentation } from "./v5-customer-presentation";
import { neededDocumentsFromRanked, rankMatchingDocuments } from "./goal-documents";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type CaseReportOptions = {
  /** Staff/admin appendix may keep the legacy presentation contract + raw narrative. */
  includeStaffAppendix?: boolean;
};

export async function buildCaseReportHtml(
  caseId: string,
  options: CaseReportOptions = {},
): Promise<{ html: string; fileName: string } | null> {
  const includeStaffAppendix = Boolean(options.includeStaffAppendix);
  const c = await db.case.findUnique({
    where: { id: caseId },
    include: {
      user: { select: { firstName: true, lastName: true, email: true, phone: true, address: true } },
      documents: { where: { deletedAt: null }, orderBy: { uploadedAt: "asc" } },
      letters: { orderBy: { createdAt: "asc" } },
      notices: { orderBy: { createdAt: "asc" } },
      pathSteps: { orderBy: { sortOrder: "asc" } },
      reconstruction: true,
      runs: { orderBy: { startedAt: "desc" }, take: 1, include: { stepResults: { select: { id: true } } } },
    },
  });
  if (!c) return null;
  const presentation = await resolveCasePresentation(caseId);
  if (!presentation) return null;
  const approved = parseCanonicalApprovedState(
    (await db.canonicalCaseState.findUnique({ where: { caseId }, select: { approvedStateJson: true } }).catch(() => null))?.approvedStateJson,
  );
  const approvedSummary = approved ? canonicalStateSummary(approved) : null;

  const appName = await getSetting("app.name", "ImmigrationOnMe");
  const fonts = await getSettingsMap(["font.body", "font.heading", "font.mono"]);
  const bodyFont = fonts["font.body"] || "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif";
  const headingFont = fonts["font.heading"] || "var(--font-playfair), Georgia, 'Times New Roman', serif";
  const monoFont = fonts["font.mono"] || "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  const ref = formatCaseNumber(c.number);
  const generatedAt = new Date().toLocaleString("en-US");
  const inquiry = classifyImmigrationInquiry({ situation: c.situation, goal: c.goal });
  const brief =
    parseSituationBrief(c.reconstruction?.briefJson) ??
    buildSituationBrief({
      situation: c.situation,
      goal: c.goal,
      documents: c.documents.map((doc) => ({
        fileName: doc.fileName,
        documentType: doc.documentType,
        docKind: doc.docKind,
      })),
      notices: c.notices.map((notice) => notice.noticeType),
    });
  const caseLock = caseTypeLockFromBrief(brief);
  const chromeInput = {
    inquiryMode: inquiry.mode,
    query: `${c.situation} ${c.goal}`,
    noticeTypes: c.notices.map((notice) => notice.noticeType),
    caseLock,
  };
  const reportChrome = resolveReportChrome(chromeInput);
  const reviewLevel = reportChrome.reviewLevel;
  const readinessCopy = resolveReadinessCopy(chromeInput);
  const rankedDocuments = rankMatchingDocuments({
    themes: inquiry.themes,
    inquiryMode: inquiry.mode,
    query: `${c.situation} ${c.goal}`,
    authorityQueries: authorityQueriesForInquiry(inquiry, caseLock),
    noticeTypes: c.notices.map((notice) => notice.noticeType),
    caseLock,
  });
  const neededDocs = neededDocumentsFromRanked(rankedDocuments).map((item) => ({
    kind: item.kind,
    label: item.label,
    hint: item.hint,
  }));
  const v5 = assembleV5CustomerPresentation({
    brief,
    presentation,
    pathSteps: c.pathSteps.map((step) => ({
      title: step.title,
      description: step.description,
      actionKey: step.actionKey,
      status: step.status,
    })),
    documents: c.documents.map((doc) => ({
      fileName: doc.fileName,
      documentType: doc.documentType,
      docKind: doc.docKind,
      processingStatus: doc.processingStatus,
    })),
    neededDocs,
  });

  const docSections: string[] = [];
  for (const [i, d] of c.documents.entries()) {
    const header = `<h3>Appendix ${String.fromCharCode(65 + (i % 26))} — ${esc(d.fileName)} <span class="muted">(${d.docKind}, uploaded ${d.uploadedAt.toLocaleDateString("en-US")})</span></h3>`;
    try {
      if (d.mimeType.startsWith("image/") && d.sizeBytes < 8 * 1024 * 1024) {
        const { REPORT_EMBED_IMAGE_TYPES, normalizeMimeType } = await import("./uploads");
        const mime = normalizeMimeType(d.mimeType);
        if (!REPORT_EMBED_IMAGE_TYPES.has(mime)) {
          docSections.push(`${header}<p class="muted">Image type not embedded for safety (${esc(mime)}).</p>`);
          continue;
        }
        const buf = await readUpload(d.filePath);
        docSections.push(`${header}<img class="doc" src="data:${esc(mime)};base64,${buf.toString("base64")}" alt="${esc(d.fileName)}" />`);
        continue;
      }
      if (d.mimeType.startsWith("text/") || /\.(txt|csv|md|log)$/i.test(d.fileName)) {
        const buf = await readUpload(d.filePath);
        docSections.push(`${header}<pre class="doc-text">${esc(buf.toString("utf-8").slice(0, 20000))}</pre>`);
        continue;
      }
      docSections.push(`${header}<p class="muted">Binary document (${esc(d.mimeType)}, ${(d.sizeBytes / 1024).toFixed(0)} KB) — stored in the ${esc(appName)} vault; attach the original file when sharing this report.</p>`);
    } catch {
      docSections.push(`${header}<p class="muted">Document could not be read for embedding.</p>`);
    }
  }

  const staffAppendix = includeStaffAppendix
    ? `
<h2>Staff appendix — approved presentation detail</h2>
<p class="muted">Internal audit copy included only for staff downloads.</p>
${presentationReportSections(presentation, chromeInput)}

<h2>Staff appendix — situation narrative</h2>
<p>${esc(stripClarifiedNarrative(c.situation) || c.situation || "—")}</p>
<h2>Staff appendix — applicant goal</h2>
<p>${esc(c.goal || "—")}</p>
<p class="meta"><strong>${esc(readinessCopy.reportOverallLabel)}:</strong> ${c.readinessScore}% ·
<strong>${esc(readinessCopy.availableLabel)}:</strong> ${c.evidenceAvailableScore}% ·
<strong>${esc(readinessCopy.processedLabel)}:</strong> ${c.evidenceProcessedScore}% ·
<strong>${esc(readinessCopy.actionLabel)}:</strong> ${c.actionReadinessScore}%</p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(appName)} ${esc(reportChrome.heading)} ${ref}</title>
<style>
  body { font-family: ${esc(bodyFont)}; color: #1e293b; max-width: 800px; margin: 0 auto; padding: 40px 24px; line-height: 1.55; }
  header { border-bottom: 3px solid #3f6212; padding-bottom: 16px; margin-bottom: 28px; }
  h1 { font-family: ${esc(headingFont)}; font-size: 26px; margin: 0; color: #1e1b4b; }
  h2 { font-family: ${esc(headingFont)}; font-size: 18px; color: #3f6212; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 32px; }
  h3 { font-family: ${esc(headingFont)}; font-size: 15px; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; margin: 8px 0; }
  th, td { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; vertical-align: top; }
  th { background: #f8fafc; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; }
  .muted { color: #94a3b8; font-size: 12px; font-weight: normal; }
  .meta { font-size: 13px; color: #475569; margin-top: 6px; }
  .badge { display: inline-block; border: 1px solid #cbd5e1; border-radius: 999px; padding: 1px 10px; font-size: 11px; margin-right: 6px; }
  img.doc { max-width: 100%; border: 1px solid #e2e8f0; margin: 8px 0; }
  pre.doc-text { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; font-size: 11px; white-space: pre-wrap; font-family: ${esc(monoFont)}; }
  pre.letter { background: #fff; border: 1px solid #e2e8f0; padding: 16px; font-size: 12px; white-space: pre-wrap; font-family: ${esc(monoFont)}; }
  footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 11px; color: #94a3b8; }
  @media print { body { padding: 0; } h2 { page-break-after: avoid; } .appendix { page-break-before: always; } }
</style>
</head>
<body>
<header>
  <h1>${esc(appName)} — ${esc(reportChrome.heading)}</h1>
  <p class="meta">
    <strong>${esc(reportChrome.referenceLabel)}:</strong> ${ref} &nbsp;·&nbsp; <strong>Generated:</strong> ${generatedAt}<br/>
    <strong>Applicant:</strong> ${esc(`${c.user?.firstName ?? ""} ${c.user?.lastName ?? ""}`.trim() || "—")} (${esc(c.user?.email ?? "—")}${c.user?.phone ? `, ${esc(c.user.phone)}` : ""})${c.user?.address ? `<br/><strong>Address:</strong> ${esc(c.user.address)}` : ""}<br/>
    <strong>${esc(reportChrome.openedLabel)}:</strong> ${c.createdAt.toLocaleDateString("en-US")} &nbsp;·&nbsp; <strong>Status:</strong> ${esc(c.status.replace(/_/g, " "))} &nbsp;·&nbsp; <strong>Review level:</strong> ${reviewLevel}
    ${approvedSummary ? `<br/><strong>${esc(reportChrome.recordLabel)}:</strong> ${esc(approvedSummary.versionLabel)} · ${esc(approvedSummary.reasonLabel)}` : ""}
    ${v5.primaryForm ? `<br/><strong>Primary immigration matter:</strong> Form ${esc(v5.primaryForm)}${v5.relatedProcess ? ` · Related: ${esc(v5.relatedProcess)}` : ""}` : ""}
  </p>
</header>

${v5CustomerPresentationReportSections(v5)}

${c.notices.length ? `<h2>USCIS notices on file</h2>
<table><tr><th>Notice</th><th>Year</th><th>Deadline</th></tr>
${c.notices.map((n) => `<tr><td>${esc(n.noticeType || "Unidentified")}</td><td>${n.caseYear ?? "—"}</td><td>${n.deadline?.toLocaleDateString("en-US") ?? "—"}</td></tr>`).join("\n")}
</table>` : reportChrome.emptyNoticesHtml}

${c.letters.length ? `<h2>Response letters drafted</h2>
${c.letters.map((l) => `<h3>${esc(l.title)} <span class="muted">(${l.status}, ${l.createdAt.toLocaleDateString("en-US")})</span></h3><pre class="letter">${esc(l.body.slice(0, 6000))}</pre>`).join("\n")}` : ""}

${c.documents.length ? `<h2>Document inventory (${c.documents.length})</h2>
<table><tr><th>File</th><th>Type</th><th>Uploaded</th><th>Size</th></tr>
${c.documents.map((d) => `<tr><td>${esc(d.fileName)}</td><td>${d.docKind}</td><td>${d.uploadedAt.toLocaleDateString("en-US")}</td><td>${(d.sizeBytes / 1024).toFixed(0)} KB</td></tr>`).join("\n")}
</table>` : ""}

${staffAppendix}

${docSections.length ? `<div class="appendix"><h2>Appendices — document copies</h2>${docSections.join("\n")}</div>` : ""}

<footer>
  Report ${ref} generated by ${esc(appName)} on ${generatedAt}. ${esc(appName)} is ${esc(reportChrome.footerRole)};
  ${esc(reportChrome.footerVerify)}
</footer>
</body>
</html>`;

  return { html, fileName: reportFileName(appName, ref, chromeInput) };
}
