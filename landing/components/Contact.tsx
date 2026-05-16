'use client'

import { useState } from "react"
import { useLocale } from "@/lib/i18n"

export default function Contact() {
  const { t, locale } = useLocale()
  const [sent, setSent] = useState(false)

  const sendLabel = locale === 'zh' ? '发送' : locale === 'ms' ? 'HANTAR' : 'SEND'
  const sentLabel = locale === 'zh' ? '已发送' : locale === 'ms' ? 'Dihantar' : 'Sent'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSent(true)
    setTimeout(() => setSent(false), 3000)
  }

  return (
    <section id="contact" className="py-24 px-4">
      <div className="max-w-xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-semibold text-center mb-4 tracking-tight">{t('contact.title')}</h2>
        <p className="text-text-secondary text-center max-w-md mx-auto mb-12">
          {t('contact.title')}
        </p>

        <form onSubmit={handleSubmit} className="rounded-xl border border-border-subtle bg-bg-card/60 backdrop-blur-xl p-8 space-y-5">
          <div>
            <label className="block text-sm text-text-secondary mb-2">{t('contact.name')}</label>
            <input
              type="text"
              className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent/50 transition-colors"
              placeholder={t('contact.name')}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-2">{t('contact.email')}</label>
            <input
              type="email"
              className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent/50 transition-colors"
              placeholder={t('contact.email')}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-2">{t('contact.message')}</label>
            <textarea
              rows={4}
              className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent/50 transition-colors resize-none"
              placeholder={t('contact.message')}
              required
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-accent py-3 text-sm font-medium text-black transition-all duration-200 hover:bg-accent-dim hover:shadow-[0_0_20px_rgba(0,212,255,0.15)]"
          >
            {sent ? sentLabel : sendLabel}
          </button>
        </form>
      </div>
    </section>
  )
}
