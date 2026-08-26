import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hasAdminArea } from "@/lib/auth";
import { formatCaseNumber } from "@/lib/case-number";

function canSearchCases(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  return Boolean(user && (hasAdminArea(user, "admin.cases") || hasAdminArea(user, "admin.ai")));
}

function parseCaseNumberQuery(q: string): number | null {
  const match = q.trim().match(/^(?:IMM[-\s]?)?0*(\d+)$/i);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!canSearchCases(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const number = parseCaseNumberQuery(q);
  const results = await db.case.findMany({
    where: {
      OR: [
        ...(number ? [{ number }] : []),
        { title: { contains: q, mode: "insensitive" as const } },
        { user: { email: { contains: q, mode: "insensitive" as const } } },
        { user: { phone: { contains: q } } },
        { user: { firstName: { contains: q, mode: "insensitive" as const } } },
        { user: { lastName: { contains: q, mode: "insensitive" as const } } },
      ],
    },
    take: 12,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      number: true,
      status: true,
      user: { select: { email: true, firstName: true, lastName: true, phone: true } },
    },
  });

  return NextResponse.json({
    results: results.map((c) => ({
      id: c.id,
      number: formatCaseNumber(c.number),
      title: c.title,
      status: c.status,
      owner: c.user
        ? `${c.user.firstName} ${c.user.lastName}`.trim() || c.user.email
        : "Guest",
      email: c.user?.email ?? "",
      phone: c.user?.phone ?? "",
    })),
  });
}
