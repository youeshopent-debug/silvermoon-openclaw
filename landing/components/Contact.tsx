import { resolveChannels, hasForm } from "../lib/contact-channels";
import { resolveUpworkCta, resolveFiverrCta } from "../lib/cta-resolver";
import { CtaLink } from "./CtaLink";

export function Contact() {
  const channels = resolveChannels();

  if (!hasForm(channels)) {
    const fiverrCta = resolveFiverrCta(channels);
    const upworkCta = resolveUpworkCta(channels);

    return (
      <section id="contact" className="mx-auto w-full max-w-5xl px-5 py-20 sm:py-24">
        <div className="mx-auto max-w-lg rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8 text-center">
          <div className="text-2xl font-semibold tracking-tight text-text-primary">Contact</div>
          <div className="mt-2 text-sm leading-6 text-text-secondary">
            Contact form is not enabled yet. Please message me on Upwork{fiverrCta ? " or Fiverr" : ""}.
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <CtaLink
              cta={upworkCta}
              className="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black hover:bg-accent-dim transition-colors"
            />
            {fiverrCta ? (
              <CtaLink
                cta={fiverrCta}
                className="inline-flex items-center justify-center rounded-lg border border-white/[0.10] bg-white/[0.04] px-4 py-2 text-sm font-medium text-text-primary hover:bg-white/[0.08] transition-colors"
              />
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="contact" className="mx-auto w-full max-w-5xl px-5 py-20 sm:py-24">
      <div className="mx-auto max-w-lg rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8">
        <div className="text-2xl font-semibold tracking-tight text-text-primary">Contact</div>
        <div className="mt-2 text-sm leading-6 text-text-secondary">
          Send a message. I&apos;ll reply with next steps and required access.
        </div>
        <form className="mt-6 grid gap-4" action={channels.formEndpoint!} method="POST">
          <input
            name="name"
            required
            placeholder="Your name"
            className="w-full rounded-lg border border-white/[0.10] bg-white/[0.04] px-3 py-2.5 text-sm text-text-primary placeholder-text-tertiary outline-none focus:border-accent/50 focus:bg-white/[0.06] transition-colors"
          />
          <input
            name="email"
            required
            type="email"
            placeholder="Email"
            className="w-full rounded-lg border border-white/[0.10] bg-white/[0.04] px-3 py-2.5 text-sm text-text-primary placeholder-text-tertiary outline-none focus:border-accent/50 focus:bg-white/[0.06] transition-colors"
          />
          <textarea
            name="message"
            required
            placeholder="What do you want to automate?"
            rows={6}
            className="w-full rounded-lg border border-white/[0.10] bg-white/[0.04] px-3 py-2.5 text-sm text-text-primary placeholder-text-tertiary outline-none focus:border-accent/50 focus:bg-white/[0.06] transition-colors resize-y"
          />
          <button
            type="submit"
            className="inline-flex w-fit items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-black hover:bg-accent-dim transition-colors"
          >
            Send message
          </button>
        </form>
      </div>
    </section>
  );
}
