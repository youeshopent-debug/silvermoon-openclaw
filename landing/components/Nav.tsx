'use client'

import { useState, useRef, useEffect } from "react"
import { useLocale } from "@/lib/i18n"
import { LOCALE_LABELS, LOCALE_FLAGS, LOCALES } from "@/lib/i18n/translations"

const NAV_ITEMS = [
  { key: 'nav.projects', href: '#projects' },
  { key: 'nav.deepcalm', href: '#deepcalm' },
  { key: 'nav.contact', href: '#contact' },
] as const

export default function Nav() {
  const { locale, setLocale, t } = useLocale()
  const [menuOpen, setMenuOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const langRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-bg-deep/80 backdrop-blur-xl border-b border-border-subtle">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <a href="#" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-text-primary">
            <svg className="w-7 h-7 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
            <span>SilverMoon Bank</span>
          </a>

          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.key}
                href={item.href}
                className="px-3 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors rounded-lg hover:bg-bg-elevated"
              >
                {t(item.key as any)}
              </a>
            ))}

            <div className="w-px h-5 bg-border-default mx-2" />

            <div className="relative" ref={langRef}>
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors rounded-lg hover:bg-bg-elevated"
              >
                <span>{LOCALE_FLAGS[locale]}</span>
                <span>{LOCALE_LABELS[locale]}</span>
                <svg className={`w-3 h-3 transition-transform ${langOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {langOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-bg-card border border-border-default rounded-xl shadow-2xl overflow-hidden">
                  {LOCALES.map((l) => (
                    <button
                      key={l}
                      onClick={() => { setLocale(l); setLangOpen(false) }}
                      className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-bg-elevated ${
                        l === locale ? 'text-accent bg-accent-subtle' : 'text-text-secondary'
                      }`}
                    >
                      <span>{LOCALE_FLAGS[l]}</span>
                      <span>{LOCALE_LABELS[l]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 text-text-secondary hover:text-text-primary"
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-border-subtle bg-bg-deep/95 backdrop-blur-xl">
          <div className="px-4 py-3 space-y-1">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.key}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2.5 text-sm text-text-secondary hover:text-text-primary rounded-lg hover:bg-bg-elevated"
              >
                {t(item.key as any)}
              </a>
            ))}
            <div className="border-t border-border-subtle pt-2 mt-2">
              <p className="px-3 pb-1 text-xs text-text-tertiary uppercase tracking-wider">Language</p>
              {LOCALES.map((l) => (
                <button
                  key={l}
                  onClick={() => { setLocale(l); setMenuOpen(false) }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg ${
                    l === locale ? 'text-accent bg-accent-subtle' : 'text-text-secondary'
                  }`}
                >
                  <span>{LOCALE_FLAGS[l]}</span>
                  <span>{LOCALE_LABELS[l]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
