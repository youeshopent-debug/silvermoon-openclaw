'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, createElement } from 'react'
import type { Locale, TranslationKey } from './translations'
import { LOCALES, translate, LOCALE_FLAGS } from './translations'

type LocaleContextType = {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: TranslationKey) => string
  flag: string
}

const LocaleContext = createContext<LocaleContextType | null>(null)

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('locale') as Locale | null
    if (saved && LOCALES.includes(saved)) setLocaleState(saved)
    setMounted(true)
  }, [])

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    localStorage.setItem('locale', l)
  }, [])

  const t = useCallback((key: TranslationKey) => translate(locale, key), [locale])
  const ctxValue = { locale, setLocale, t, flag: LOCALE_FLAGS[locale] }
  return createElement(
    LocaleContext.Provider,
    { value: ctxValue },
    children
  )
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider')
  return ctx
}
