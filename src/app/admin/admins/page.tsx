import { CreateAdminUserForm, AdminPermissionsForm } from "@/components/admin-user-forms";
import { ADMIN_AREAS, type AdminAreaKey } from "@/lib/admin-areas";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser, requireAdmin } from "@/lib/auth";

function selectedAreas(adminRole: {
  permissions: { key: string; canView: boolean; canManage: boolean }[];
} | null): AdminAreaKey[] {
  const allowed = new Set(ADMIN_AREAS.map((area) => area.key));
  return (
    adminRole?.permissions
      .filter((permission) => permission.canView && allowed.has(permission.key as AdminAreaKey))
      .map((permission) => permission.key as AdminAreaKey) ?? []
  );
}

function displayName(user: { firstName: string | null; lastName: string | null; email: string }) {
  return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email;
}

export const metadata = { title: "Admin users" };

export default async function AdminUsersPage() {
  await requireAdmin("admin.admins");
  const currentUser = await getCurrentUser();
  const canManageAdmins =
    currentUser?.adminRole?.permissions.some(
      (permission) => permission.key === "admin.admins" && permission.canManage
    ) ?? false;

  const admins = await prisma.user.findMany({
    where: { type: "ADMIN" },
    orderBy: { createdAt: "asc" },
    include: { adminRole: { include: { permissions: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin users</h1>
        <p className="mt-1 text-sm text-slate-600">
          Create backend admins and assign which areas they can manage.
        </p>
      </div>

      {canManageAdmins && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Create admin</h2>
          <div className="mt-4">
            <CreateAdminUserForm />
          </div>
        </section>
      )}

      <div className="space-y-4">
        {admins.map((admin) => {
          const areas = selectedAreas(admin.adminRole);
          return (
            <section key={admin.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-slate-900">{displayName(admin)}</h2>
                  <p className="text-sm text-slate-500">{admin.email}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {areas.map((key) => (
                      <span key={key} className="rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-700">
                        {ADMIN_AREAS.find((area) => area.key === key)?.label ?? key}
                      </span>
                    ))}
                    {areas.length === 0 && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">
                        No admin areas
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    admin.status === "ACTIVE"
                      ? "bg-green-100 text-green-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {admin.status}
                </span>
              </div>
              {canManageAdmins && admin.id !== currentUser?.id && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <AdminPermissionsForm userId={admin.id} selected={areas} />
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
