'use client'

import { useLocale } from "@/lib/i18n"

export default function Footer() {
  const { t, locale } = useLocale()

  return (
    <footer className="border-t border-border-subtle py-12 px-4">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-accent font-bold">⚡ SilverMoon.bank</span>
          <span className="text-text-tertiary text-sm">— {t('footer.made')}</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-text-tertiary">
          <a href="https://discord.gg/silvermoon" target="_blank" rel="noopener noreferrer" className="hover:text-text-secondary transition-colors">
            💬 Discord
          </a>
          <a href="https://twitter.com/silvermoon" target="_blank" rel="noopener noreferrer" className="hover:text-text-secondary transition-colors">
            🐦 X / Twitter
          </a>
          <a href="mailto:hello@silvermoon.bank" className="hover:text-text-secondary transition-colors">
            ✉️ {t('contact.email')}
          </a>
        </div>
        <p className="text-xs text-text-tertiary">
          {t('footer.rights')}
        </p>
      </div>
    </footer>
  )
}
