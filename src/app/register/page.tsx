import Link from "next/link";
import { db } from "@/lib/db";
import { SiteHeader } from "@/components/site-nav";
import { RegisterForm } from "@/components/auth-forms";
import { getSetting } from "@/lib/settings";
import { getGuestSession } from "@/lib/guest";
import { readPendingGoogleProfile } from "@/lib/legal/record-registration";
import {
  PRIVACY_POLICY_SLUG,
  TERMS_OF_SERVICE_SLUG,
  USER_REGISTRATION_AGREEMENT_SLUG,
} from "@/lib/legal/documents";

export const metadata = { title: "Create your account" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; google?: string }>;
}) {
  const { type, google } = await searchParams;
  const asConsultant = type === "consultant";
  const [googleClientId, guest, pendingProfile] = await Promise.all([
    getSetting("auth.google_client_id", ""),
    getGuestSession(),
    asConsultant ? Promise.resolve(null) : readPendingGoogleProfile(),
  ]);
  const googlePending = !asConsultant && google === "pending" && !!pendingProfile;
  const guestQaCount = guest ? await db.qaThread.count({ where: { guestSessionId: guest.id } }) : 0;
  const pages = await db.contentPage.findMany({
    where: {
      isPublished: true,
      slug: {
        in: [USER_REGISTRATION_AGREEMENT_SLUG, TERMS_OF_SERVICE_SLUG, PRIVACY_POLICY_SLUG, "consultant-agreement"],
      },
    },
    select: { slug: true, title: true },
  });
  const pageBySlug = Object.fromEntries(pages.map((page) => [page.slug, page]));
  const hasGuestData = !!guest && (guest.situation.length > 0 || guest.goal.length > 0 || guestQaCount > 0);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-center text-2xl font-bold text-slate-900">
          {asConsultant
            ? "Join as a Immigration Consultant"
            : googlePending
              ? "Finish creating your account"
              : "Create your free account"}
        </h1>
        <p className="mt-1 text-center text-sm text-slate-500">
          {asConsultant
            ? "Partner with us to help applicants who need a professional."
            : googlePending
              ? "Review and accept the required consents to complete Google sign-up."
              : "Just the basics — no sensitive information needed. Required consents must be accepted to create an account."}
        </p>
        {hasGuestData && !asConsultant && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Your questions, answers, and uploads from before will be attached to your new account automatically. Paid plans keep a more personalized review, and Pro can match you with a licensed professional on ImmigrationOnMe.
          </div>
        )}
        {google === "pending" && !pendingProfile && !asConsultant && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Your Google sign-up expired. Accept the required consents below, then continue with Google again.
          </div>
        )}
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <RegisterForm
            asConsultant={asConsultant}
            googleEnabled={Boolean(googleClientId) && !asConsultant}
            googlePending={googlePending}
            pendingProfile={pendingProfile}
            userAgreement={pageBySlug[USER_REGISTRATION_AGREEMENT_SLUG] ?? null}
            terms={pageBySlug[TERMS_OF_SERVICE_SLUG] ?? null}
            privacy={pageBySlug[PRIVACY_POLICY_SLUG] ?? null}
            consultantAgreement={pageBySlug["consultant-agreement"] ?? null}
          />
        </div>
        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-lime-600 underline">Sign in</Link>
        </p>
      </main>
    </div>
  );
}
