export const ADMIN_AREAS = [
  { key: "admin.dashboard", label: "Dashboard" },
  { key: "admin.cases", label: "Cases" },
  { key: "admin.users", label: "Users" },
  { key: "admin.admins", label: "Admin users" },
  { key: "admin.consultants", label: "Consultants" },
  { key: "admin.assignments", label: "Assignments" },
  { key: "admin.plans", label: "Plans & access" },
  { key: "admin.payments", label: "Payment gateways" },
  { key: "admin.transactions", label: "Transactions" },
  { key: "admin.ai", label: "AI providers" },
  { key: "admin.pipelines", label: "AI pipelines" },
  { key: "admin.content", label: "Content & agreements" },
  { key: "admin.forms", label: "USCIS forms" },
  { key: "admin.notifications", label: "Notifications" },
  { key: "admin.logs", label: "Audit logs" },
  { key: "admin.settings", label: "Platform settings" },
] as const;

export type AdminAreaKey = (typeof ADMIN_AREAS)[number]["key"];

export const ALL_ADMIN_AREA_KEYS = ADMIN_AREAS.map((area) => area.key);
