const UPWORK_URL = "https://www.upwork.com/freelancers/~01c1ade1ca83c8e544";

export function Hero() {
  const endpoint = process.env.NEXT_PUBLIC_FORMSPREE_ENDPOINT;
  const contactToForm = typeof endpoint === "string" && endpoint.trim().length > 0;
  const fiverrUrl = process.env.NEXT_PUBLIC_FIVERR_PROFILE_URL;
  const hasFiverr = typeof fiverrUrl === "string" && fiverrUrl.trim().length > 0;

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto max-w-5xl px-5 py-16">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-900">
            Automation &amp; Agent Orchestration (Node.js)
          </h1>
          <p className="mt-4 text-base leading-7 text-zinc-600">
            Discord bots • Scheduled reports • Webhook/payment pipelines • Evidence-based delivery
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              href={UPWORK_URL}
              target="_blank"
              rel="noreferrer"
            >
              View Upwork Profile
            </a>
            {hasFiverr ? (
              <a
                className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                href={fiverrUrl}
                target="_blank"
                rel="noreferrer"
              >
                View Fiverr Profile
              </a>
            ) : null}
            <a
              className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
              href={contactToForm ? "#contact" : UPWORK_URL}
              target={contactToForm ? undefined : "_blank"}
              rel={contactToForm ? undefined : "noreferrer"}
            >
              Contact
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
