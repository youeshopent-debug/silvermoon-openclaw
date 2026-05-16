'use client'

import { useLocale } from "@/lib/i18n"

export default function DeepCalmSection() {
  const { locale } = useLocale()

  const isZh = locale === 'zh'
  const title = isZh ? 'AI 心理健康避难所' : 'AI Mental Health Sanctuary'
  const badge = isZh ? '✦ 永久免费' : '✦ Free · Forever'
  const subtitle = isZh
    ? '免费的情绪支持与睡眠工具。无需注册，不留存对话，只为你留一盏月光。'
    : 'Free emotional support & sleep science. No sign-up. No data stored. Just you and the moonlight.'
  const cta = isZh ? '进入避难所' : 'Enter the Sanctuary'

  const features = isZh
    ? [
        { icon: '🧠', title: 'AI 咨询', desc: '用可执行的小步骤梳理情绪' },
        { icon: '🌙', title: '睡眠计算器', desc: '按 90 分钟周期规划起床时间' },
        { icon: '🔊', title: '3D 环境音', desc: '沉浸式声景，帮助放松与专注' },
      ]
    : [
        { icon: '🧠', title: 'AI Counselor', desc: 'Actionable steps to reframe anxious thoughts' },
        { icon: '🌙', title: 'Sleep Calculator', desc: 'Wake up at the end of a sleep cycle' },
        { icon: '🔊', title: '3D Soundscapes', desc: 'Immersive audio for calm & focus' },
      ]

  return (
    <section id="deepcalm" className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="rounded-2xl border border-border-subtle bg-gradient-to-r from-bg-surface to-bg-deep overflow-hidden">
          <div className="relative p-8 md:p-16">
            <div className="absolute inset-0 pointer-events-none [background:radial-gradient(ellipse_60%_50%_at_30%_50%,rgba(129,140,248,0.10)_0%,transparent_60%)]" />

            <div className="relative grid md:grid-cols-12 gap-10 items-center">
              <div className="md:col-span-5 flex items-center justify-center">
                <div className="relative w-48 h-48 md:w-64 md:h-64">
                  <svg className="w-full h-full" viewBox="0 0 200 200" fill="none">
                    <defs>
                      <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#818CF8" stopOpacity="0.16" />
                        <stop offset="100%" stopColor="#818CF8" stopOpacity="0" />
                      </radialGradient>
                    </defs>
                    <circle cx="100" cy="100" r="90" fill="url(#moonGlow)" />
                    <path
                      d="M130 50 C160 75 160 125 130 150 C110 160 85 155 70 140 C105 145 140 120 140 90 C140 70 125 55 100 50 C110 48 120 48 130 50Z"
                      fill="#818CF8"
                      opacity="0.66"
                    />
                    <circle cx="40" cy="60" r="1.5" fill="#818CF8" opacity="0.6" />
                    <circle cx="160" cy="40" r="1" fill="#818CF8" opacity="0.4" />
                    <circle cx="30" cy="130" r="1" fill="#818CF8" opacity="0.35" />
                    <circle cx="170" cy="140" r="1.5" fill="#818CF8" opacity="0.55" />
                    <circle cx="50" cy="170" r="0.8" fill="#818CF8" opacity="0.35" />
                    <circle cx="145" cy="30" r="0.8" fill="#818CF8" opacity="0.45" />
                  </svg>
                </div>
              </div>

              <div className="md:col-span-7 space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-secondary/20 bg-secondary/10 text-xs text-secondary">
                  {badge}
                </div>
                <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">{title}</h2>
                <p className="text-text-secondary leading-relaxed max-w-xl">{subtitle}</p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {features.map((f) => (
                    <div
                      key={f.title}
                      className="rounded-xl border border-border-subtle bg-white/[0.02] backdrop-blur-xl p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-secondary/30 hover:shadow-md"
                    >
                      <div className="w-9 h-9 rounded-full bg-secondary/10 flex items-center justify-center mb-3">
                        <span className="text-secondary text-lg">{f.icon}</span>
                      </div>
                      <h3 className="text-sm font-medium mb-1">{f.title}</h3>
                      <p className="text-xs text-text-tertiary leading-relaxed">{f.desc}</p>
                    </div>
                  ))}
                </div>

                <a
                  href="https://deepcalm-ai.vercel.app/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-secondary/10 border border-secondary/30 px-5 py-2.5 text-sm font-medium text-secondary transition-all duration-200 hover:bg-secondary/20"
                >
                  {cta}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

