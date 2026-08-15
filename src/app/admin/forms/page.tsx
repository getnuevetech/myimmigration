import { Badge, Card, PageHeader } from "@/components/admin-ui";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "USCIS forms" };

export default async function AdminFormsPage() {
  await requireAdmin("admin.forms");

  const [templates, submissions] = await Promise.all([
    prisma.uscisFormTemplate.findMany({ orderBy: { formCode: "asc" } }),
    prisma.formSubmission.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { email: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="USCIS forms"
        subtitle="Review form templates and generated form submissions."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Template</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {templates.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                    No templates yet.
                  </td>
                </tr>
              )}
              {templates.map((template) => (
                <tr key={template.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{template.formCode}</p>
                    <p className="text-xs text-slate-500">{template.title}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={template.enabled ? "green" : "slate"}>
                      {template.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {template.updatedAt.toLocaleDateString("en-US")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Submission</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {submissions.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                    No submissions yet.
                  </td>
                </tr>
              )}
              {submissions.map((submission) => (
                <tr key={submission.id}>
                  <td className="px-4 py-3 text-xs text-slate-500">{submission.templateId}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{submission.user.email}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {submission.createdAt.toLocaleDateString("en-US")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
