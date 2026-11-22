import { create } from 'zustand'

export interface Settings {
  bgm: boolean
  sfx: boolean
  /** 0~100 */
  bgmVol: number
  sfxVol: number
  vibe: boolean
  notifyJoin: boolean
  notifyReady: boolean
  notifyRematch: boolean
  lang: 'ko' | 'en' | 'ja'
  /** 사용 통계(GA) 동의: null = 아직 안 물어봄 */
  analytics: 'granted' | 'denied' | null
}
const DEFAULTS: Settings = { bgm: true, sfx: true, bgmVol: 70, sfxVol: 80, vibe: true, notifyJoin: true, notifyReady: true, notifyRematch: true, lang: 'ko', analytics: null }
const load = (): Settings => {
  try { return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem('duoplay-settings') ?? '{}') as Partial<Settings>) } } catch { return DEFAULTS }
}
export const useSettings = create<Settings & { set: (p: Partial<Settings>) => void }>((set, get) => ({
  ...load(),
  set: (p) => {
    set(p)
    try { const { set: _s, ...rest } = get(); void _s; localStorage.setItem('duoplay-settings', JSON.stringify(rest)) } catch { /* noop */ }
  },
}))
export const settings = () => useSettings.getState()
export function vibrate(pattern: number | number[]) { if (!settings().vibe) return; try { navigator.vibrate?.(pattern) } catch { /* noop */ } }

export const vol = (k: 'bgmVol' | 'sfxVol') => Math.max(0, Math.min(100, settings()[k] ?? 70)) / 100
