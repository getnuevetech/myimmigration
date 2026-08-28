import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hasAdminArea } from "@/lib/auth";
import { readUpload, safeContentType, INLINE_SAFE_MIME_TYPES } from "@/lib/uploads";

// Ticket attachments: visible to the ticket owner and support staff only.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const attachment = await db.ticketAttachment.findUnique({
    where: { id },
    include: { ticket: { select: { userId: true } } },
  });
  if (!attachment) return new NextResponse("Not found", { status: 404 });

  const user = await getCurrentUser();
  const allowed = user && (attachment.ticket.userId === user.id || hasAdminArea(user, "admin.tickets"));
  if (!allowed) return new NextResponse("Forbidden", { status: 403 });

  const buf = await readUpload(attachment.filePath);
  const contentType = safeContentType(attachment.mimeType);
  const disposition = INLINE_SAFE_MIME_TYPES.has(contentType) ? "inline" : "attachment";
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${disposition}; filename="${attachment.fileName.replace(/[^\w.\- ]/g, "_")}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
