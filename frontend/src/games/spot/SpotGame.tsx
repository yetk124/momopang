import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { sfx } from '../../lib/sfx'
import { useStore } from '../../store'
import type { GameProps } from '../rush/RushGame'
import { puzzleOf, type SpotState } from './engine'

export function SpotGame({ state, t, meId }: GameProps<SpotState>) {
  const act = useStore((s) => s.act)
  const pz = puzzleOf(state)
  const wrap = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 300, h: 600 })
  const [miss, setMiss] = useState<{ id: number; x: number; y: number } | null>(null)
  const [shake, setShake] = useState(0)

  useLayoutEffect(() => {
    const el = wrap.current; if (!el) return
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el); return () => ro.disconnect()
  }, [])

  // 판정 결과 피드백
  const lastT = useRef(state.last?.t ?? -1)
  useEffect(() => {
    const l = state.last
    if (!l || l.t === lastT.current) return
    lastT.current = l.t
    if (l.idx >= 0) sfx.pop()
    else if (l.pid === meId) { sfx.error(); setShake((x) => x + 1); const id = l.t; setMiss({ id, x: l.x, y: l.y }); setTimeout(() => setMiss((m) => (m?.id === id ? null : m)), 900) }
  }, [state.last, meId])

  // 세로 2단 vs 가로 2단 중 그림이 더 크게 보이는 배치
  const gap = 10, ar = pz.aspect
  const stackedW = Math.min(box.w, ((box.h - gap) / 2) * ar)
  const sideW = Math.min((box.w - gap) / 2, box.h * ar)
  const side = sideW > stackedW
  const pw = Math.floor(side ? sideW : stackedW), ph = Math.floor(pw / ar)

  const locked = t < (state.p[meId]?.lockUntil ?? 0)
  const total = pz.diffs.length
  const foundN = Object.keys(state.found).length
  const mx = (x: number) => (state.mirror ? 1 - x : x) // 화면 좌표 ↔ 원본 좌표

  const tap = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (locked) return
    const r = e.currentTarget.getBoundingClientRect()
    const sx = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height
    act({ x: mx(sx), y })
  }

  const panel = (src: string, label: string) => (
    <div className="relative rounded-2xl overflow-hidden shadow-card bg-white touch-none cursor-pointer" style={{ width: pw, height: ph }} onPointerDown={tap} role="button" aria-label={`${label} 그림에서 다른 곳 누르기`}>
      <img src={src} alt="" draggable={false} className="absolute inset-0 w-full h-full select-none pointer-events-none" style={state.mirror ? { transform: 'scaleX(-1)' } : undefined} />
      {pz.diffs.map((d, i) => {
        const who = state.found[i]
        if (who === undefined) return null
        const color = who === meId ? '#8F7BEA' : '#FF8A4C'
        return (
          <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ left: `${mx(d.x) * 100}%`, top: `${d.y * 100}%` }}>
            <svg viewBox="0 0 32 32" className="w-9 h-9 animate-pop drop-shadow-[0_2px_3px_rgba(0,0,0,.25)]" aria-hidden>
              <path d="M7 16.5l6 6L25.5 9" fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7 16.5l6 6L25.5 9" fill="none" stroke={color} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )
      })}
      {miss && (
        <div className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-pop" style={{ left: `${mx(miss.x) * 100}%`, top: `${miss.y * 100}%` }}>
          <svg viewBox="0 0 24 24" className="w-9 h-9 drop-shadow"><path d="M6 6l12 12M18 6L6 18" stroke="#fff" strokeWidth="6" strokeLinecap="round" /><path d="M6 6l12 12M18 6L6 18" stroke="#E5483D" strokeWidth="3.2" strokeLinecap="round" /></svg>
        </div>
      )}
      {locked && <div className="absolute inset-0 bg-white/25 pointer-events-none" />}
    </div>
  )

  return (
    <div className="flex-1 flex flex-col gap-2 min-h-0 no-select">
      <div className="flex items-center justify-between px-1">
        <span className="text-[13px] font-bold text-ink-soft">{pz.title}</span>
        <div className="flex items-center gap-1" aria-label={`${foundN}/${total} 찾음`}>
          {pz.diffs.map((_, i) => {
            const who = state.found[i]
            return <span key={i} className="w-3 h-3 rounded-full transition" style={{ background: who === undefined ? '#E7E1F5' : who === meId ? '#8F7BEA' : '#FF8A4C' }} />
          })}
        </div>
        <span className="text-[13px] font-extrabold tabular-nums">{foundN}/{total}</span>
      </div>
      <div ref={wrap} className="flex-1 min-h-0 flex items-center justify-center">
        <div key={shake} className={`flex ${side ? 'flex-row' : 'flex-col'} items-center ${shake ? 'animate-shake' : ''}`} style={{ gap }}>
          {panel(pz.a, '위쪽')}
          {panel(pz.b, '아래쪽')}
        </div>
      </div>
      <p className="text-center text-[13px] font-bold text-ink-soft">
        {locked ? '앗, 틀렸어요! 잠깐만 기다려요…' : <>두 그림에서 <b className="text-lav-500">다른 곳</b>을 먼저 누르면 +1 · 어느 쪽을 눌러도 돼요</>}
      </p>
    </div>
  )
}
