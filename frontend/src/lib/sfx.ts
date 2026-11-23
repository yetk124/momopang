let ctx: AudioContext | null = null
import { settings, vibrate, vol } from './settings'
export const audioCtx = () => { try { ctx ??= new AudioContext(); if (ctx.state === 'suspended') void ctx.resume(); return ctx } catch { return null } }

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.15, delay = 0) {
  if (!settings().sfx) return
  try {
    ctx = audioCtx(); if (!ctx) return
    const o = ctx.createOscillator(); const g = ctx.createGain()
    o.type = type; o.frequency.value = freq
    const t = ctx.currentTime + delay
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * 1.5 * vol_()), t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02)
  } catch { /* audio not available */ }
}
const buzz = (ms: number) => vibrate(ms)
export const sfx = {
  tap: () => tone(660, 0.06, 'triangle', 0.08),
  pop: () => { tone(880, 0.08, 'triangle', 0.12); tone(1320, 0.1, 'triangle', 0.08, 0.05) },
  error: () => { tone(180, 0.15, 'square', 0.06); buzz(60) },
  bell: () => { tone(1568, 0.6, 'sine', 0.2); tone(2093, 0.5, 'sine', 0.1, 0.01); buzz(40) },
  count: () => tone(520, 0.12, 'sine', 0.12),
  go: () => tone(1040, 0.25, 'sine', 0.14),
  win: () => jingle('win'),
  lose: () => jingle('lose'),
  draw: () => jingle('draw'),
  flip: () => tone(420, 0.05, 'triangle', 0.08),
}

/** 결과 징글 (직접 만든 짧은 멜로디) */
function note(ctx: AudioContext, out: AudioNode, f: number, t: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) {
  const o = ctx.createOscillator(); const g = ctx.createGain()
  o.type = type; o.frequency.setValueAtTime(f, t)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05)
}
function jingle(kind: 'win' | 'lose' | 'draw') {
  if (!settings().sfx) return
  const c = audioCtx(); if (!c) return
  const out = c.createGain(); out.gain.value = 1.3 * vol('sfxVol'); out.connect(c.destination)
  const t0 = c.currentTime + 0.03
  const N = (m: number) => 440 * 2 ** ((m - 69) / 12) // MIDI → Hz
  if (kind === 'win') {
    // 빰-빰-빠-빰! + 반짝이는 화음
    ;[72, 76, 79, 84].forEach((m, i) => { note(c, out, N(m), t0 + i * 0.1, 0.22, 'square', 0.07); note(c, out, N(m), t0 + i * 0.1, 0.25, 'triangle', 0.12) })
    const tc = t0 + 0.45
    ;[72, 76, 79, 84].forEach((m) => note(c, out, N(m), tc, 0.9, 'triangle', 0.09))
    note(c, out, N(48), tc, 0.9, 'sine', 0.14)
    ;[96, 100, 103, 108].forEach((m, i) => note(c, out, N(m), tc + 0.08 + i * 0.07, 0.25, 'sine', 0.05))
    vibrate([30, 40, 30, 40, 80])
  } else if (kind === 'lose') {
    // 빠-밤-빠-밤~ (내려가는 아쉬운 소리)
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.connect(out)
    ;[67, 66, 65].forEach((m, i) => note(c, lp, N(m), t0 + i * 0.32, 0.3, 'sawtooth', 0.07))
    note(c, lp, N(64), t0 + 0.96, 0.9, 'sawtooth', 0.07, N(61))
    ;[55, 54, 53, 52].forEach((m, i) => note(c, out, N(m), t0 + i * 0.32, i === 3 ? 0.9 : 0.3, 'triangle', 0.08))
    vibrate(120)
  } else {
    // 무승부: 물음표 같은 두 음
    note(c, out, N(76), t0, 0.18, 'triangle', 0.1); note(c, out, N(79), t0 + 0.16, 0.18, 'triangle', 0.1)
    note(c, out, N(76), t0 + 0.34, 0.4, 'triangle', 0.1); note(c, out, N(81), t0 + 0.34, 0.4, 'sine', 0.05)
  }
}

function vol_() { return vol('sfxVol') }
