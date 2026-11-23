import gameLoopUrl from '../assets/audio/game-loop.mp3'
import { audioCtx } from './sfx'
import { useSettings, vol } from './settings'

/**
 * 배경음
 * - menu: 홈·대기방 — 오르골 느낌 아르페지오 (WebAudio로 생성)
 * - game: 게임 중 — cozy_fantasy_acoustic_loop (끊김 없이 반복)
 */
const menuLevel = () => 0.85 * vol('bgmVol')
const gameLevel = () => 0.75 * vol('bgmVol')
export type MusicMode = 'menu' | 'game' | 'off'
let mode: MusicMode = 'menu'
let unlocked = false

// ── 메뉴 음악 (생성) ──
let timer: ReturnType<typeof setTimeout> | null = null
let menuGain: GainNode | null = null
let step = 0
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5]
const CHORDS = [[0, 2, 4, 2], [1, 3, 5, 3], [0, 2, 3, 4], [2, 4, 5, 4]]
function pluck(freq: number, when: number, vol: number) {
  const ctx = audioCtx(); if (!ctx || !menuGain) return
  const o = ctx.createOscillator(); const g = ctx.createGain()
  o.type = 'triangle'; o.frequency.value = freq
  g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(vol, when + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.9)
  o.connect(g).connect(menuGain); o.start(when); o.stop(when + 1)
}
function menuLoop() {
  const ctx = audioCtx(); if (!ctx || !menuGain) return
  const chord = CHORDS[Math.floor(step / 4) % CHORDS.length]
  pluck(SCALE[chord[step % 4]], ctx.currentTime + 0.02, 0.05)
  if (step % 4 === 0) pluck(SCALE[chord[0]] / 2, ctx.currentTime + 0.02, 0.04)
  step++
  timer = setTimeout(menuLoop, 420)
}
function startMenu() {
  if (timer) return
  const ctx = audioCtx(); if (!ctx) return
  menuGain = ctx.createGain(); menuGain.gain.value = menuLevel()
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800
  menuGain.connect(lp).connect(ctx.destination)
  menuLoop()
}
function stopMenu() { if (timer) clearTimeout(timer); timer = null; try { menuGain?.disconnect() } catch { /* noop */ } menuGain = null }

// ── 게임 음악 (파일, AudioBuffer로 gapless 반복) ──
let buffer: AudioBuffer | null = null
let loading: Promise<AudioBuffer | null> | null = null
let src: AudioBufferSourceNode | null = null
let gameGain: GainNode | null = null
const LOOP_SEC = 17.142857 // 원본 wav 길이
const MP3_DELAY = 1105 / 44100 // 인코더 앞쪽 지연 → 이 구간을 건너뛰어 이음새를 없앰
function loadBuffer() {
  const ctx = audioCtx(); if (!ctx) return Promise.resolve(null)
  const bytes = gameLoopUrl.startsWith('data:')
    ? Promise.resolve(Uint8Array.from(atob(gameLoopUrl.split(',')[1]), (c) => c.charCodeAt(0)).buffer) // 한 파일 빌드(데모)용
    : fetch(gameLoopUrl).then((r) => r.arrayBuffer())
  loading ??= bytes.then((ab) => ctx.decodeAudioData(ab)).then((b) => (buffer = b)).catch(() => null)
  return loading
}
async function startGame() {
  if (src) return
  const ctx = audioCtx(); if (!ctx) return
  const b = buffer ?? (await loadBuffer())
  if (!b || mode !== 'game' || src || !useSettings.getState().bgm) return
  gameGain = ctx.createGain(); gameGain.gain.setValueAtTime(0.0001, ctx.currentTime); gameGain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gameLevel()), ctx.currentTime + 0.8)
  gameGain.connect(ctx.destination)
  src = ctx.createBufferSource(); src.buffer = b; src.loop = true
  if (b.duration >= MP3_DELAY + LOOP_SEC) { src.loopStart = MP3_DELAY; src.loopEnd = MP3_DELAY + LOOP_SEC }
  src.connect(gameGain); src.start(0, src.loopStart || 0)
}
function stopGame() {
  const ctx = audioCtx()
  if (src && gameGain && ctx) {
    const s = src, g = gameGain
    g.gain.setValueAtTime(g.gain.value, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4)
    setTimeout(() => { try { s.stop(); g.disconnect() } catch { /* noop */ } }, 450)
  }
  src = null; gameGain = null
}

function apply() {
  if (!unlocked) return
  const on = useSettings.getState().bgm
  if (!on || mode === 'off') { stopMenu(); stopGame(); return }
  if (mode === 'game') { stopMenu(); void startGame() } else { stopGame(); startMenu() }
}
export function setMusicMode(m: MusicMode) { if (m === mode) return; mode = m; apply() }
/** 결과 화면 징글이 잘 들리게 잠깐 음악을 줄였다가 복구 */
export function duckMusic(ms = 2200) {
  const ctx = audioCtx(); const g = gameGain ?? menuGain; if (!ctx || !g) return
  const v = Math.max(0.0002, g === gameGain ? gameLevel() : menuLevel())
  g.gain.cancelScheduledValues(ctx.currentTime)
  g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), ctx.currentTime); g.gain.linearRampToValueAtTime(v * 0.15, ctx.currentTime + 0.15)
  g.gain.linearRampToValueAtTime(v, ctx.currentTime + ms / 1000)
}

// 브라우저 정책상 첫 터치 이후에만 소리 재생 가능
let armed = false
export function armBgm() {
  if (armed) return; armed = true
  const go = () => { unlocked = true; void loadBuffer(); apply(); window.removeEventListener('pointerdown', go) }
  window.addEventListener('pointerdown', go)
  useSettings.subscribe((s, prev) => {
    if (s.bgm !== prev.bgm) apply()
    if (s.bgmVol !== prev.bgmVol) {
      const ctx = audioCtx(); if (!ctx) return
      if (menuGain) menuGain.gain.setTargetAtTime(menuLevel(), ctx.currentTime, 0.05)
      if (gameGain) gameGain.gain.setTargetAtTime(Math.max(0.0002, gameLevel()), ctx.currentTime, 0.05)
    }
  })
  document.addEventListener('visibilitychange', () => {
    const ctx = audioCtx(); if (!ctx) return
    if (document.visibilityState === 'hidden') void ctx.suspend(); else void ctx.resume()
  })
}
