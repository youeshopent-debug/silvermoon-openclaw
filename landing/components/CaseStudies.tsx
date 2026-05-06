import { homeContent } from "../content/home";
import { t } from "../lib/labels";

export function CaseStudies() {
  const { caseStudies } = homeContent;

  return (
    <section className="mx-auto w-full max-w-5xl px-5 py-20 sm:py-24">
      <div className="text-center">
        <div className="text-xs font-semibold tracking-widest uppercase text-accent">
          {caseStudies.kicker}
        </div>
        <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-text-primary">
          {caseStudies.title}
        </h2>
      </div>
      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {caseStudies.cases.map((c) => (
          <div
            key={c.titleKey}
            className="group overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] transition-all duration-300 hover:border-white/[0.10]"
          >
            <div className="relative aspect-video w-full overflow-hidden bg-bg-elevated">
              <img
                src={c.image}
                alt={t(c.titleKey)}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-bg-deep/60 to-transparent" />
            </div>
            <div className="p-5 sm:p-6">
              <div className="text-base font-semibold text-text-primary">
                {t(c.titleKey)}
              </div>
              <ul className="mt-3 space-y-1.5">
                {c.points.map((pt) => (
                  <li
                    key={pt}
                    className="text-sm leading-6 text-text-secondary before:mr-2 before:text-accent before:content-['→']"
                  >
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
