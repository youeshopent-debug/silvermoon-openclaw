'use client'

let ctx: AudioContext | null = null
let masterGain: GainNode | null = null
let natureGain: GainNode | null = null
let musicGain: GainNode | null = null
let activeOscillators: OscillatorNode[] = []

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    masterGain = ctx.createGain()
    masterGain.gain.value = 0.4
    masterGain.connect(ctx.destination)

    natureGain = ctx.createGain()
    natureGain.gain.value = 0.3
    natureGain.connect(masterGain)

    musicGain = ctx.createGain()
    musicGain.gain.value = 0.15
    musicGain.connect(masterGain)
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function createBirdChirp() {
  const c = getCtx()
  if (!natureGain) return

  const osc = c.createOscillator()
  const gain = c.createGain()
  const now = c.currentTime

  osc.type = 'sine'
  osc.frequency.setValueAtTime(2000 + Math.random() * 1500, now)
  osc.frequency.exponentialRampToValueAtTime(3000 + Math.random() * 2000, now + 0.08)
  osc.frequency.exponentialRampToValueAtTime(1500 + Math.random() * 1000, now + 0.15)

  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.3, now + 0.02)
  gain.gain.linearRampToValueAtTime(0.2, now + 0.08)
  gain.gain.linearRampToValueAtTime(0, now + 0.25)

  osc.connect(gain)
  gain.connect(natureGain)
  osc.start(now)
  osc.stop(now + 0.3)

  activeOscillators.push(osc)
  osc.onended = () => {
    activeOscillators = activeOscillators.filter(o => o !== osc)
  }
}

function createCricket() {
  const c = getCtx()
  if (!natureGain) return

  const osc = c.createOscillator()
  const gain = c.createGain()
  const now = c.currentTime

  osc.type = 'sawtooth'
  const baseFreq = 4000 + Math.random() * 2000
  osc.frequency.setValueAtTime(baseFreq, now)
  osc.frequency.setValueAtTime(baseFreq * 1.05, now + 0.03)
  osc.frequency.setValueAtTime(baseFreq, now + 0.06)

  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.15, now + 0.01)
  gain.gain.linearRampToValueAtTime(0, now + 0.08)

  osc.connect(gain)
  gain.connect(natureGain)
  osc.start(now)
  osc.stop(now + 0.1)

  activeOscillators.push(osc)
  osc.onended = () => {
    activeOscillators = activeOscillators.filter(o => o !== osc)
  }
}

// Pentatonic scale notes for soft background music
const PENTATONIC = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25]
let musicInterval: ReturnType<typeof setInterval> | null = null

function playMusicNote() {
  const c = getCtx()
  if (!musicGain) return

  const osc = c.createOscillator()
  const gain = c.createGain()
  const now = c.currentTime

  osc.type = 'sine'
  const note = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)]
  osc.frequency.setValueAtTime(note, now)

  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.2, now + 0.3)
  gain.gain.linearRampToValueAtTime(0.15, now + 1)
  gain.gain.linearRampToValueAtTime(0, now + 2)

  osc.connect(gain)
  gain.connect(musicGain!)
  osc.start(now)
  osc.stop(now + 2.5)

  activeOscillators.push(osc)
  osc.onended = () => {
    activeOscillators = activeOscillators.filter(o => o !== osc)
  }
}

let natureInterval: ReturnType<typeof setInterval> | null = null

export function startNatureSounds() {
  stopNatureSounds()
  createBirdChirp()
  natureInterval = setInterval(() => {
    const r = Math.random()
    if (r < 0.5) createBirdChirp()
    else createCricket()
  }, 2000 + Math.random() * 3000)
}

export function stopNatureSounds() {
  if (natureInterval) {
    clearInterval(natureInterval)
    natureInterval = null
  }
}

export function startBackgroundMusic() {
  stopBackgroundMusic()
  playMusicNote()
  musicInterval = setInterval(playMusicNote, 2500 + Math.random() * 1500)
}

export function stopBackgroundMusic() {
  if (musicInterval) {
    clearInterval(musicInterval)
    musicInterval = null
  }
}

export function stopAll() {
  stopNatureSounds()
  stopBackgroundMusic()
  activeOscillators.forEach(o => {
    try { o.stop() } catch {}
  })
  activeOscillators = []
}

export function isPlaying(): boolean {
  return natureInterval !== null || musicInterval !== null
}
