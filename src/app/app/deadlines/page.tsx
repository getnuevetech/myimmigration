import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, CardBody, StateMark, EmptyState } from "@/components/ui";
import { setDeadlineStatusAction } from "@/actions/user";
import { AddDeadlineForm } from "@/components/deadline-form";
import { authorityQueriesForInquiry, classifyImmigrationInquiry } from "@/lib/immigration-inquiry";
import { resolveDeadlinesPageCopy } from "@/lib/goal-notices";

export const metadata = { title: "Deadlines" };

export default async function DeadlinesPage() {
  const user = await requireUser();
  const [deadlines, scopedCase] = await Promise.all([
    db.deadline.findMany({
      where: { userId: user.id },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    }),
    db.case.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        situation: true,
        goal: true,
        issues: { select: { title: true, uscisBasis: true, conclusion: true } },
        notices: { select: { noticeType: true } },
      },
    }),
  ]);
  const inquiry = scopedCase
    ? classifyImmigrationInquiry({ situation: scopedCase.situation, goal: scopedCase.goal })
    : null;
  const copy = resolveDeadlinesPageCopy({
    themes: inquiry?.themes,
    inquiryMode: inquiry?.mode,
    query: `${scopedCase?.situation ?? ""} ${scopedCase?.goal ?? ""}`,
    authorityQueries: inquiry ? authorityQueriesForInquiry(inquiry) : [],
    sources: (scopedCase?.issues ?? []).map((issue) => ({
      reference: issue.uscisBasis,
      title: issue.title,
      content: issue.conclusion,
    })),
    noticeTypes: (scopedCase?.notices ?? []).map((notice) => notice.noticeType),
    hasNotices: (scopedCase?.notices.length ?? 0) > 0,
    hasDeadlines: deadlines.length > 0,
  });
  const now = new Date();
  const soon = new Date();
  soon.setDate(soon.getDate() + 14);

  return (
    <div>
      <PageHeader title="Deadlines" subtitle={copy.pageSubtitle} />
      <Card className="mb-6">
        <CardBody>
          <AddDeadlineForm placeholder={copy.addPlaceholder} />
        </CardBody>
      </Card>
      {deadlines.length === 0 ? (
        <EmptyState title={copy.emptyTitle} body={copy.emptyBody} />
      ) : (
        <div className="space-y-3">
          {deadlines.map((d) => {
            const overdue = d.status === "open" && d.dueDate < now;
            const urgent = d.status === "open" && !overdue && d.dueDate <= soon;
            return (
              <Card key={d.id}>
                <CardBody className="flex items-center justify-between gap-3">
                  <div>
                    <p className={`font-medium ${d.status === "done" ? "text-slate-400 line-through" : "text-slate-900"}`}>{d.title}</p>
                    <p className="text-xs text-slate-500">
                      Due {d.dueDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      {d.source !== "manual" && ` · from ${d.source}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StateMark state={d.status === "done" ? "resolved" : overdue ? "urgent" : urgent ? "action_needed" : "review"} />
                    <form action={setDeadlineStatusAction.bind(null, d.id, d.status === "done" ? "open" : "done")}>
                      <button className="text-xs font-medium text-lime-600 hover:text-lime-800">
                        {d.status === "done" ? "Reopen" : "Mark done ✓"}
                      </button>
                    </form>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
