import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, CardBody } from "@/components/ui";
import { QaChat } from "@/components/qa-chat";

export const metadata = { title: "Ask the assistant" };

export default async function QaPage({
  searchParams,
}: {
  searchParams: Promise<{ case?: string }>;
}) {
  const { case: caseId } = await searchParams;
  const user = await requireUser();
  const linkedCase = caseId
    ? await db.case.findFirst({ where: { id: caseId, userId: user.id }, select: { id: true, title: true, number: true } })
    : null;
  const threads = await db.qaThread.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div>
      <PageHeader
        title={linkedCase ? `Ask about ${linkedCase.title}` : "Ask the assistant"}
        subtitle={linkedCase ? "This conversation is grounded in the compiled evidence for this case." : "Plain-English answers about your immigration case. Start a new conversation below."}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <QaChat threadId="" caseId={linkedCase?.id ?? ""} messages={[]} />
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Recent conversations</h2>
          <div className="space-y-2">
            {threads.length === 0 && <p className="text-sm text-slate-400">No conversations yet.</p>}
            {threads.map((t) => (
              <Link key={t.id} href={`/app/qa/${t.id}`} className="block">
                <Card className="transition hover:border-lime-300">
                  <CardBody className="!p-3">
                    <p className="truncate text-sm font-medium text-slate-800">{t.title}</p>
                    <p className="text-xs text-slate-400">{t.createdAt.toLocaleDateString("en-US")}</p>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
