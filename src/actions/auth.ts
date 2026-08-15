"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import {
  claimCurrentGuestSession,
  createSession,
  destroySession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { ALL_ADMIN_AREA_KEYS } from "@/lib/admin-areas";
import { ensureFreeSubscriptionForUser } from "@/lib/subscriptions";

export type AuthActionState = {
  error?: string;
};

function normalizeEmail(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeText(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  return null;
}

export async function registerAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = normalizeEmail(formData.get("email"));
  const firstName = normalizeText(formData.get("firstName"));
  const lastName = normalizeText(formData.get("lastName"));
  const password = String(formData.get("password") ?? "");
  const acceptedTerms = formData.get("acceptedTerms") === "on";

  if (!email.includes("@")) return { error: "Enter a valid email address." };
  const passwordError = validatePassword(password);
  if (passwordError) return { error: passwordError };
  if (!acceptedTerms) return { error: "You must accept the terms to create an account." };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with this email already exists. Please sign in." };

  const user = await prisma.user.create({
    data: {
      email,
      firstName: firstName || null,
      lastName: lastName || null,
      passwordHash: await hashPassword(password),
      type: "REGULAR",
      status: "ACTIVE",
      mustAcceptTos: false,
    },
  });

  await claimCurrentGuestSession(user.id);
  await ensureFreeSubscriptionForUser(user.id);
  await createSession(user.id);
  redirect("/dashboard");
}

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");

  const user = await prisma.user.findUnique({
    where: { email },
    include: { adminRole: { include: { permissions: true } } },
  });
  if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Invalid email or password." };
  }
  if (user.status !== "ACTIVE") return { error: "This account is not active." };

  await claimCurrentGuestSession(user.id);
  await createSession(user.id);
  redirect(user.type === "ADMIN" ? "/admin" : "/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}

export async function bootstrapAdminAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const adminCount = await prisma.user.count({ where: { type: "ADMIN" } });
  if (adminCount > 0) return { error: "Admin bootstrap is already complete." };

  const email = normalizeEmail(formData.get("email"));
  const firstName = normalizeText(formData.get("firstName"));
  const lastName = normalizeText(formData.get("lastName"));
  const password = String(formData.get("password") ?? "");

  if (!email.includes("@")) return { error: "Enter a valid email address." };
  const passwordError = validatePassword(password);
  if (passwordError) return { error: passwordError };

  const user = await prisma.user.create({
    data: {
      email,
      firstName: firstName || "Admin",
      lastName: lastName || null,
      passwordHash: await hashPassword(password),
      type: "ADMIN",
      status: "ACTIVE",
      mustAcceptTos: false,
      adminRole: {
        create: {
          name: "Super admin",
          description: "Initial administrator with access to every admin area.",
          scopeJson: JSON.stringify({ all: true }),
          permissions: {
            create: ALL_ADMIN_AREA_KEYS.map((key) => ({
              key,
              canView: true,
              canManage: true,
            })),
          },
        },
      },
    },
  });

  await createSession(user.id);
  revalidatePath("/admin");
  redirect("/admin");
}
