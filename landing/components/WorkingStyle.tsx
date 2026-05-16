'use client'

import { useLocale } from "@/lib/i18n"

export default function WorkingStyle() {
  const { t } = useLocale()

  return (
    <section className="py-24 px-4 bg-bg-deep">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-semibold text-center mb-16 tracking-tight">{t('cases.title')}</h2>

        <div className="grid md:grid-cols-4 gap-4">
          {[
            { step: '1️⃣', title: t('cases.discordOps'), desc: t('cases.discordOps_desc') },
            { step: '2️⃣', title: t('cases.webhookPipeline'), desc: t('cases.webhookPipeline_desc') },
            { step: '3️⃣', title: t('services.agent'), desc: t('services.agent_desc') },
            { step: '4️⃣', title: t('hero.cta'), desc: t('hero.subtitle') },
          ].map((item, i) => (
            <div
              key={i}
              className="rounded-xl border border-border-subtle bg-bg-card/60 backdrop-blur-xl p-6 text-center group transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-md"
            >
              <div className="text-3xl mb-4">{item.step}</div>
              <h3 className="font-semibold mb-2">{item.title}</h3>
              <p className="text-sm text-text-secondary">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
