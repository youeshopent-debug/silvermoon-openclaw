import { resolveChannels } from "../../lib/contact-channels";
import { resolveUpworkCta, resolveRequestQuoteCta } from "../../lib/cta-resolver";
import { t } from "../../lib/labels";

export default function HeroPage() {
  const channels = resolveChannels();
  const upworkCta = resolveUpworkCta(channels);
  const quoteCta = resolveRequestQuoteCta(channels);

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#05060a] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.45),rgba(34,211,238,0.0)_60%)] blur-2xl" />
        <div className="absolute -right-56 top-10 h-[640px] w-[640px] rounded-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.42),rgba(99,102,241,0.0)_60%)] blur-2xl" />
        <div className="absolute left-1/2 top-[55%] h-[720px] w-[980px] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse_at_center,rgba(236,72,153,0.18),rgba(236,72,153,0)_55%)] blur-2xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[size:60px_60px] opacity-[0.12]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.10),transparent_45%),radial-gradient(circle_at_70%_65%,rgba(255,255,255,0.08),transparent_50%)] opacity-[0.45]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(5,6,10,0.2),rgba(5,6,10,0.65)_65%,rgba(5,6,10,1))]" />
      </div>

      <header className="relative mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/70">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.7)]" />
            Global payments engineering
          </div>
          <div className="text-xs text-white/50">
            Proof-ready • Dark mode • React + Tailwind
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 pb-16 pt-6">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
          <section className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] tracking-wide text-white/70">
              <span className="rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/75">
                CASHCLAW
              </span>
              Evidence-first delivery for fintech automation
            </div>

            <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[56px] lg:leading-[1.05]">
              Engineer Your Global Payment Gateway
            </h1>
            <p className="mt-4 max-w-xl text-pretty text-base leading-7 text-white/72 sm:text-lg">
              Stripe &amp; Lemon Squeezy Integration Experts
            </p>

            <div className="mt-6 flex flex-wrap gap-2 text-xs text-white/70">
              {[
                "Checkout + Webhooks",
                "Subscriptions + Billing",
                "Connect / Marketplace",
                "Fraud‑aware pipelines",
              ].map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1"
                >
                  {t}
                </span>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={upworkCta.href}
                target="_blank"
                rel="noreferrer"
                className="group inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-white/14 to-white/6 px-5 py-3 text-sm font-medium text-white shadow-[0_0_0_1px_rgba(255,255,255,0.16),0_18px_50px_rgba(34,211,238,0.14)] backdrop-blur transition hover:shadow-[0_0_0_1px_rgba(255,255,255,0.22),0_22px_65px_rgba(34,211,238,0.18)]"
              >
                View proof
                <span className="ml-2 opacity-70 transition group-hover:opacity-100">
                  →
                </span>
              </a>
              <a
                href={quoteCta.type === "disabled" ? upworkCta.href : quoteCta.href}
                target={quoteCta.type === "external" || quoteCta.type === "disabled" ? "_blank" : undefined}
                rel={quoteCta.type === "external" || quoteCta.type === "disabled" ? "noreferrer" : undefined}
                className="inline-flex items-center justify-center rounded-xl border border-white/14 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white/85 backdrop-blur transition hover:bg-white/[0.06]"
              >
                {t(quoteCta.labelKey)}
              </a>
            </div>

            <div className="mt-8 grid max-w-xl grid-cols-3 gap-3 text-xs text-white/65">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="font-mono text-[10px] text-white/55">Latency</div>
                <div className="mt-2 text-sm font-semibold text-white">
                  &lt; 200ms
                </div>
                <div className="mt-1 text-[11px] text-white/55">
                  webhook handling
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="font-mono text-[10px] text-white/55">
                  Reliability
                </div>
                <div className="mt-2 text-sm font-semibold text-white">
                  Evidence‑logged
                </div>
                <div className="mt-1 text-[11px] text-white/55">
                  audit‑ready trail
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="font-mono text-[10px] text-white/55">Stack</div>
                <div className="mt-2 text-sm font-semibold text-white">
                  Node + React
                </div>
                <div className="mt-1 text-[11px] text-white/55">
                  ship fast, stay safe
                </div>
              </div>
            </div>
          </section>

          <aside className="lg:col-span-5">
            <div className="relative overflow-hidden rounded-2xl border border-white/12 bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.10),0_40px_120px_rgba(99,102,241,0.16)] backdrop-blur">
              <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.22),rgba(34,211,238,0)_60%)] blur-2xl" />
              <div className="absolute -left-20 bottom-[-90px] h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.22),rgba(99,102,241,0)_60%)] blur-2xl" />

              <div className="relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-white/20" />
                      <span className="h-2 w-2 rounded-full bg-white/20" />
                      <span className="h-2 w-2 rounded-full bg-white/20" />
                    </div>
                    <div className="font-mono text-xs text-white/60">
                      gateway.deploy
                    </div>
                  </div>
                  <div className="rounded-full border border-white/12 bg-white/[0.04] px-2 py-1 text-[11px] text-white/70">
                    Live
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white/90">
                        Payment flow integrity
                      </div>
                      <div className="mt-1 text-xs text-white/60">
                        idempotent • signed • evidence‑first
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-xs text-cyan-200/90">
                        OK
                      </div>
                      <div className="mt-1 text-[11px] text-white/55">
                        0 dropped events
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-[11px] text-white/65">
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                      <div className="font-mono text-[10px] text-white/55">
                        Stripe
                      </div>
                      <div className="mt-2 text-sm font-semibold text-white">
                        Webhooks
                      </div>
                      <div className="mt-1 text-[11px] text-white/55">
                        verify → persist → dispatch
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                      <div className="font-mono text-[10px] text-white/55">
                        Lemon Squeezy
                      </div>
                      <div className="mt-2 text-sm font-semibold text-white">
                        Billing
                      </div>
                      <div className="mt-1 text-[11px] text-white/55">
                        subs → tax → invoice
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.02] p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-[10px] text-white/55">
                        Signal
                      </div>
                      <div className="font-mono text-[10px] text-white/45">
                        last 60m
                      </div>
                    </div>
                    <div className="mt-3 h-20 w-full rounded-md bg-[linear-gradient(to_right,rgba(34,211,238,0.0),rgba(34,211,238,0.22),rgba(99,102,241,0.18),rgba(236,72,153,0.10))] opacity-80" />
                    <div className="mt-2 flex items-center justify-between text-[11px] text-white/55">
                      <span>events</span>
                      <span className="font-mono text-white/70">12,480</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-[11px] text-white/55">
                  <span className="font-mono">react • tailwind</span>
                  <span className="font-mono">dark‑mode hero</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
