"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword, getCurrentUser } from "@/lib/auth";
import { claimGuestSession } from "@/lib/guest";
import { ROLES } from "@/lib/constants";
import { LEGAL_AGREEMENT_VERSION, parseRegistrationConsents, OAUTH_GOOGLE_PENDING_COOKIE, OAUTH_CONSENTS_COOKIE } from "@/lib/legal/consents";
import { readPendingGoogleProfile, recordRegistrationLegal, setOauthConsentsCookie } from "@/lib/legal/record-registration";

export type ActionState = { error?: string; ok?: boolean; info?: string; link?: string } | null;

const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("A valid email is required"),
  phone: z.string().optional().default(""),
  address: z.string().optional().default(""),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const asConsultant = formData.get("asConsultant") === "1";
  const consents = parseRegistrationConsents(formData, { asConsultant });
  if (!consents.ok) return { error: consents.error };
  const { firstName, lastName, email, phone, address, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return { error: "An account with this email already exists. Try signing in." };

  const user = await db.user.create({
    data: {
      email: email.toLowerCase(),
      phone,
      address,
      firstName,
      lastName,
      passwordHash: await hashPassword(password),
      role: asConsultant ? ROLES.CONSULTANT : ROLES.USER,
    },
  });

  await recordRegistrationLegal({
    userId: user.id,
    grants: consents.grants,
    context: "registration",
    consultantAgreement: consents.consultantAgreement,
  });

  // Welcome message (admin-editable template).
  const { sendSystemMessage } = await import("@/lib/messaging");
  await sendSystemMessage("account_created", user, { link: asConsultant ? "/consultant" : "/app" });

  // Attach any pre-registration guest data (cases, documents, Q&A) to the new account.
  await claimGuestSession(user.id);
  await createSession(user.id);
  redirect(asConsultant ? "/consultant/onboarding" : "/app");
}

export async function startGoogleSignupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const consents = parseRegistrationConsents(formData);
  if (!consents.ok) return { error: consents.error };
  await setOauthConsentsCookie({
    version: LEGAL_AGREEMENT_VERSION,
    grants: consents.grants,
  });
  redirect("/api/auth/google");
}

export async function completeGoogleRegisterAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const pending = await readPendingGoogleProfile();
  if (!pending) {
    return { error: "Your Google sign-up expired. Continue with Google again and accept the required consents." };
  }
  const consents = parseRegistrationConsents(formData);
  if (!consents.ok) return { error: consents.error };

  const existing = await db.user.findUnique({ where: { email: pending.email } });
  if (existing) return { error: "An account with this email already exists. Try signing in." };

  const firstName = String(formData.get("firstName") ?? pending.firstName).trim() || pending.firstName;
  const lastName = String(formData.get("lastName") ?? pending.lastName).trim() || pending.lastName;

  const user = await db.user.create({
    data: {
      email: pending.email,
      googleId: pending.googleId,
      firstName,
      lastName,
      emailVerifiedAt: new Date(),
    },
  });

  await recordRegistrationLegal({
    userId: user.id,
    grants: consents.grants,
    context: "google_signup",
  });

  const store = await cookies();
  store.set(OAUTH_GOOGLE_PENDING_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" });
  store.set(OAUTH_CONSENTS_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" });

  const { sendSystemMessage } = await import("@/lib/messaging");
  await sendSystemMessage("account_created", user, { link: "/app" });
  await claimGuestSession(user.id);
  await createSession(user.id);
  redirect("/app");
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Invalid email or password." };
  }
  if (user.status !== "active") return { error: "This account is not active." };
  await claimGuestSession(user.id);
  await createSession(user.id);
  if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.ADMIN) redirect("/admin");
  if (user.role === ROLES.CONSULTANT) redirect("/consultant");
  redirect("/app");
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function deleteAccountAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Soft delete: the account moves to the admin "Deleted accounts" section and
  // is expunged automatically after the configured retention period.
  await db.user.update({
    where: { id: user.id },
    data: { status: "deleted", deletedAt: new Date() },
  });
  await destroySession();
  redirect("/?deleted=1");
}

// ---------- Password reset (customers & consultants) ----------

export async function requestPasswordResetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Enter your email address." };
  const user = await db.user.findUnique({ where: { email } });
  // Same response whether or not the account exists (no user enumeration).
  if (user && user.status === "active") {
    const { createResetLink } = await import("@/lib/password-reset");
    const link = await createResetLink(user.id);
    const { sendSystemMessage } = await import("@/lib/messaging");
    const sent = await sendSystemMessage("password_reset", user, { link });
    if (!sent) {
      const { sendMail } = await import("@/lib/mail");
      await sendMail(
        email,
        "Reset your password",
        `Hi ${user.firstName || ""},\n\nUse the link below to choose a new password. It expires in 1 hour.\n\n${link}\n\nIf you didn't request this, you can ignore this email.`,
      );
    }
  }
  return {
    ok: true,
  };
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Passwords don't match." };

  const { validateResetToken, consumeResetToken } = await import("@/lib/password-reset");
  const userId = await validateResetToken(token);
  if (!userId) return { error: "This reset link is invalid or has expired. Request a new one." };

  // Guard against resetting a soft-deleted or suspended account.
  const existingUser = await db.user.findUnique({ where: { id: userId }, select: { status: true } });
  if (!existingUser || existingUser.status !== "active") {
    return { error: "This account is not active. Contact support if you believe this is a mistake." };
  }

  const user = await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password) } });
  await consumeResetToken(token);
  await createSession(userId);
  if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.ADMIN) redirect("/admin");
  if (user.role === ROLES.CONSULTANT) redirect("/consultant");
  redirect("/app?reset=1");
}
