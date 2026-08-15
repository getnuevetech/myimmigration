import { CreateAdminUserForm, AdminPermissionsForm } from "@/components/admin-user-forms";
import { Badge, Card, CardBody, PageHeader } from "@/components/admin-ui";
import { ADMIN_AREAS, type AdminAreaKey } from "@/lib/admin-areas";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser, requireAdmin } from "@/lib/auth";

function selectedAreas(adminRole: {
  scopeJson: string;
  permissions: { key: string; canView: boolean; canManage: boolean }[];
} | null): AdminAreaKey[] {
  const allowed = new Set(ADMIN_AREAS.map((area) => area.key));
  try {
    const scope = JSON.parse(adminRole?.scopeJson ?? "{}") as { all?: boolean; areas?: string[] };
    if (scope.all) return ADMIN_AREAS.map((area) => area.key);
    if (scope.areas) {
      return ADMIN_AREAS.map((area) => area.key).filter((key) => scope.areas?.includes(key));
    }
  } catch {
    // Fall back to explicit permission rows below.
  }
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
      <PageHeader
        title="Admin users"
        subtitle="Create backend admins and assign which areas they can manage."
      />

      {canManageAdmins && (
        <Card>
          <CardBody>
            <h2 className="text-sm font-semibold text-slate-900">Create admin</h2>
            <div className="mt-4">
              <CreateAdminUserForm />
            </div>
          </CardBody>
        </Card>
      )}

      <div className="space-y-4">
        {admins.map((admin) => {
          const areas = selectedAreas(admin.adminRole);
          return (
            <Card key={admin.id}>
              <CardBody>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-slate-900">{displayName(admin)}</h2>
                  <p className="text-sm text-slate-500">{admin.email}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {areas.map((key) => (
                      <Badge key={key} color="orange">
                        {ADMIN_AREAS.find((area) => area.key === key)?.label ?? key}
                      </Badge>
                    ))}
                    {areas.length === 0 && (
                      <Badge color="red">No admin areas</Badge>
                    )}
                  </div>
                </div>
                <Badge color={admin.status === "ACTIVE" ? "green" : "amber"}>{admin.status}</Badge>
              </div>
              {canManageAdmins && admin.id !== currentUser?.id && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <AdminPermissionsForm userId={admin.id} selected={areas} />
                </div>
              )}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
