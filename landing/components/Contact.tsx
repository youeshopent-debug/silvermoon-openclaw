"use client";

const UPWORK_URL = "https://www.upwork.com/freelancers/~01c1ade1ca83c8e544";
const FIVERR_URL = process.env.NEXT_PUBLIC_FIVERR_PROFILE_URL;

function hasEndpoint(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export function Contact() {
  const endpoint = process.env.NEXT_PUBLIC_FORMSPREE_ENDPOINT;
  const fiverrUrl = FIVERR_URL;

  if (!hasEndpoint(endpoint)) {
    const hasFiverr = hasEndpoint(fiverrUrl);

    return (
      <section id="contact" className="mx-auto w-full max-w-5xl px-5 py-16">
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="text-2xl font-semibold tracking-tight text-zinc-900">Contact</div>
          <div className="mt-2 text-sm leading-6 text-zinc-600">
            Contact form is not enabled yet. Please message me on {hasFiverr ? "Upwork or Fiverr" : "Upwork"}.
          </div>
          <div className="mt-6">
            <a
              className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              href={UPWORK_URL}
              target="_blank"
              rel="noreferrer"
            >
              Contact via Upwork
            </a>
            {hasFiverr ? (
              <a
                className="ml-3 inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                href={fiverrUrl}
                target="_blank"
                rel="noreferrer"
              >
                Contact via Fiverr
              </a>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="contact" className="mx-auto w-full max-w-5xl px-5 py-16">
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <div className="text-2xl font-semibold tracking-tight text-zinc-900">Contact</div>
        <div className="mt-2 text-sm leading-6 text-zinc-600">
          Send a message. I’ll reply with next steps and required access.
        </div>
        <form className="mt-6 grid gap-3" action={endpoint} method="POST">
          <input
            name="name"
            required
            placeholder="Your name"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          />
          <input
            name="email"
            required
            type="email"
            placeholder="Email"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          />
          <textarea
            name="message"
            required
            placeholder="What do you want to automate?"
            rows={6}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          />
          <button
            type="submit"
            className="inline-flex w-fit items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Send
          </button>
        </form>
      </div>
    </section>
  );
}
