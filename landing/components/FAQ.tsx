'use client'

import { useState } from "react"
import { useLocale } from "@/lib/i18n"

const FAQ_KEYS = ['faq.q1', 'faq.q2', 'faq.q3', 'faq.q4'] as const

export default function FAQ() {
  const { t } = useLocale()
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  return (
    <section id="faq" className="py-24 px-4 bg-bg-surface/30">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-semibold text-center mb-4 tracking-tight">{t('faq.title')}</h2>
        <p className="text-text-secondary text-center max-w-xl mx-auto mb-16">
          {t('faq.title')}
        </p>

        <div className="space-y-3">
          {FAQ_KEYS.map((key, i) => (
            <div key={key} className="rounded-xl border border-border-subtle bg-bg-card/60 backdrop-blur-xl overflow-hidden">
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-bg-elevated/50 transition-colors"
              >
                <span className="font-medium text-sm sm:text-base pr-4">
                  {t(key as any)}
                </span>
                <svg
                  className={`w-4 h-4 text-text-tertiary shrink-0 transition-transform ${openIdx === i ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openIdx === i && (
                <div className="px-5 pb-5 text-sm text-text-secondary leading-relaxed animate-fade-in">
                  {t(key as any)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
