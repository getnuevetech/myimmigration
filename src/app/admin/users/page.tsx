import { setUserStatusAction } from "@/actions/admin-users";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth";

function formatName(user: { firstName: string | null; lastName: string | null; email: string }) {
  return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email;
}

export const metadata = { title: "Users" };

export default async function AdminUsersPage() {
  await requireAdmin("admin.users");

  const users = await prisma.user.findMany({
    where: { type: { in: ["REGULAR", "CONSULTANT"] } },
    orderBy: { createdAt: "desc" },
    include: {
      subscriptions: { include: { plan: true }, take: 1, orderBy: { createdAt: "desc" } },
      _count: { select: { cases: true, documents: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Users</h1>
        <p className="mt-1 text-sm text-slate-600">
          Review customer accounts, status, subscriptions, and case activity.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Activity</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  No users yet.
                </td>
              </tr>
            )}
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{formatName(user)}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{user.type}</td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {user.subscriptions[0]?.plan.name ?? "Free"}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {user._count.cases} cases · {user._count.documents} docs
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      user.status === "ACTIVE"
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {user.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {user.createdAt.toLocaleDateString("en-US")}
                </td>
                <td className="px-4 py-3 text-right">
                  <form
                    action={setUserStatusAction.bind(
                      null,
                      user.id,
                      user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"
                    )}
                  >
                    <button className="text-xs font-medium text-orange-700 hover:text-orange-900">
                      {user.status === "ACTIVE" ? "Suspend" : "Reactivate"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
