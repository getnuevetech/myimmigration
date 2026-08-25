import { db } from "@/lib/db";
import { getGuestSession } from "@/lib/guest";
import { SiteHeader, SiteFooter } from "@/components/site-nav";
import { QaChat } from "@/components/qa-chat";
import { loadQaAccess } from "@/lib/qa-quota";
import { toQaChatAccess } from "@/lib/qa-access";

export const metadata = { title: "Ask an immigration question" };

export default async function GuestQaPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  const { thread: threadId } = await searchParams;
  const guest = await getGuestSession();
  const thread =
    threadId && guest
      ? await db.qaThread.findFirst({
          where: { id: threadId, guestSessionId: guest.id },
          include: { messages: { orderBy: { createdAt: "asc" } } },
        })
      : null;
  const access = await loadQaAccess({ guestSessionId: guest?.id });

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-extrabold text-slate-900">Ask anything about immigration matters</h1>
          <p className="mt-2 text-slate-600">Plain-English answers. Visitors get a short official overview — create an account for more, and paid plans keep a personalized review.</p>
        </div>
        <QaChat
          threadId={thread?.id ?? ""}
          messages={thread?.messages.map((m) => ({ id: m.id, role: m.role, content: m.content })) ?? []}
          access={toQaChatAccess(access.entitlement, access.usage)}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
