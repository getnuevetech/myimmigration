import { Badge, Card, CardBody, PageHeader } from "@/components/admin-ui";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Content & agreements" };

export default async function AdminContentPage() {
  await requireAdmin("admin.content");

  const [pages, agreements] = await Promise.all([
    prisma.contentPage.findMany({ orderBy: { updatedAt: "desc" }, take: 50 }),
    prisma.agreementVersion.findMany({ orderBy: [{ target: "asc" }, { version: "desc" }], take: 50 }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content & agreements"
        subtitle="Review content pages and active legal agreement versions."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardBody>
            <h2 className="font-semibold text-slate-900">Content pages</h2>
            <div className="mt-4 space-y-3">
              {pages.length === 0 && <p className="text-sm text-slate-500">No content pages yet.</p>}
              {pages.map((page) => (
                <div key={page.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-slate-900">{page.title}</p>
                    <Badge color={page.published ? "green" : "slate"}>
                      {page.published ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{page.key} · v{page.version}</p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <h2 className="font-semibold text-slate-900">Agreement versions</h2>
            <div className="mt-4 space-y-3">
              {agreements.length === 0 && <p className="text-sm text-slate-500">No agreements yet.</p>}
              {agreements.map((agreement) => (
                <div key={agreement.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-slate-900">{agreement.title}</p>
                    <Badge color={agreement.active ? "green" : "slate"}>
                      {agreement.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {agreement.target} · v{agreement.version}
                  </p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
