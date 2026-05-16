'use client'

import { useLocale } from "@/lib/i18n"

export default function Hero() {
  const { t } = useLocale()

  return (
    <section className="relative flex min-h-[calc(100dvh-64px)] items-center justify-center overflow-hidden bg-bg-deep [background:radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(0,212,255,0.12)_0%,rgba(129,140,248,0.06)_40%,transparent_70%)]">
      <div className="absolute inset-0 bg-gradient-to-b from-bg-deep/50 via-transparent to-bg-deep pointer-events-none" />

      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto animate-fade-in-up">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border-subtle bg-white/[0.03] text-xs text-text-secondary mb-6">
          {t('hero.badge')}
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-semibold tracking-tight leading-[1.05] mb-6">
          {t('hero.title')}
        </h1>
        <p className="text-lg sm:text-xl text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
          {t('hero.subtitle')}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="#projects"
            className="inline-flex items-center justify-center rounded-lg bg-accent px-7 py-3.5 text-sm sm:text-base font-medium text-black transition-all duration-200 hover:bg-accent-dim hover:shadow-[0_0_20px_rgba(0,212,255,0.22)]"
          >
            {t('hero.cta')}
          </a>
          <a
            href="https://deepcalm-ai.vercel.app/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border-default bg-transparent px-7 py-3.5 text-sm sm:text-base font-medium text-text-secondary transition-all duration-200 hover:border-accent/50 hover:text-accent"
          >
            {t('hero.cta2')}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  )
}
