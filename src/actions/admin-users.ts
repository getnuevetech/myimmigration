"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin, hashPassword } from "@/lib/auth";
import { ALL_ADMIN_AREA_KEYS, type AdminAreaKey } from "@/lib/admin-areas";
import type { AuthActionState } from "@/actions/auth";

function normalizeEmail(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeText(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function selectedAreas(formData: FormData): AdminAreaKey[] {
  const requested = new Set(formData.getAll("areas").map(String));
  return ALL_ADMIN_AREA_KEYS.filter((key): key is AdminAreaKey => requested.has(key));
}

export async function createAdminUserAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  await requireAdmin("admin.admins", true);

  const email = normalizeEmail(formData.get("email"));
  const firstName = normalizeText(formData.get("firstName"));
  const lastName = normalizeText(formData.get("lastName"));
  const password = String(formData.get("password") ?? "");
  const areas = selectedAreas(formData);

  if (!email.includes("@")) return { error: "Enter a valid email address." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (areas.length === 0) return { error: "Select at least one admin area." };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "A user with this email already exists." };

  await prisma.user.create({
    data: {
      email,
      firstName: firstName || null,
      lastName: lastName || null,
      passwordHash: await hashPassword(password),
      type: "ADMIN",
      status: "ACTIVE",
      mustAcceptTos: false,
      adminRole: {
        create: {
          name: `${firstName || email} admin`,
          description: "Admin user managed from MyImmigration.",
          scopeJson: JSON.stringify({ areas }),
          permissions: {
            create: areas.map((key) => ({ key, canView: true, canManage: true })),
          },
        },
      },
    },
  });

  revalidatePath("/admin/admins");
  return {};
}

export async function updateAdminPermissionsAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  await requireAdmin("admin.admins", true);

  const userId = normalizeText(formData.get("userId"));
  const areas = selectedAreas(formData);
  if (!userId) return { error: "User is required." };
  if (areas.length === 0) return { error: "Select at least one admin area." };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { adminRole: true },
  });
  if (!user || user.type !== "ADMIN") return { error: "Admin user not found." };

  const role = user.adminRole
    ? await prisma.adminRole.update({
        where: { id: user.adminRole.id },
        data: {
          scopeJson: JSON.stringify({ areas }),
          permissions: { deleteMany: {} },
        },
      })
    : await prisma.adminRole.create({
        data: {
          userId,
          name: `${user.firstName || user.email} admin`,
          description: "Admin user managed from MyImmigration.",
          scopeJson: JSON.stringify({ areas }),
        },
      });

  await prisma.adminPermission.createMany({
    data: areas.map((key) => ({ roleId: role.id, key, canView: true, canManage: true })),
  });

  revalidatePath("/admin/admins");
  return {};
}

export async function setUserStatusAction(userId: string, status: "ACTIVE" | "SUSPENDED") {
  await requireAdmin("admin.users", true);
  await prisma.user.update({
    where: { id: userId },
    data: { status },
  });
  revalidatePath("/admin/users");
  revalidatePath("/admin/admins");
}
