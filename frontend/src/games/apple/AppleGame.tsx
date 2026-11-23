import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { sfx } from '../../lib/sfx'
import { onEph, useStore } from '../../store'
import { cleanRect } from '../../net/validate'
import type { GameProps } from '../rush/RushGame'
import { COLS, ROWS, normRect, rectCells, type AppleState, type Rect } from './engine'

function useFit(ref: React.RefObject<HTMLDivElement>, cols: number, rows: number) {
  const [cell, setCell] = useState(30)
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return
    const ro = new ResizeObserver(() => setCell(Math.floor(Math.min(el.clientWidth / cols, el.clientHeight / rows))))
    ro.observe(el); return () => ro.disconnect()
  }, [ref, cols, rows])
  return cell
}

export function AppleGame({ state, meId }: GameProps<AppleState>) {
  const { act, eph } = useStore.getState()
  const wrap = useRef<HTMLDivElement>(null)
  const board = useRef<HTMLDivElement>(null)
  const cell = useFit(wrap, COLS, ROWS)
  const [sel, setSel] = useState<Rect | null>(null)
  const [opSel, setOpSel] = useState<Rect | null>(null)
  const [bad, setBad] = useState(0)
  const [ghosts, setGhosts] = useState<{ id: number; cells: number[]; mine: boolean; nums: number[] }[]>([])
  const start = useRef<{ r: number; c: number } | null>(null)
  const lastSent = useRef(0)
  const prevBoard = useRef(state.board)

  useEffect(() => onEph((from, k, d) => { if (k === 'sel' && from !== meId) { const r = cleanRect(d); if (r !== undefined) setOpSel(r) } }), [meId])
  // 제거 애니메이션
  useEffect(() => {
    const prev = prevBoard.current; prevBoard.current = state.board
    const removed = state.board.map((v, i) => (prev[i] > 0 && v === 0 ? i : -1)).filter((i) => i >= 0)
    if (!removed.length) return
    const mine = state.last?.pid === meId
    if (mine) sfx.pop()
    const g = { id: Date.now() + Math.random(), cells: removed, mine, nums: removed.map((i) => prev[i]) }
    setGhosts((x) => [...x, g]); setTimeout(() => setGhosts((x) => x.filter((y) => y.id !== g.id)), 600)
    if (opSel && !mine) setOpSel(null)
  }, [state.board]) // eslint-disable-line react-hooks/exhaustive-deps

  const at = (e: React.PointerEvent) => {
    const r = board.current!.getBoundingClientRect()
    return { r: Math.max(0, Math.min(ROWS - 1, Math.floor((e.clientY - r.top) / cell))), c: Math.max(0, Math.min(COLS - 1, Math.floor((e.clientX - r.left) / cell))) }
  }
  const sendSel = (r: Rect | null, force = false) => { const now = Date.now(); if (force || now - lastSent.current > 90) { lastSent.current = now; eph('sel', r) } }
  const onDown = (e: React.PointerEvent) => { e.preventDefault(); (e.currentTarget as Element).setPointerCapture?.(e.pointerId); const p = at(e); start.current = p; const r = { r1: p.r, c1: p.c, r2: p.r, c2: p.c }; setSel(r); sendSel(r) }
  const onMove = (e: React.PointerEvent) => { if (!start.current) return; const p = at(e); const r = normRect({ r1: start.current.r, c1: start.current.c, r2: p.r, c2: p.c }); setSel(r); sendSel(r) }
  const onUp = () => {
    if (!start.current || !sel) return
    start.current = null
    const sum = rectCells(sel).reduce((a, i) => a + state.board[i], 0)
    if (sum === 10) act(sel)
    else if (rectCells(sel).filter((i) => state.board[i] > 0).length > 1) { setBad((x) => x + 1); sfx.error() }
    setSel(null); sendSel(null, true)
  }
  const sum = sel ? rectCells(sel).reduce((a, i) => a + state.board[i], 0) : 0
  const me = state.p[meId]
  const W = cell * COLS, H = cell * ROWS
  const box = (r: Rect) => ({ left: r.c1 * cell, top: r.r1 * cell, width: (r.c2 - r.c1 + 1) * cell, height: (r.r2 - r.r1 + 1) * cell })

  return (
    <div className="flex-1 flex flex-col gap-2 min-h-0">
      <div className="flex items-center justify-between text-[13px] font-bold px-1">
        <span className="text-ink-soft">콤보 <b className="text-apple tabular-nums">{me?.combo ?? 0}</b></span>
        <span className={`rounded-full px-3 py-1 tabular-nums transition ${sel ? (sum === 10 ? 'bg-mint-300 text-ink' : sum > 10 ? 'bg-[#FFE4E1] text-[#C9433A]' : 'bg-white text-ink') : 'bg-white/60 text-ink-mute'}`}>합 {sum} / 10</span>
        <span className="text-ink-soft">제거 <b className="tabular-nums">{me?.removed ?? 0}</b></span>
      </div>
      <div ref={wrap} className="flex-1 min-h-0 flex items-center justify-center">
        <div
          ref={board} key={bad} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          className={`relative rounded-3xl bg-[#F3FAE8] shadow-card touch-none ${bad ? 'animate-shake' : ''}`}
          style={{ width: W, height: H, backgroundImage: 'linear-gradient(#E3F1D2 1px,transparent 1px),linear-gradient(90deg,#E3F1D2 1px,transparent 1px)', backgroundSize: `${cell}px ${cell}px` }}
        >
          {state.board.map((v, i) => v > 0 && (
            <AppleCell key={i} v={v} x={(i % COLS) * cell} y={Math.floor(i / COLS) * cell} s={cell} hl={!!sel && i >= 0 && inRect(sel, i)} />
          ))}
          {ghosts.map((g) => g.cells.map((i, k) => (
            <div key={`${g.id}-${i}`} className="absolute pointer-events-none" style={{ left: (i % COLS) * cell, top: Math.floor(i / COLS) * cell, width: cell, height: cell, animation: 'appleOut .55s ease-in forwards' }}>
              <AppleSvg v={g.nums[k]} tint={g.mine ? undefined : '#FFB08A'} />
            </div>
          )))}
          {opSel && <div className="absolute rounded-xl border-[3px] border-peach-400 bg-peach-200/30 pointer-events-none" style={box(opSel)} />}
          {sel && <div className={`absolute rounded-xl border-[3px] pointer-events-none ${sum === 10 ? 'border-mint-500 bg-mint-300/30' : 'border-lav-500 bg-lav-200/30'}`} style={box(sel)} />}
        </div>
      </div>
      <p className="text-center text-[13px] font-bold text-ink-soft">드래그해서 합이 <b className="text-apple">10</b>이 되게 골라요 · <span className="text-peach-400">주황 테두리</span>는 상대 선택</p>
      <style>{'@keyframes appleOut{to{transform:translateY(-40px) scale(.4);opacity:0}}'}</style>
    </div>
  )
}
const inRect = (r: Rect, i: number) => { const rr = Math.floor(i / COLS), cc = i % COLS; return rr >= r.r1 && rr <= r.r2 && cc >= r.c1 && cc <= r.c2 }

function AppleSvg({ v, tint }: { v: number; tint?: string }) {
  return (
    <svg viewBox="0 0 40 40" className="w-full h-full">
      <path d="M20 10c-3-2-10-3-13 3s0 15 5 19c3 2 5 1 8 0 3 1 5 2 8 0 5-4 8-13 5-19s-10-5-13-3z" fill={tint ?? '#F2554A'} />
      <path d="M20 11c0-3 1-5 2.5-7" stroke="#6B4A2F" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M22.5 7c2.5-3 6-3 8-1.6-1.6 3-5.5 3.6-8 1.6z" fill="#6CBF5B" />
      <text x="20" y="27" textAnchor="middle" fontSize="15" fontWeight="800" fill="#fff" fontFamily="system-ui, sans-serif">{v}</text>
    </svg>
  )
}
function AppleCell({ v, x, y, s, hl }: { v: number; x: number; y: number; s: number; hl: boolean }) {
  return (
    <div className={`absolute transition-transform duration-100 ${hl ? 'scale-110 drop-shadow' : ''}`} style={{ left: x, top: y, width: s, height: s }}>
      <AppleSvg v={v} />
    </div>
  )
}
