import { SiteHeader, SiteFooter } from "@/components/site-nav";
import { IntakeWizard } from "@/components/intake-wizard";
import { resolvePublicStartCopy } from "@/lib/goal-public";
import { TikTokViewContent } from "@/components/tiktok-view-content";

export const metadata = { title: "Get help with your immigration situation" };

export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string }>;
}) {
  const { intent } = await searchParams;
  const start = resolvePublicStartCopy(intent);

  return (
    <div className="flex min-h-screen flex-col">
      <TikTokViewContent contentId="start" contentName="Start intake" />
      <SiteHeader />
      <main className="flex-1 px-4 py-12">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{start.title}</h1>
          <p className="mt-2 text-slate-600">{start.subtitle}</p>
        </div>
        <IntakeWizard start={start} />
      </main>
      <SiteFooter />
    </div>
  );
}
