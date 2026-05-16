'use client'

import { useLocale } from "@/lib/i18n"

const CASE_KEYS = [
  { title: 'cases.discordOps', desc: 'cases.discordOps_desc', tag: 'Automation', icon: '🎯' },
  { title: 'cases.webhookPipeline', desc: 'cases.webhookPipeline_desc', tag: 'Pipeline', icon: '🔗' },
] as const

export default function CaseStudies() {
  const { t } = useLocale()

  return (
    <section id="proof" className="py-24 px-4 bg-bg-surface/50">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-semibold text-center mb-4 tracking-tight">{t('cases.title')}</h2>
        <p className="text-text-secondary text-center max-w-xl mx-auto mb-16">
          {t('cases.title')}
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          {CASE_KEYS.map((c) => (
            <div
              key={c.title}
              className="rounded-xl border border-border-subtle bg-bg-card/60 backdrop-blur-xl p-8 group transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">{c.icon}</span>
                <span className="text-xs font-medium text-accent bg-accent-subtle px-3 py-1 rounded-full">
                  {c.tag}
                </span>
              </div>
              <h3 className="text-xl font-semibold mb-3">{t(c.title as any)}</h3>
              <p className="text-text-secondary leading-relaxed">{t(c.desc as any)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
