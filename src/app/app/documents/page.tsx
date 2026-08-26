import Link from "next/link";
import { db } from "@/lib/db";
import { isAdmin, requireUser } from "@/lib/auth";
import { featureLimit, getActivePlan, hasFeature } from "@/lib/access";
import { FEATURE_KEYS } from "@/lib/constants";
import { PageHeader, Card, CardBody, Badge, EmptyState } from "@/components/ui";
import { deleteDocumentAction } from "@/actions/documents";
import { VaultUpload } from "@/components/vault-upload";
import { DOC_KINDS } from "@/lib/constants";
import { authorityQueriesForInquiry, classifyImmigrationInquiry } from "@/lib/immigration-inquiry";
import {
  DOCUMENT_CATALOG,
  documentStartLabel,
  documentUploadAllowed,
  neededDocumentsFromRanked,
  rankDocumentCatalog,
  rankMatchingDocuments,
  resolveDocumentCatalogEntitlement,
} from "@/lib/goal-documents";
import { resolveIntakeChrome } from "@/lib/goal-intake";

export const metadata = { title: "Document vault" };

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; case?: string }>;
}) {
  const { kind: requestedKind, case: caseId } = await searchParams;
  const user = await requireUser();
  const plan = await getActivePlan(user.id);
  const staff = isAdmin(user);
  const hasUpload = staff || (await hasFeature(user.id, FEATURE_KEYS.DOC_UPLOAD));
  const entitlement = resolveDocumentCatalogEntitlement({
    isStaff: staff,
    planKey: plan?.key,
    hasUpload,
  });
  const [docs, scopedCase, used, limit] = await Promise.all([
    db.document.findMany({
      where: { userId: user.id, deletedAt: null, docKind: { not: "avatar" } },
      orderBy: { uploadedAt: "desc" },
      include: { case: { select: { title: true, id: true } } },
    }),
    caseId
      ? db.case.findFirst({
          where: { id: caseId, userId: user.id },
          select: {
            id: true,
            situation: true,
            goal: true,
            issues: { select: { title: true, uscisBasis: true, conclusion: true } },
            notices: { select: { noticeType: true } },
          },
        })
      : db.case.findFirst({
          where: { userId: user.id },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            situation: true,
            goal: true,
            issues: { select: { title: true, uscisBasis: true, conclusion: true } },
            notices: { select: { noticeType: true } },
          },
        }),
    db.document.count({ where: { userId: user.id, deletedAt: null, docKind: { not: "avatar" } } }),
    staff ? Promise.resolve(null) : featureLimit(user.id, FEATURE_KEYS.DOC_UPLOAD),
  ]);
  const quota = documentUploadAllowed({
    canUpload: entitlement.canUpload,
    used,
    limit: entitlement.canUpload ? limit : 0,
  });
  const inquiry = scopedCase
    ? classifyImmigrationInquiry({ situation: scopedCase.situation, goal: scopedCase.goal })
    : null;
  const intake = resolveIntakeChrome({
    themes: inquiry?.themes,
    inquiryMode: inquiry?.mode,
    query: `${scopedCase?.situation ?? ""} ${scopedCase?.goal ?? ""}`,
    noticeTypes: (scopedCase?.notices ?? []).map((notice) => notice.noticeType),
  });
  const ranked = inquiry
    ? rankMatchingDocuments({
        themes: inquiry.themes,
        inquiryMode: inquiry.mode,
        query: `${scopedCase?.situation ?? ""} ${scopedCase?.goal ?? ""}`,
        authorityQueries: authorityQueriesForInquiry(inquiry),
        sources: (scopedCase?.issues ?? []).map((issue) => ({
          reference: issue.uscisBasis,
          title: issue.title,
          content: issue.conclusion,
        })),
        noticeTypes: (scopedCase?.notices ?? []).map((notice) => notice.noticeType),
      })
    : [];
  const bestMatch = requestedKind || ranked[0]?.kind;
  const catalog = rankDocumentCatalog(DOCUMENT_CATALOG, ranked);
  const checklist = neededDocumentsFromRanked(ranked);
  const kindName = (k: string) => DOC_KINDS.find((d) => d.key === k)?.name ?? k;

  return (
    <div>
      <PageHeader
        title={intake.documentsTitle}
        subtitle="Upload the evidence the matching official form actually lists. Family options start with identity and relationship records, not a USCIS receipt you do not have."
      />

      {entitlement.showUpgradeCta && (
        <div className="mb-6 rounded-xl border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-900">
          Matching evidence is highlighted. Uploading is included in Free with a monthly cap.{" "}
          <Link href="/app/billing?upgrade=documents" className="font-semibold underline">See plans →</Link>
        </div>
      )}
      {quota.overLimit && (
        <div className="mb-6 rounded-xl border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-900">
          You&apos;ve used all {limit} document uploads included in Free.{" "}
          <Link href="/app/billing?upgrade=documents" className="font-semibold underline">Upgrade to Plus for unlimited vault storage →</Link>
        </div>
      )}
      {quota.allowed && quota.remaining !== null && (
        <p className="mb-4 text-xs text-slate-500">{quota.remaining} upload{quota.remaining === 1 ? "" : "s"} remaining on Free.</p>
      )}

      <Card className="mb-6">
        <CardBody>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Add documents</h2>
          <VaultUpload
            kinds={catalog.map((item) => ({ kind: item.kind, name: item.name }))}
            defaultKind={bestMatch || "identity"}
            locked={!quota.allowed}
            lockLabel={quota.overLimit ? "Upgrade to Plus for unlimited uploads →" : "Unlock uploads with Plus →"}
          />
        </CardBody>
      </Card>

      {checklist.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Matching evidence</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {checklist.map((item) => {
              const isBest = item.kind === bestMatch;
              const have = docs.some((doc) => doc.docKind === item.kind);
              return (
                <Card key={item.kind} className={isBest ? "border-lime-400 ring-1 ring-lime-200" : ""}>
                  <CardBody>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">{item.label}</p>
                      <div className="flex flex-wrap justify-end gap-1">
                        {isBest && <Badge color="lime">Best match</Badge>}
                        {have ? <Badge color="green">On file</Badge> : <Badge>Needed</Badge>}
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{item.hint}</p>
                    {!have && (
                      <p className="mt-3 text-sm font-medium text-lime-700">
                        {quota.allowed ? `${documentStartLabel(item.kind)} using the form above.` : "Unlock uploads to add this."}
                      </p>
                    )}
                  </CardBody>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      <h2 className="mb-3 text-base font-semibold text-slate-900">Your vault</h2>
      {docs.length === 0 ? (
        <EmptyState
          title="Your vault is empty"
          body={bestMatch === "identity" || bestMatch === "relationship"
            ? intake.documentsEmptyIdentity
            : "Upload the matching evidence listed above. You can delete anything at any time."}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Type</th>
                <th className="hidden px-4 py-3 sm:table-cell">Case</th>
                <th className="hidden px-4 py-3 sm:table-cell">Uploaded</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {docs.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-3">
                    <Link href={`/api/files/${d.id}`} target="_blank" className="font-medium text-lime-600 underline">
                      {d.fileName}
                    </Link>
                    <p className="text-xs text-slate-400">{(d.sizeBytes / 1024).toFixed(0)} KB</p>
                  </td>
                  <td className="px-4 py-3"><Badge>{kindName(d.docKind)}</Badge></td>
                  <td className="hidden px-4 py-3 text-slate-500 sm:table-cell">
                    {d.case ? <Link href={`/app/cases/${d.case.id}`} className="underline">{d.case.title.slice(0, 30)}</Link> : "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-slate-500 sm:table-cell">{d.uploadedAt.toLocaleDateString("en-US")}</td>
                  <td className="px-4 py-3 text-right">
                    <form action={deleteDocumentAction.bind(null, d.id)}>
                      <button className="text-xs font-medium text-red-500 hover:text-red-700">Delete</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
