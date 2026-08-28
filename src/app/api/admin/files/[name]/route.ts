import { NextResponse } from "next/server";
import { getCurrentUser, hasAdminArea } from "@/lib/auth";
import { readUpload, safeContentType } from "@/lib/uploads";

// Serves consultant credential documents (license proof, photo ID, insurance)
// to admins reviewing applications. Requires the Consultants admin area.
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const user = await getCurrentUser();
  if (!user || !hasAdminArea(user, "admin.consultants")) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  try {
    const buf = await readUpload(name);
    const lower = name.toLowerCase();
    const guessed = lower.endsWith(".pdf")
      ? "application/pdf"
      : lower.endsWith(".png")
        ? "image/png"
        : lower.endsWith(".jpg") || lower.endsWith(".jpeg")
          ? "image/jpeg"
          : lower.endsWith(".webp")
            ? "image/webp"
            : "application/octet-stream";
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": safeContentType(guessed),
        "Content-Disposition": `attachment; filename="${name.replace(/[^\w.\- ]/g, "_")}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
