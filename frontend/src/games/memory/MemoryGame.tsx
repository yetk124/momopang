import { useEffect, useRef, useState } from 'react'
import { audioCtx, sfx } from '../../lib/sfx'
import { settings, vol } from '../../lib/settings'
import { useStore } from '../../store'
import { Fit } from '../../components/ui'
import type { GameProps } from '../rush/RushGame'
import { LIT_MS, MEM_COLORS, MEM_ROUNDS, STEP_MS, type MemState } from './engine'

const NAMES = ['빨강', '노랑', '파랑', '초록']
function note(c: number) {
  if (!settings().sfx) return
  const actx = audioCtx(); if (!actx) return
  try { const o = actx.createOscillator(); const g = actx.createGain(); o.frequency.value = [392, 494, 587, 698][c]; o.type = 'triangle'; g.gain.setValueAtTime(Math.max(0.0002, 0.18 * vol('sfxVol')), actx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.3); o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + 0.32) } catch { /* noop */ }
}

export function MemoryGame({ state, t, meId, oppId }: GameProps<MemState>) {
  const act = useStore((s) => s.act)
  const me = state.p[meId]; const opp = state.p[oppId]
  const [press, setPress] = useState<number | null>(null)
  const len = state.seq.length

  // 보여주기 단계: 현재 켜진 색
  let lit: number | null = null
  if (state.phase === 'show') {
    const e = t - state.showStart
    const i = Math.floor(e / STEP_MS)
    if (e >= 0 && i < len && e - i * STEP_MS < LIT_MS) lit = state.seq[i]
  }
  const lastLit = useRef<string>('')
  useEffect(() => {
    if (lit === null) return
    const k = `${state.round}-${Math.floor((t - state.showStart) / STEP_MS)}`
    if (k !== lastLit.current) { lastLit.current = k; note(lit) }
  }, [lit, t, state.round, state.showStart])
  const failKey = useRef(false)
  useEffect(() => { if (me?.failed && !failKey.current) sfx.error(); if (me?.done && !failKey.current) sfx.pop(); failKey.current = !!(me?.failed || me?.done) }, [me?.failed, me?.done])

  if (!me) return null
  const canInput = state.phase === 'input' && !me.done && !me.failed
  const status = state.phase === 'show' ? '순서를 기억하세요!' : state.phase === 'input' ? (me.failed ? '앗, 틀렸어요! 이번 판은 여기까지' : me.done ? (state.firstDone === meId ? '1등 성공! +2' : '성공! +1') : '같은 순서로 눌러요!') : state.phase === 'reveal' ? '다음 라운드 준비…' : ''

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <div className="flex items-center justify-between text-[13px] font-bold">
        <span className="text-ink-mute">라운드 {state.round + 1}/{MEM_ROUNDS} · {len}개</span>
        <span className="rounded-full bg-white/80 px-3 py-1 tabular-nums">상대 {opp?.failed ? '실패' : opp?.done ? '성공!' : `${opp?.idx ?? 0}/${len}`}</span>
      </div>
      <p key={status} className="text-center font-round text-[24px] animate-pop">{status}</p>
      <div className="flex justify-center gap-1.5">
        {state.seq.map((_, i) => (
          <span key={i} className="w-3.5 h-3.5 rounded-full transition" style={{ background: state.phase === 'reveal' || me.failed ? MEM_COLORS[state.seq[i]] : i < me.idx ? '#8F7BEA' : '#E7E1F5' }} />
        ))}
      </div>
      <Fit max={320}>
        <div className="grid grid-cols-2 grid-rows-2 gap-4 w-full h-full p-1">
          {MEM_COLORS.map((c, i) => {
            const on = lit === i || press === i
            return (
              <button key={i} aria-label={NAMES[i]} disabled={!canInput}
                onPointerDown={(e) => { e.preventDefault(); if (!canInput) return; note(i); setPress(i); setTimeout(() => setPress((p) => (p === i ? null : p)), 180); act({ c: i }) }}
                className="w-full h-full rounded-full transition-all duration-100 disabled:cursor-default"
                style={{ background: c, opacity: on ? 1 : state.phase === 'show' ? 0.45 : canInput ? 0.9 : 0.55, transform: on ? 'scale(1.06)' : 'scale(1)', boxShadow: on ? `0 0 0 6px #fff, 0 0 30px ${c}` : 'inset 0 -8px 0 rgba(0,0,0,.12), 0 6px 14px -6px rgba(0,0,0,.25)' }} />
            )
          })}
        </div>
      </Fit>
      <p className="mx-auto rounded-2xl bg-lav-50 text-lav-600 font-bold px-4 py-2.5 text-[14px] text-center">다 맞히면 +1 · 먼저 끝내면 +1 더 · 라운드마다 하나씩 길어져요</p>
    </div>
  )
}
