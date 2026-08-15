export const ADMIN_AREAS = [
  { key: "admin.dashboard", label: "Dashboard" },
  { key: "admin.users", label: "Users" },
  { key: "admin.admins", label: "Admin users" },
  { key: "admin.ai", label: "AI providers" },
  { key: "admin.pipelines", label: "AI pipelines" },
  { key: "admin.settings", label: "Platform settings" },
] as const;

export type AdminAreaKey = (typeof ADMIN_AREAS)[number]["key"];

export const ALL_ADMIN_AREA_KEYS = ADMIN_AREAS.map((area) => area.key);
