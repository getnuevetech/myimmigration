import { PageHeader, Card, CardBody } from "@/components/ui";
import { getSetting } from "@/lib/settings";

export const metadata = { title: "Your USCIS online account" };

export default async function IrsAccountPage() {
  const irsUrl = await getSetting("irs.account_url", "https://my.uscis.gov/");
  const steps = [
    { title: "Go to the USCIS website", body: "Open the official USCIS online account page. Only use official uscis.gov or my.uscis.gov pages." },
    { title: "Sign in or create an account", body: "Use your USCIS account to view available case status tools, notices, and online filings." },
    { title: "Collect your case details", body: "Copy receipt numbers, form types, filing dates, and recent status updates into your MyImmigration case." },
    { title: "Download available notices", body: "If USCIS provides a notice or confirmation PDF, save it and upload it to your document vault." },
    { title: "Upload records here", body: "Adding official records lets MyImmigration verify dates, receipt numbers, form types, and deadlines." },
  ];

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Set up your USCIS online account"
        subtitle="Your USCIS account can help you verify receipt numbers, case status, notices, and online filings."
      />
      <Card className="mb-6">
        <CardBody>
          <p className="text-sm leading-relaxed text-slate-600">
            With a USCIS online account, you may be able to view case status tools, online filings,
            receipt numbers, notices, and account messages. Uploading official records here means our
            analysis works with confirmed USCIS information instead of estimates.
          </p>
          <a
            href={irsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Open the official USCIS account page ↗
          </a>
        </CardBody>
      </Card>
      <div className="space-y-3">
        {steps.map((s, i) => (
          <Card key={i}>
            <CardBody className="flex gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold text-slate-900">{s.title}</p>
                <p className="mt-0.5 text-sm text-slate-600">{s.body}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
