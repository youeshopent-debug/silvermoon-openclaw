import { homeContent } from "../content/home";
import { t } from "../lib/labels";

export function Services() {
  const { services } = homeContent;

  return (
    <section className="mx-auto w-full max-w-5xl px-5 py-20 sm:py-24">
      <div className="text-center">
        <div className="text-xs font-semibold tracking-widest uppercase text-accent">
          {services.kicker}
        </div>
        <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-text-primary">
          {services.title}
        </h2>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {services.cards.map((card, i) => (
          <div
            key={card.titleKey}
            className="group relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all duration-300 hover:border-accent/30 hover:bg-white/[0.04]"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.04] text-sm font-bold text-accent">
              {i + 1}
            </div>
            <div className="text-base font-semibold text-text-primary">
              {t(card.titleKey)}
            </div>
            <div className="mt-2 text-sm leading-6 text-text-secondary">
              {t(card.bodyKey)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
