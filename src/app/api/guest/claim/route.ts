import { NextRequest, NextResponse } from "next/server";
import { getOrCreateGuestSession } from "@/lib/guest-session";
import { prisma } from "@/lib/db/prisma";
import { claimGuestCasesForUser } from "@/lib/cases";
import { ensureFreeSubscriptionForUser } from "@/lib/subscriptions";
import { createSession, hashPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      email,
      firstName,
      lastName,
      password,
      acceptedTerms,
    }: {
      email: string;
      firstName?: string;
      lastName?: string;
      password?: string;
      acceptedTerms: boolean;
    } = body;

    if (!email?.trim()) {
      return NextResponse.json(
        { error: "Email is required to continue." },
        { status: 400 }
      );
    }

    if (!acceptedTerms) {
      return NextResponse.json(
        { error: "You must accept the terms to continue." },
        { status: 400 }
      );
    }

    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const session = await getOrCreateGuestSession();
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // If the email belongs to an existing account, do not silently claim it —
    // that would allow anyone who knows a victim's email to take over their
    // account and transfer cases to it without any ownership proof.
    if (existingUser) {
      return NextResponse.json(
        {
          error:
            "An account with this email already exists. Please sign in to link your case.",
          code: "EMAIL_EXISTS",
        },
        { status: 409 }
      );
    }

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
        passwordHash: await hashPassword(password),
        type: "REGULAR",
        status: "ACTIVE",
        mustAcceptTos: false,
      },
    });

    await prisma.guestSession.update({
      where: { id: session.id },
      data: { linkedUserId: user.id },
    });

    await claimGuestCasesForUser(session.id, user.id);
    await ensureFreeSubscriptionForUser(user.id);
    await createSession(user.id);

    return NextResponse.json({ userId: user.id });
  } catch {
    return NextResponse.json(
      { error: "We could not continue your case right now." },
      { status: 500 }
    );
  }
}
