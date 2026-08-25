import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { hasFeature } from "@/lib/access";
import { FEATURE_KEYS } from "@/lib/constants";
import { PageHeader, Card, CardBody, Badge, EmptyState } from "@/components/ui";
import { respondToAssignmentAction } from "@/actions/user";
import { CONSULTANT_SPECIALTIES } from "@/lib/constants";
import { classifyImmigrationInquiry } from "@/lib/immigration-inquiry";
import { conversationNarrative } from "@/lib/goal-suggestions";
import { previewBestConsultantForThemes } from "@/lib/matching";
import { RequestConsultantMatchForm } from "@/components/request-consultant-match";
import {
  canRequestConsultantMatch,
  matchRequestBlockReason,
  resolveMatchRequestEntitlement,
} from "@/lib/consultant-match";

export const metadata = { title: "My consultant" };

export default async function MyConsultantsPage({
  searchParams,
}: {
  searchParams: Promise<{ case?: string; requested?: string }>;
}) {
  const { case: caseId, requested } = await searchParams;
  const user = await requireUser();
  const assignments = await db.consultantAssignment.findMany({
    where: { userId: user.id, status: { not: "revoked" } },
    orderBy: { createdAt: "desc" },
    include: { consultant: { include: { consultantProfile: true } } },
  });
  const agreement = await db.contentPage.findFirst({
    where: { kind: "agreement_connection", isPublished: true },
    orderBy: { version: "desc" },
    select: { slug: true, title: true },
  });
  const hasReferral = await hasFeature(user.id, FEATURE_KEYS.CONSULTANT_REFERRAL);
  const entitlement = resolveMatchRequestEntitlement({
    audience: hasReferral ? "pro" : "free",
    consultantReferral: hasReferral,
  });

  const specialtyName = (k: string) => CONSULTANT_SPECIALTIES.find((s) => s.key === k)?.name ?? k;
  const credentialLabel = (type: string | undefined) => {
    if (type === "attorney") return "Immigration attorney";
    if (type === "accredited_representative") return "Accredited representative";
    return "Immigration consultant";
  };

  const open = assignments.find((a) => ["proposed", "user_accepted", "active"].includes(a.status));
  const ownedCase = !open && canRequestConsultantMatch(entitlement)
    ? caseId
      ? await db.case.findFirst({ where: { id: caseId, userId: user.id }, select: { id: true, situation: true, goal: true } })
      : await db.case.findFirst({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, select: { id: true, situation: true, goal: true } })
    : null;
  const thread = !open && canRequestConsultantMatch(entitlement) && !ownedCase
    ? await db.qaThread.findFirst({
        where: { userId: user.id, caseId: null },
        orderBy: { createdAt: "desc" },
        include: { messages: { orderBy: { createdAt: "asc" }, select: { role: true, content: true } } },
      })
    : null;
  const inquiry = ownedCase
    ? classifyImmigrationInquiry({ situation: ownedCase.situation, goal: ownedCase.goal })
    : thread
      ? classifyImmigrationInquiry({ situation: conversationNarrative(thread.messages), goal: thread.title })
      : null;
  const preview = inquiry ? await previewBestConsultantForThemes(inquiry.themes).catch(() => null) : null;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="My consultant"
        subtitle="Pro can request a matched licensed attorney or accredited representative. Nothing is shared until you approve and they accept. The platform never auto-assigns a professional from Q&A or suggested next steps."
      />
      {requested && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Match requested. Your files stay private until the professional accepts the connection agreement.
        </div>
      )}
      {assignments.length === 0 ? (
        <Card>
          <CardBody>
            {canRequestConsultantMatch(entitlement) && preview ? (
              <>
                <h2 className="text-lg font-semibold text-slate-900">{preview.name}</h2>
                <p className="mt-1 text-sm text-slate-500">{preview.credentialLabel}</p>
                <p className="mt-3 text-sm text-slate-600">
                  A licensed professional on ImmigrationOnMe who works this kind of matter. Request a match — nothing is shared until they also accept.
                </p>
                <RequestConsultantMatchForm
                  caseId={ownedCase?.id}
                  threadId={thread?.id}
                  consultantName={preview.name}
                  agreementHref={agreement ? `/p/${agreement.slug}` : null}
                  agreementTitle={agreement?.title ?? null}
                />
              </>
            ) : canRequestConsultantMatch(entitlement) ? (
              <EmptyState
                title="No matching professional is available yet"
                body="Start a case review or ask a question so we can match a licensed attorney or accredited representative who works this kind of matter. Nothing is shared until you request a match and they accept."
              />
            ) : (
              <EmptyState
                title="No consultant proposed yet"
                body={matchRequestBlockReason(entitlement)}
              />
            )}
            {entitlement.showUpgradeCta && (
              <a href="/pricing" className="mt-4 inline-flex rounded-lg bg-lime-600 px-4 py-2 text-sm font-semibold text-white hover:bg-lime-700">
                See Pro plans
              </a>
            )}
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {assignments.map((a) => {
            const profile = a.consultant.consultantProfile;
            const specialties: string[] = profile ? JSON.parse(profile.specialties || "[]") : [];
            return (
              <Card key={a.id}>
                <CardBody>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">
                        {a.consultant.firstName} {a.consultant.lastName}
                      </h2>
                      <p className="text-sm text-slate-500">
                        {credentialLabel(profile?.credentialType)}
                        {profile?.isBusiness && profile.businessName ? ` · ${profile.businessName}` : ""}
                        {profile ? ` · ${profile.yearsExperience} yrs experience` : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {specialties.map((s) => (
                          <Badge key={s} color="lime">{specialtyName(s)}</Badge>
                        ))}
                      </div>
                      {(a.reasonSummary || a.note) && (
                        <p className="mt-2 text-sm text-slate-600">
                          <span className="font-medium text-slate-700">Why this consultant: </span>
                          {a.reasonSummary || a.note}
                        </p>
                      )}
                      {a.reasonDetail && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs font-medium text-lime-600">See the detailed reasoning</summary>
                          <p className="mt-1 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{a.reasonDetail}</p>
                        </details>
                      )}
                    </div>
                    <Badge color={a.status === "active" ? "green" : a.status === "declined" ? "red" : "lime"}>
                      {a.status.replace(/_/g, " ")}
                    </Badge>
                  </div>

                  {a.status === "proposed" && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm text-slate-600">
                        By accepting, you authorize this consultant to view your case details and the documents you&apos;ve shared,
                        under the{" "}
                        {agreement ? (
                          <a href={`/p/${agreement.slug}`} target="_blank" className="font-medium text-lime-600 underline">
                            {agreement.title}
                          </a>
                        ) : (
                          "connection agreement"
                        )}
                        . The connection becomes active only after the consultant also agrees.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <form action={respondToAssignmentAction.bind(null, a.id, true)}>
                          <button className="rounded-lg bg-lime-600 px-4 py-2 text-sm font-semibold text-white hover:bg-lime-700">
                            I agree — connect us
                          </button>
                        </form>
                        <form action={respondToAssignmentAction.bind(null, a.id, false)}>
                          <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                            No thanks
                          </button>
                        </form>
                      </div>
                    </div>
                  )}
                  {a.status === "user_accepted" && (
                    <p className="mt-3 text-sm text-slate-500">You&apos;ve agreed. Waiting for the consultant to accept the connection agreement. Nothing is shared until they do.</p>
                  )}
                  {a.status === "active" && (
                    <p className="mt-3 text-sm text-emerald-700">Connection active — your consultant can now review your shared documents.</p>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
