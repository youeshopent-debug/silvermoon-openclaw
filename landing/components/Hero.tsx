import { homeContent } from "../content/home";

export function Hero() {
  const { hero } = homeContent;

  return (
    <section className="relative min-h-dvh flex items-center overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(120,119,198,0.3),transparent)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,black,transparent)]" />
      <div className="relative mx-auto max-w-5xl px-5 pt-24 pb-16 w-full">
        <div className="max-w-2xl animate-[fade-in-up_0.6s_ease-out]">
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-text-primary leading-[1.1]">
            {hero.headline}
          </h1>
          <p className="mt-4 text-lg leading-7 text-text-secondary max-w-xl">
            {hero.subtitle}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#contact"
              className="inline-flex items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-black hover:bg-accent-dim transition-colors"
            >
              Get started
            </a>
            <a
              href="#services"
              className="inline-flex items-center justify-center rounded-lg border border-white/[0.10] bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-text-primary hover:bg-white/[0.08] transition-colors"
            >
              Explore services
            </a>
          </div>
        </div>
        {hero.tags.length > 0 && (
          <div className="mt-16 flex flex-wrap gap-2 animate-[fade-in_0.8s_ease-out]">
            {hero.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1 text-xs text-text-secondary"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
