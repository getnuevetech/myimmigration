import "server-only";
import { db } from "./db";
import { readUpload } from "./uploads";
import { getSetting, getSettingsMap } from "./settings";
import { formatCaseNumber } from "./case-number";
import { resolveCasePresentation } from "./case-presentation";
import { parseCanonicalApprovedState, canonicalStateSummary } from "./canonical-case-state";
import { presentationReportSections } from "./case-report-presentation";
import { classifyImmigrationInquiry } from "./immigration-inquiry";
import { resolveReadinessCopy } from "./goal-readiness";
import { reportFileName, resolveReportChrome } from "./goal-chrome";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function buildCaseReportHtml(caseId: string): Promise<{ html: string; fileName: string } | null> {
  const c = await db.case.findUnique({
    where: { id: caseId },
    include: {
      user: { select: { firstName: true, lastName: true, email: true, phone: true, address: true } },
      documents: { where: { deletedAt: null }, orderBy: { uploadedAt: "asc" } },
      letters: { orderBy: { createdAt: "asc" } },
      notices: { orderBy: { createdAt: "asc" } },
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
  const chromeInput = {
    inquiryMode: classifyImmigrationInquiry({ situation: c.situation, goal: c.goal }).mode,
    query: `${c.situation} ${c.goal}`,
    noticeTypes: c.notices.map((notice) => notice.noticeType),
  };
  const reportChrome = resolveReportChrome(chromeInput);
  const reviewLevel = reportChrome.reviewLevel;
  const readinessCopy = resolveReadinessCopy(chromeInput);

  const docSections: string[] = [];
  for (const [i, d] of c.documents.entries()) {
    const header = `<h3>Appendix ${String.fromCharCode(65 + (i % 26))} — ${esc(d.fileName)} <span class="muted">(${d.docKind}, uploaded ${d.uploadedAt.toLocaleDateString("en-US")})</span></h3>`;
    try {
      if (d.mimeType.startsWith("image/") && d.sizeBytes < 8 * 1024 * 1024) {
        const buf = await readUpload(d.filePath);
        docSections.push(`${header}<img class="doc" src="data:${d.mimeType};base64,${buf.toString("base64")}" alt="${esc(d.fileName)}" />`);
        continue;
      }
      if (d.mimeType.startsWith("text/") || /\.(txt|csv|md|log)$/i.test(d.fileName)) {
        const buf = await readUpload(d.filePath);
        docSections.push(`${header}<pre class="doc-text">${esc(buf.toString("utf-8").slice(0, 20000))}</pre>`);
        continue;
      }
      docSections.push(`${header}<p class="muted">Binary document (${d.mimeType}, ${(d.sizeBytes / 1024).toFixed(0)} KB) — stored in the ${appName} vault; attach the original file when sharing this report.</p>`);
    } catch {
      docSections.push(`${header}<p class="muted">Document could not be read for embedding.</p>`);
    }
  }

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
    <strong>${esc(reportChrome.openedLabel)}:</strong> ${c.createdAt.toLocaleDateString("en-US")} &nbsp;·&nbsp; <strong>Status:</strong> ${esc(c.status.replace(/_/g, " "))} &nbsp;·&nbsp; <strong>${esc(readinessCopy.reportOverallLabel)}:</strong> ${c.readinessScore}% &nbsp;·&nbsp; <strong>Review level:</strong> ${reviewLevel}<br/>
    <strong>${esc(readinessCopy.availableLabel)}:</strong> ${c.evidenceAvailableScore}% &nbsp;·&nbsp; <strong>${esc(readinessCopy.processedLabel)}:</strong> ${c.evidenceProcessedScore}% &nbsp;·&nbsp; <strong>${esc(readinessCopy.actionLabel)}:</strong> ${c.actionReadinessScore}%
    ${approvedSummary ? `<br/><strong>${esc(reportChrome.recordLabel)}:</strong> ${esc(approvedSummary.versionLabel)} · ${esc(approvedSummary.reasonLabel)}` : ""}
  </p>
</header>

${presentationReportSections(presentation, chromeInput)}

<h2>Situation as reported</h2>
<p>${esc(c.situation)}</p>
<h2>Applicant's goal</h2>
<p>${esc(c.goal || "—")}</p>

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

${docSections.length ? `<div class="appendix"><h2>Appendices — document copies</h2>${docSections.join("\n")}</div>` : ""}

<footer>
  Report ${ref} generated by ${esc(appName)} on ${generatedAt}. ${esc(appName)} is ${esc(reportChrome.footerRole)};
  ${esc(reportChrome.footerVerify)}
</footer>
</body>
</html>`;

  return { html, fileName: reportFileName(appName, ref, chromeInput) };
}
