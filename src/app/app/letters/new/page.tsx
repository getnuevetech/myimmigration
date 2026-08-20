import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { NewLetterForm } from "@/components/letter-forms";

export const metadata = { title: "Draft a response letter" };

export default async function NewLetterPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; case?: string }>;
}) {
  const { notice: noticeId, case: caseId } = await searchParams;
  const user = await requireUser();
  const notices = await db.notice.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, noticeType: true, caseYear: true },
  });

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Draft a response letter"
        subtitle="Tell us what the letter should say. We'll produce a professional draft you can edit before mailing it yourself."
      />
      <NewLetterForm
        notices={notices.map((n) => ({ id: n.id, label: `${n.noticeType || "Notice"}${n.caseYear ? ` · ${n.caseYear}` : ""}` }))}
        defaultNoticeId={noticeId ?? ""}
        defaultCaseId={caseId ?? ""}
      />
    </div>
  );
}
