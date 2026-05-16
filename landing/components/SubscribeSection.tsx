'use client'

import { useState } from "react"
import { useLocale } from "@/lib/i18n"

export default function SubscribeSection() {
  const { t } = useLocale()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('loading')

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      })
      const data = await res.json()
      if (res.ok) {
        setStatus('success')
        setMsg(t('subscribe.success'))
        setEmail('')
      } else {
        setStatus('error')
        setMsg(data.error || 'Error')
      }
    } catch {
      setStatus('error')
      setMsg('Network error')
    }
  }

  return (
    <section id="subscribe" className="py-24 px-4">
      <div className="max-w-lg mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-semibold mb-4 tracking-tight">{t('subscribe.title')}</h2>
        <p className="text-text-secondary mb-8">
          {t('subscribe.title')}
        </p>

        <form onSubmit={handleSubmit} className="rounded-xl border border-border-subtle bg-bg-card/60 backdrop-blur-xl p-6">
          <div className="flex gap-3">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={t('subscribe.placeholder')}
              className="flex-1 bg-bg-surface border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent/50"
              required
              disabled={status === 'loading'}
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="rounded-lg bg-accent px-6 py-3 text-sm font-medium text-black transition-all duration-200 hover:bg-accent-dim hover:shadow-[0_0_20px_rgba(0,212,255,0.15)] disabled:opacity-40"
            >
              {status === 'loading' ? '...' : t('subscribe.button')}
            </button>
          </div>

          {status === 'success' && (
            <p className="mt-4 text-sm text-green-400">{msg}</p>
          )}
          {status === 'error' && (
            <p className="mt-4 text-sm text-red-400">{msg}</p>
          )}
        </form>
      </div>
    </section>
  )
}
