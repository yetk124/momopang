import { useEffect, useRef, useState } from 'react'
import { Fit } from '../../components/ui'
import { sfx } from '../../lib/sfx'
import { useStore } from '../../store'
import type { GameProps } from '../rush/RushGame'
import { OMOK_MAX_TIMEOUTS, OMOK_N, type OmokState } from './engine'

const M = 10, GAP = 10, SIZE = M * 2 + GAP * (OMOK_N - 1) // 160
const STARS = [[3, 3], [3, 11], [11, 3], [11, 11], [7, 7]]
const pos = (i: number) => ({ x: M + (i % OMOK_N) * GAP, y: M + Math.floor(i / OMOK_N) * GAP })

/** 오목: 한 번 누르면 미리보기, 같은 자리를 한 번 더 누르면(또는 '여기에 두기') 착수 */
export function OmokGame({ state, t, meId, oppId }: GameProps<OmokState>) {
  const act = useStore((s) => s.act)
  const players = useStore((s) => s.room?.players ?? [])
  const oppName = players.find((p) => p.id === oppId)?.nickname ?? '상대'
  const myTurn = state.turn === meId && !state.winner && t >= state.turnStart
  const myColor = state.color[meId] ?? 1
  const [ghost, setGhost] = useState<number | null>(null)
  const svg = useRef<SVGSVGElement>(null)

  const lastMoves = useRef(state.moves)
  useEffect(() => { if (state.moves !== lastMoves.current) { lastMoves.current = state.moves; sfx.tap(); setGhost(null) } }, [state.moves])
  const turnRef = useRef(state.turn)
  useEffect(() => { if (state.turn !== turnRef.current) { turnRef.current = state.turn; setGhost(null); if (state.turn === meId) sfx.count() } }, [state.turn, meId])

  const place = (cell: number) => { if (myTurn && !state.board[cell]) { act({ cell }); setGhost(null) } }
  const onTap = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!myTurn) return
    const r = svg.current!.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * SIZE, y = ((e.clientY - r.top) / r.height) * SIZE
    const c = Math.round((x - M) / GAP), row = Math.round((y - M) / GAP)
    if (c < 0 || row < 0 || c >= OMOK_N || row >= OMOK_N) return
    const cell = row * OMOK_N + c
    if (state.board[cell]) return
    if (ghost === cell) place(cell)
    else { setGhost(cell); sfx.tap() }
  }

  const colorName = (v: number) => (v === 1 ? '흑' : '백')
  const status = state.winner
    ? (state.winner === meId ? '오목 완성! 🎉' : `${oppName}님이 오목을 완성했어요`)
    : t < state.turnStart ? '곧 시작해요'
    : myTurn ? (ghost !== null ? '한 번 더 누르면 돌을 둬요' : `내 차례 · ${colorName(myColor)}돌을 둘 자리를 골라요`)
    : `${oppName}님 차례 · 생각 중…`
  const winSet = new Set(state.line ?? [])

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2">
      <div className="flex items-center justify-between px-1 text-[13px] font-bold">
        <span className="flex items-center gap-1.5 text-ink-soft"><Stone v={myColor} size={14} />나 {colorName(myColor)}</span>
        <span className="text-ink-mute">시간 초과 {state.timeouts[meId] ?? 0}/{OMOK_MAX_TIMEOUTS}</span>
        <span className="flex items-center gap-1.5 text-ink-soft">상대 {colorName(myColor === 1 ? 2 : 1)}<Stone v={myColor === 1 ? 2 : 1} size={14} /></span>
      </div>
      <div className={`rounded-2xl px-4 py-2.5 text-center font-extrabold text-[15px] transition ${myTurn ? 'bg-lav-400 text-white shadow-pop' : 'bg-peach-100 text-ink'}`}>{status}</div>
      <Fit max={420}>
        <svg ref={svg} viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full touch-none select-none" onPointerDown={onTap} role="img" aria-label="오목판">
          <rect x="1" y="1" width={SIZE - 2} height={SIZE - 2} rx="7" fill="#F9CF8E" stroke="#7A4419" strokeWidth="1.6" />
          <rect x={M - 3} y={M - 3} width={GAP * (OMOK_N - 1) + 6} height={GAP * (OMOK_N - 1) + 6} rx="1.5" fill="none" stroke="#9B5A2A" strokeWidth="0.6" />
          {Array.from({ length: OMOK_N }, (_, i) => (
            <g key={i} stroke="#9B5A2A" strokeWidth="0.45">
              <line x1={M} x2={SIZE - M} y1={M + i * GAP} y2={M + i * GAP} />
              <line y1={M} y2={SIZE - M} x1={M + i * GAP} x2={M + i * GAP} />
            </g>
          ))}
          {STARS.map(([r, c]) => <circle key={`${r}-${c}`} cx={M + c * GAP} cy={M + r * GAP} r="1.2" fill="#7A4419" />)}
          {state.board.map((v, i) => {
            if (!v) return null
            const p = pos(i)
            return <StoneSvg key={i} x={p.x} y={p.y} v={v} win={winSet.has(i)} last={i === state.last && !state.winner} />
          })}
          {ghost !== null && !state.board[ghost] && (() => { const p = pos(ghost); return <g opacity="0.55"><StoneSvg x={p.x} y={p.y} v={myColor} /></g> })()}
        </svg>
      </Fit>
      {myTurn && ghost !== null ? (
        <button type="button" onClick={() => place(ghost)} className="press mx-auto rounded-full bg-lav-400 text-white font-extrabold px-6 py-2.5 text-[15px] shadow-pop">여기에 두기</button>
      ) : (
        <p className="mx-auto rounded-2xl bg-lav-50 text-lav-600 font-bold px-4 py-2.5 text-[13px] text-center">가로·세로·대각선 5개를 먼저 이으면 승리 · 한 수 20초</p>
      )}
    </div>
  )
}

function StoneSvg({ x, y, v, win, last }: { x: number; y: number; v: number; win?: boolean; last?: boolean }) {
  const id = v === 1 ? 'omok-b' : 'omok-w'
  return (
    <g>
      <defs>
        <radialGradient id="omok-b" cx="35%" cy="30%" r="75%"><stop offset="0%" stopColor="#6B6B6B" /><stop offset="55%" stopColor="#2E2E2E" /><stop offset="100%" stopColor="#151515" /></radialGradient>
        <radialGradient id="omok-w" cx="35%" cy="30%" r="80%"><stop offset="0%" stopColor="#FFFFFF" /><stop offset="70%" stopColor="#F1F1F1" /><stop offset="100%" stopColor="#CFCFCF" /></radialGradient>
      </defs>
      {win && <circle cx={x} cy={y} r="5.6" fill="none" stroke="#FF8A3D" strokeWidth="1.2" />}
      <circle cx={x} cy={y} r="4.4" fill={`url(#${id})`} stroke="#2B1D14" strokeWidth="0.7" />
      <circle cx={x - 1.4} cy={y - 1.5} r="0.9" fill="#fff" opacity={v === 1 ? 0.55 : 0.9} />
      {last && <circle cx={x} cy={y} r="1.1" fill="#FF5A4E" />}
    </g>
  )
}

function Stone({ v, size }: { v: number; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden>
      <circle cx="6" cy="6" r="5" fill={v === 1 ? '#262626' : '#FAFAFA'} stroke="#2B1D14" strokeWidth="1" />
    </svg>
  )
}
