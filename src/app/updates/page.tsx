import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/site-nav";
import { ButtonLink, Badge } from "@/components/ui";
import { Accent, Kicker } from "@/components/accent";
import { getCurrentUser } from "@/lib/auth";
import { getUpdateImpactsForUser, getUscisUpdates } from "@/lib/uscis-updates";

export const metadata = { title: "USCIS updates" };

export default async function UpdatesPage() {
  const [updates, user] = await Promise.all([getUscisUpdates(30), getCurrentUser().catch(() => null)]);
  const impactEntries = user
    ? await Promise.all(updates.map(async (update) => [update.url, await getUpdateImpactsForUser(user.id, update)] as const))
    : [];
  const impactsByUrl = new Map(impactEntries);
  const paidAnalysisAvailable = impactEntries.some(([, result]) => result.allowed);

  return (
    <div className="flex min-h-screen flex-col bg-[#fbfaf7]">
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <Kicker>USCIS updates</Kicker>
            <h1 className="mt-5 max-w-3xl font-serif text-5xl font-bold leading-tight text-slate-900">
              <Accent text="Latest public USCIS news and alerts" />
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600">
              We monitor public USCIS updates and news. Paid customers also see deterministic notes when an update appears to touch forms, notices, or topics present in their active cases.
            </p>
            {!user ? (
              <div className="mt-6 flex flex-wrap gap-3">
                <ButtonLink href="/login" variant="secondary" className="rounded-full">Sign in for case impact notes</ButtonLink>
                <ButtonLink href="/pricing" className="rounded-full">See plans →</ButtonLink>
              </div>
            ) : !paidAnalysisAvailable ? (
              <div className="mt-6 rounded-xl border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-900">
                Case-impact notes are included with paid plans. <Link href="/app/billing" className="font-semibold underline">Upgrade to unlock them →</Link>
              </div>
            ) : null}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12">
          {updates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
              USCIS updates are temporarily unavailable. Visit <a href="https://www.uscis.gov/newsroom" className="font-semibold text-lime-700 underline">USCIS Newsroom</a> directly.
            </div>
          ) : (
            <div className="space-y-4">
              {updates.map((update) => {
                const impact = impactsByUrl.get(update.url);
                return (
                  <article key={update.url} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge color="lime">USCIS</Badge>
                      {update.publishedAt && <span className="text-xs text-slate-400">{new Date(update.publishedAt).toLocaleDateString("en-US")}</span>}
                    </div>
                    <h2 className="mt-3 font-serif text-2xl font-bold leading-snug text-slate-900">
                      <a href={update.url} target="_blank" rel="noreferrer" className="hover:text-lime-700">{update.title}</a>
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{update.summary}</p>
                    {impact?.allowed && impact.impacts.length > 0 && (
                      <div className="mt-4 rounded-xl border border-lime-200 bg-lime-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-lime-600">Possible impact on your cases</p>
                        <ul className="mt-2 space-y-2">
                          {impact.impacts.map((item) => (
                            <li key={`${update.url}-${item.caseId}`} className="text-sm text-lime-900">
                              <Link href={`/app/cases/${item.caseId}`} className="font-semibold underline">{item.caseRef}</Link>
                              {" "}{item.caseTitle}: {item.reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {impact?.allowed && impact.impacts.length === 0 && (
                      <p className="mt-3 text-xs text-slate-400">No active case match detected from the visible update text.</p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
