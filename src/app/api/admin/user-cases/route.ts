import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hasAdminArea } from "@/lib/auth";
import { formatCaseNumber } from "@/lib/case-number";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  const allowed = user && (hasAdminArea(user, "admin.cases") || hasAdminArea(user, "admin.ai"));
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const userId = new URL(request.url).searchParams.get("userId")?.trim() ?? "";
  if (!userId) return NextResponse.json({ results: [] });

  const results = await db.case.findMany({
    where: { userId },
    take: 40,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      number: true,
      status: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    results: results.map((c) => ({
      id: c.id,
      number: formatCaseNumber(c.number),
      title: c.title,
      status: c.status,
      updatedAt: c.updatedAt.toISOString(),
    })),
  });
}
