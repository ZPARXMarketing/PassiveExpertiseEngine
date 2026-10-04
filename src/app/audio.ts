import { createContext, useContext } from 'react'

/** One playable lecture. */
export interface Track {
  id: string
  url: string
  title: string
  subtitle: string
  fileName: string
}

/** Where the learner got to in a lecture (synced as the "listening" pref). */
export interface Progress {
  pos: number
  dur: number
  done: boolean
  at: string
}

export interface AudioApi {
  current: Track | null
  playing: boolean
  position: number
  duration: number
  rate: number
  play: (t: Track) => void
  toggle: () => void
  seek: (seconds: number) => void
  skip: (delta: number) => void
  setRate: (r: number) => void
  close: () => void
  progress: (id: string) => Progress | undefined
}

export const AudioCtx = createContext<AudioApi | null>(null)

/** The app-wide lecture player (keeps playing when sheets close or you navigate). */
export function useAudio(): AudioApi {
  const a = useContext(AudioCtx)
  if (!a) throw new Error('useAudio outside AudioProvider')
  return a
}

export const clock = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}
