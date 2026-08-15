import { Badge, Card, PageHeader } from "@/components/admin-ui";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Notifications" };

export default async function AdminNotificationsPage() {
  await requireAdmin("admin.notifications");

  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { email: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle="Inspect user and system notification records."
      />
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Notification</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {notifications.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  No notifications yet.
                </td>
              </tr>
            )}
            {notifications.map((notification) => (
              <tr key={notification.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{notification.title}</p>
                  <p className="max-w-md truncate text-xs text-slate-500">{notification.body}</p>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{notification.user.email}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{notification.type}</td>
                <td className="px-4 py-3">
                  <Badge color={notification.readAt ? "slate" : "orange"}>
                    {notification.readAt ? "Read" : "Unread"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {notification.createdAt.toLocaleDateString("en-US")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
