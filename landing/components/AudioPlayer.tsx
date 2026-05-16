'use client'

import { useState, useEffect } from "react"
import { useLocale } from "@/lib/i18n"
import { startNatureSounds, stopNatureSounds, startBackgroundMusic, stopBackgroundMusic, stopAll } from "@/lib/audioEngine"

export default function AudioPlayer() {
  const { t } = useLocale()
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    return () => { stopAll() }
  }, [])

  const toggle = () => {
    if (playing) {
      stopAll()
      setPlaying(false)
    } else {
      startNatureSounds()
      startBackgroundMusic()
      setPlaying(true)
    }
  }

  return (
    <button
      onClick={toggle}
      className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-accent/20 backdrop-blur-md border border-accent/30 flex items-center justify-center text-lg hover:bg-accent/30 transition-all shadow-lg"
      title={playing ? t('music.pause') : t('music.play')}
    >
      {playing ? '🔊' : '🔇'}
    </button>
  )
}
