import type { PresentationContract } from "./case-presentation-contract";
import { formatPresentationDate, presentationActionStatus, presentationEvidenceGateLabel } from "./case-presentation-ui";

const esc = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function list(items: string[]): string {
  if (items.length === 0) return "";
  return `<ul>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`;
}

export function presentationReportSections(contract: PresentationContract): string {
  const gate = presentationEvidenceGateLabel(contract.what_this_means.evidence_gate_status);
  const nextAction = contract.hero.next_best_action?.title || "No action is ready yet";
  const deadline = contract.hero.nearest_deadline
    ? `${contract.hero.nearest_deadline.title} (${formatPresentationDate(contract.hero.nearest_deadline.due_date)})`
    : "No open deadline is on file";
  const findings = contract.findings
    .map((finding) => `<h3>${esc(finding.title)}</h3>
<p><span class="badge">${esc(finding.group.replace(/_/g, " "))}</span><span class="badge">${esc(finding.evidence_status.replace(/_/g, " "))}</span><span class="badge">${esc(finding.state.replace(/_/g, " "))}</span><span class="badge">Evidence: ${esc(finding.evidence_strength)}</span></p>
${finding.conclusion ? `<p>${esc(finding.conclusion)}</p>` : ""}
${finding.next_action ? `<p><strong>Recommended action:</strong> ${esc(finding.next_action.replace(/_/g, " ").toLowerCase())}</p>` : ""}`)
    .join("\n");
  const actions = contract.actions.length
    ? `<table><tr><th>#</th><th>Step</th><th>Status</th></tr>
${contract.actions
  .map((action, index) => {
    const status = presentationActionStatus(action.status);
    return `<tr><td>${index + 1}</td><td><strong>${esc(action.title)}</strong></td><td>${esc(status.label)}</td></tr>`;
  })
  .join("\n")}
</table>`
    : "<p>No next steps are on the approved presentation yet.</p>";
  const deadlines = contract.deadlines.length
    ? `<h2>Deadlines</h2>
<table><tr><th>Deadline</th><th>Due date</th><th>Source</th></tr>
${contract.deadlines
  .map((item) => `<tr><td>${esc(item.title)}</td><td>${esc(formatPresentationDate(item.due_date))}</td><td>${esc(item.source)}</td></tr>`)
  .join("\n")}
</table>`
    : "";
  const timeline = contract.timeline.length
    ? `<ul>${contract.timeline
        .map((event) => `<li>${esc([event.dateText, event.title].filter(Boolean).join(": "))} <span class="muted">${esc((event.eventType || "").replace(/_/g, " "))}</span></li>`)
        .join("")}</ul>`
    : "<p>No timeline events are on the approved presentation yet.</p>";
  const evidence = contract.evidence.length
    ? `<table><tr><th>File</th><th>Type</th><th>Processing</th></tr>
${contract.evidence
  .map((doc) => `<tr><td>${esc(doc.file_name)}</td><td>${esc(doc.document_type.replace(/_/g, " "))}</td><td>${esc(doc.processing_status.replace(/_/g, " "))}</td></tr>`)
  .join("\n")}
</table>`
    : "<p>No evidence files are on the approved presentation yet.</p>";

  return `<h2>Where you stand</h2>
<p><span class="badge">Evidence ${esc(contract.hero.evidence_strength.toLowerCase())}</span>${gate ? `<span class="badge">${esc(gate)}</span>` : ""}${contract.hero.professional_review_recommended ? `<span class="badge">Professional review recommended</span>` : ""}</p>
<p><strong>Current posture:</strong> ${esc(contract.hero.current_posture)}</p>
<p><strong>Next best action:</strong> ${esc(nextAction)}</p>
<p><strong>Nearest deadline:</strong> ${esc(deadline)}</p>

<h2>What this means</h2>
<p>${esc(contract.what_this_means.summary)}</p>
<p>${contract.what_this_means.unresolved_count} open item${contract.what_this_means.unresolved_count === 1 ? "" : "s"} still need attention.</p>
${contract.what_this_means.pending_actions.length ? `<p><strong>What to do from the records:</strong></p>${list(contract.what_this_means.pending_actions)}` : ""}
${contract.what_this_means.unknowns.length ? `<p><strong>Still needs:</strong></p>${list(contract.what_this_means.unknowns)}` : ""}
${contract.what_this_means.conflicts
  .map((conflict) => `<p><strong>Information conflict — ${esc(conflict.topic)}:</strong> ${esc(conflict.description)}${conflict.resolution ? ` ${esc(conflict.resolution)}` : ""}</p>`)
  .join("\n")}

<h2>Timeline</h2>
${timeline}

<h2>Findings (${contract.findings.length})</h2>
${findings || "<p>No findings are on the approved presentation yet.</p>"}

<h2>Your next steps</h2>
${actions}

${deadlines}

<h2>Evidence on the approved presentation</h2>
${evidence}`;
}
