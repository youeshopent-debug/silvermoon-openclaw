'use client'

import { useState, useRef } from "react"
import { useLocale } from "@/lib/i18n"

interface Message {
  role: 'user' | 'ai'
  text: string
}

export default function AiCounselor() {
  const { t, locale } = useLocale()
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: t('counselor.welcome') }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const sendLabel = locale === 'zh' ? '发送' : locale === 'ms' ? 'HANTAR' : 'SEND'

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setLoading(true)

    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'ai',
        text: `🤔 ${t('counselor.welcome')} — "${userMsg.slice(0, 30)}..."`
      }])
      setLoading(false)
    }, 1000)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <section id="counselor" className="py-24 px-4">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
          💬 {t('counselor.title')}
        </h2>
        <p className="text-text-secondary text-center max-w-md mx-auto mb-12">
          {t('counselor.placeholder')}
        </p>

        <div className="glass-card p-6 space-y-4">
          <div className="h-72 overflow-y-auto space-y-3 pr-2 scroll-smooth" ref={endRef}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-accent text-bg-primary rounded-br-md'
                    : 'bg-bg-surface text-text-primary rounded-bl-md'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-bg-surface rounded-2xl rounded-bl-md px-4 py-2.5 text-sm text-text-tertiary">
                  <span className="animate-pulse">🤖 ...</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('counselor.placeholder')}
              className="flex-1 bg-bg-surface border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent/50 transition-colors"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="btn-primary px-6 py-3 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sendLabel}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
