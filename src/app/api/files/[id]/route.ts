import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { getGuestSession } from "@/lib/guest";
import { readUpload, safeContentType, INLINE_SAFE_MIME_TYPES } from "@/lib/uploads";
import { consultantCanAccessClient } from "@/lib/case-access";

// Access-checked file serving: only the owner, their active consultant, or an
// admin can read a stored document.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc || doc.deletedAt) return new NextResponse("Not found", { status: 404 });

  const user = await getCurrentUser();
  let allowed = false;
  if (user) {
    if (doc.userId === user.id || isAdmin(user)) allowed = true;
    else if (doc.userId) {
      allowed = await consultantCanAccessClient({
        consultantId: user.id,
        clientUserId: doc.userId,
        caseId: doc.caseId,
      });
    }
  } else if (doc.guestSessionId) {
    const guest = await getGuestSession();
    allowed = !!guest && guest.id === doc.guestSessionId;
  }
  if (!allowed) return new NextResponse("Forbidden", { status: 403 });

  const buf = await readUpload(doc.filePath);
  const contentType = safeContentType(doc.mimeType);
  const disposition = INLINE_SAFE_MIME_TYPES.has(contentType) ? "inline" : "attachment";

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${disposition}; filename="${doc.fileName.replace(/[^\w.\- ]/g, "_")}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
