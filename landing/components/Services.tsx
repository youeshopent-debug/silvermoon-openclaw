'use client'

import { useLocale } from "@/lib/i18n"

const SERVICE_KEYS = [
  { title: 'services.discord', desc: 'services.discord_desc', icon: '🤖' },
  { title: 'services.webhook', desc: 'services.webhook_desc', icon: '⚡' },
  { title: 'services.agent', desc: 'services.agent_desc', icon: '🧠' },
] as const

export default function Services() {
  const { t } = useLocale()

  return (
    <section id="projects" className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-semibold text-center mb-4 tracking-tight">{t('services.title')}</h2>
        <p className="text-text-secondary text-center max-w-xl mx-auto mb-16">
          {t('services.title')}
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          {SERVICE_KEYS.map((svc) => (
            <div
              key={svc.title}
              className="rounded-xl border border-border-subtle bg-bg-card/60 backdrop-blur-xl p-8 group transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md"
            >
              <div className="w-10 h-10 rounded-full bg-accent-subtle flex items-center justify-center mb-5 border border-accent/20 group-hover:border-accent/30 transition-colors">
                <span className="text-accent text-lg">{svc.icon}</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">{t(svc.title as any)}</h3>
              <p className="text-text-secondary leading-relaxed">{t(svc.desc as any)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
