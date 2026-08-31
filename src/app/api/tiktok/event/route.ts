import { NextResponse } from "next/server";
import { trackTikTokEvent, type TikTokStandardEvent } from "@/lib/tiktok-events";

const ALLOWED = new Set<TikTokStandardEvent>([
  "ViewContent",
  "Search",
  "Contact",
  "ClickButton",
  "AddToWishlist",
  "CompleteRegistration",
  "Lead",
  "SubmitForm",
]);

/**
 * Browser → server bridge for Events API (ViewContent / ClickButton).
 * Does not accept email/phone from the client (server actions hash those).
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const event = String(body.event ?? "") as TikTokStandardEvent;
  if (!ALLOWED.has(event)) return NextResponse.json({ ok: false }, { status: 400 });

  await trackTikTokEvent({
    event,
    eventId: typeof body.eventId === "string" ? body.eventId : undefined,
    url: typeof body.url === "string" ? body.url.slice(0, 2000) : undefined,
    contentId: typeof body.contentId === "string" ? body.contentId.slice(0, 120) : undefined,
    contentType: typeof body.contentType === "string" ? body.contentType.slice(0, 40) : undefined,
    contentName: typeof body.contentName === "string" ? body.contentName.slice(0, 200) : undefined,
    searchString: typeof body.searchString === "string" ? body.searchString.slice(0, 500) : undefined,
  });

  return NextResponse.json({ ok: true });
}
