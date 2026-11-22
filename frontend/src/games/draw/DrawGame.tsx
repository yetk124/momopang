import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { IcEraser, IcTrash } from '../../components/Icons'
import { sfx } from '../../lib/sfx'
import { onEph, useStore } from '../../store'
import { cleanStroke, filterGuessInput } from '../../net/validate'
import type { GameProps } from '../rush/RushGame'
import { ROUNDS, ROUND_MS, chosung, type DrawState } from './engine'

const COLORS = ['#3B3541', '#F2554A', '#FFCF4D', '#6CBF5B', '#5F8EF2', '#A897F5']
const SIZES = [3, 6, 12]
interface Stroke { sid: string; color: string; size: number; pts: number[]; fill?: boolean }
type Tool = 'pen' | 'eraser' | 'fill'

const hexRgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
/** 페인트통: 비슷한 색(허용오차)으로 이어진 영역을 채움 (스캔라인) */
function floodFill(c: HTMLCanvasElement, fx: number, fy: number, hex: string) {
  const g = c.getContext('2d', { willReadFrequently: true })!; const W = c.width, H = c.height
  const x0 = Math.floor(fx * W), y0 = Math.floor(fy * W)
  if (x0 < 0 || y0 < 0 || x0 >= W || y0 >= H) return
  const img = g.getImageData(0, 0, W, H); const d = img.data
  const i0 = (y0 * W + x0) * 4; const tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2]
  const [nr, ng, nb] = hexRgb(hex)
  if (Math.abs(tr - nr) + Math.abs(tg - ng) + Math.abs(tb - nb) < 12) return
  const TOL = 110
  const seen = new Uint8Array(W * H)
  const match = (p: number) => { const i = p * 4; return !seen[p] && Math.abs(d[i] - tr) + Math.abs(d[i + 1] - tg) + Math.abs(d[i + 2] - tb) <= TOL }
  const stack = [y0 * W + x0]
  while (stack.length) {
    let p = stack.pop()!; const y = Math.floor(p / W)
    while (p % W > 0 && match(p - 1)) p--
    let up = false, dn = false
    for (; p < (y + 1) * W && match(p); p++) {
      seen[p] = 1; const i = p * 4; d[i] = nr; d[i + 1] = ng; d[i + 2] = nb; d[i + 3] = 255
      if (y > 0) { const q = p - W; if (match(q)) { if (!up) { stack.push(q); up = true } } else up = false }
      if (y < H - 1) { const q = p + W; if (match(q)) { if (!dn) { stack.push(q); dn = true } } else dn = false }
    }
  }
  // 선 가장자리 틈 메우기: 채운 영역을 1px 넓힘
  const grow: number[] = []
  for (let p = 0; p < W * H; p++) if (!seen[p]) { const x = p % W; if ((x > 0 && seen[p - 1]) || (x < W - 1 && seen[p + 1]) || (p >= W && seen[p - W]) || (p < W * H - W && seen[p + W])) { const i = p * 4; if (d[i] + d[i + 1] + d[i + 2] > 300) grow.push(p) } }
  for (const p of grow) { const i = p * 4; d[i] = nr; d[i + 1] = ng; d[i + 2] = nb }
  g.putImageData(img, 0, 0)
}

export function DrawGame({ state, t, meId }: GameProps<DrawState>) {
  const { act, eph } = useStore.getState()
  const players = useStore((s) => s.room?.players ?? [])
  const nameOf = (id: string) => players.find((p) => p.id === id)?.nickname ?? '상대'
  const drawing = state.drawer === meId
  const canvas = useRef<HTMLCanvasElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const strokes = useRef(new Map<string, Stroke>())
  const [color, setColor] = useState(COLORS[0])
  const [size, setSize] = useState(1)
  const [tool, setTool] = useState<Tool>('pen')
  const eraser = tool === 'eraser'
  const picker = useRef<HTMLInputElement>(null)
  const [guess, setGuess] = useState('')
  const cur = useRef<{ s: Stroke; sent: number } | null>(null)
  const flushTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const roundRef = useRef(state.round)
  roundRef.current = state.round

  const paint = (st: Stroke, from = 0) => {
    const c = canvas.current; if (!c) return
    if (st.fill) { if (from === 0) floodFill(c, st.pts[0], st.pts[1], st.color); return }
    const g = c.getContext('2d')!; const W = c.width
    g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = st.color; g.lineWidth = (st.size * W) / 320
    g.beginPath()
    const start = Math.max(0, from - 2)
    for (let i = start; i < st.pts.length; i += 2) { const x = st.pts[i] * W, y = st.pts[i + 1] * W; if (i === start) g.moveTo(x, y); else g.lineTo(x, y) }
    if (st.pts.length - start === 2) g.lineTo(st.pts[start] * W + 0.1, st.pts[start + 1] * W)
    g.stroke()
  }
  const redraw = () => {
    const c = canvas.current; if (!c) return
    const g = c.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height)
    for (const st of strokes.current.values()) paint(st)
  }
  useLayoutEffect(() => {
    const el = box.current; const c = canvas.current; if (!el || !c) return
    const ro = new ResizeObserver(() => { const w = Math.min(el.clientWidth, el.clientHeight); const dpr = window.devicePixelRatio || 1; c.style.width = c.style.height = w + 'px'; c.width = c.height = Math.round(w * dpr); redraw() })
    ro.observe(el); return () => ro.disconnect()
  }, [])
  // 라운드 변경/전체 지우기
  useEffect(() => { strokes.current.clear(); redraw() }, [state.round, state.clearSeq])
  // 상대 스트로크 수신
  useEffect(() => onEph((from, k, d) => {
    if (from === meId) return
    if (k === 'clear' && d?.round === roundRef.current) { strokes.current.clear(); redraw(); return }
    if (k !== 'stroke') return
    const st = cleanStroke(d)
    if (!st || st.round !== roundRef.current) return
    const s = strokes.current.get(st.sid)
    if (s) { if (s.pts.length < 6000 && !s.fill) { const from = s.pts.length; s.pts.push(...st.pts); paint(s, from) } }
    else if (strokes.current.size < 400) { const ns = { sid: st.sid, color: st.color, size: st.size, pts: [...st.pts], fill: st.fill }; strokes.current.set(st.sid, ns); paint(ns) }
  }), [meId]) // eslint-disable-line react-hooks/exhaustive-deps

  const flush = (done = false) => {
    const c = cur.current; if (!c) return
    if (!done && c.sent >= c.s.pts.length) return
    eph('stroke', { round: roundRef.current, sid: c.s.sid, color: c.s.color, size: c.s.size, pts: c.s.pts.slice(c.sent), done })
    c.sent = c.s.pts.length
  }
  const pos = (e: React.PointerEvent) => { const r = canvas.current!.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.width))] }
  const down = (e: React.PointerEvent) => {
    if (!drawing || state.phase !== 'draw') return
    e.preventDefault(); (e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    if (tool === 'fill') {
      const f: Stroke = { sid: `${meId}-${Date.now()}`, color, size: 1, pts: pos(e), fill: true }
      strokes.current.set(f.sid, f); paint(f); sfx.pop()
      eph('stroke', { round: roundRef.current, sid: f.sid, color: f.color, size: 1, pts: f.pts, fill: true, done: true })
      return
    }
    const s: Stroke = { sid: `${meId}-${Date.now()}`, color: eraser ? '#FFFFFF' : color, size: eraser ? 26 : SIZES[size], pts: pos(e) }
    strokes.current.set(s.sid, s); cur.current = { s, sent: 0 }; paint(s)
    flushTimer.current = setInterval(() => flush(), 60)
  }
  const move = (e: React.PointerEvent) => { if (!cur.current) return; const [x, y] = pos(e); const p = cur.current.s.pts; if (Math.hypot(x - p[p.length - 2], y - p[p.length - 1]) > 0.004) { const from = p.length; p.push(x, y); paint(cur.current.s, from) } }
  const up = () => { if (!cur.current) return; if (flushTimer.current) clearInterval(flushTimer.current); flush(true); cur.current = null }

  const lastGuess = useRef(state.guesses.length)
  useEffect(() => {
    if (state.guesses.length > lastGuess.current) { const g = state.guesses[state.guesses.length - 1]; if (g?.ok) sfx.win(); else if (g && g.pid !== meId) sfx.tap() }
    lastGuess.current = state.guesses.length
  }, [state.guesses, meId])

  const elapsed = t - state.roundStart
  const showHint = !drawing && elapsed > 30_000
  const solved = state.phase === 'reveal' && state.solvedAt !== null
  const solver = solved ? state.guesses.find((g) => g.ok)?.pid : null

  return (
    <div className="flex-1 flex flex-col gap-2 min-h-0">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold text-ink-mute">라운드 {state.round + 1}/{ROUNDS}</span>
        <div className="rounded-full bg-lav-100 text-lav-600 font-extrabold px-4 py-1.5 text-[15px]">
          {drawing ? <>제시어: <span className="text-ink">{state.word}</span></> : <>{showHint ? `힌트: ${chosung(state.word)}` : `${[...state.word.replace(/\s/g, '')].length}글자`} · {nameOf(state.drawer)}님이 그려요</>}
        </div>
        <span className="text-[13px] font-bold text-ink-mute tabular-nums">{Math.max(0, Math.ceil((ROUND_MS - elapsed) / 1000))}s</span>
      </div>

      <div ref={box} className="relative flex-1 min-h-[220px] flex items-center justify-center">
        <canvas ref={canvas} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          className={`rounded-3xl shadow-card bg-white touch-none ${drawing ? (tool === 'fill' ? 'cursor-cell' : 'cursor-crosshair') : ''}`} />
        {state.phase === 'reveal' && (
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="rounded-3xl bg-white/95 shadow-card px-6 py-5 text-center animate-pop">
              <p className="text-[14px] font-bold text-ink-soft">{solved ? `${solver === meId ? '내가' : nameOf(solver ?? '') + '님이'} 맞혔어요!` : '시간 초과!'}</p>
              <p className="font-round text-[32px] mt-1">정답: {state.word}</p>
            </div>
          </div>
        )}
      </div>

      {drawing ? (
        <div className="rounded-3xl bg-white/80 p-2 shadow-soft flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 justify-center">
            {COLORS.map((c) => <button key={c} aria-label={`색 ${c}`} onClick={() => { setColor(c); if (tool === 'eraser') setTool('pen') }} className={`w-7 h-7 rounded-full transition shrink-0 ${tool !== 'eraser' && color === c ? 'ring-[3px] ring-offset-2 ring-lav-400 scale-110' : ''}`} style={{ background: c }} />)}
            <button aria-label="다른 색 고르기" onClick={() => picker.current?.click()}
              className={`relative w-7 h-7 rounded-full shrink-0 transition ${tool !== 'eraser' && !COLORS.includes(color) ? 'ring-[3px] ring-offset-2 ring-lav-400 scale-110' : ''}`}
              style={{ background: !COLORS.includes(color) ? color : 'conic-gradient(#F2554A,#FFCF4D,#6CBF5B,#5F8EF2,#A897F5,#F2554A)' }}>
              {COLORS.includes(color) && <span className="absolute inset-[5px] rounded-full bg-white grid place-items-center text-[13px] font-extrabold text-ink-soft leading-none">+</span>}
            </button>
            <input ref={picker} type="color" value={color} onChange={(e) => { if (/^#[0-9a-f]{6}$/i.test(e.target.value)) { setColor(e.target.value); if (tool === 'eraser') setTool('pen') } }} className="sr-only" tabIndex={-1} aria-hidden />
          </div>
          <div className="flex items-center gap-1 justify-center">
            {SIZES.map((sz, i) => <button key={sz} aria-label={`굵기 ${i + 1}`} onClick={() => { setSize(i); setTool('pen') }} className={`w-8 h-8 rounded-full grid place-items-center ${size === i && tool === 'pen' ? 'bg-lav-100' : ''}`}><span className="rounded-full bg-ink" style={{ width: sz + 3, height: sz + 3 }} /></button>)}
            <span className="w-px h-6 bg-lav-100 mx-1" />
            <button aria-label="채우기" onClick={() => setTool('fill')} className={`w-8 h-8 rounded-full grid place-items-center ${tool === 'fill' ? 'bg-lav-100 text-lav-600' : 'text-ink-soft'}`}>
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 11l7-7 7 7-7 7z" /><path d="M5 11h14" /><path d="M20 15s2 2.4 2 3.6a2 2 0 01-4 0c0-1.2 2-3.6 2-3.6z" fill="currentColor" /></svg>
            </button>
            <button aria-label="지우개" onClick={() => setTool(tool === 'eraser' ? 'pen' : 'eraser')} className={`w-8 h-8 rounded-full grid place-items-center ${tool === 'eraser' ? 'bg-lav-100 text-lav-600' : 'text-ink-soft'}`}><IcEraser className="w-5 h-5" /></button>
            <button aria-label="전체 지우기" onClick={() => { strokes.current.clear(); redraw(); eph('clear', { round: state.round }); act({ type: 'clear' }) }} className="w-8 h-8 rounded-full grid place-items-center text-ink-soft"><IcTrash className="w-5 h-5" /></button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5 justify-center min-h-[30px]">
        {state.guesses.slice(-5).map((g, i) => (
          <span key={i} className={`rounded-full px-3 py-1 text-[14px] font-bold animate-pop ${g.ok ? 'bg-mint-300' : g.pid === meId ? 'bg-lav-100' : 'bg-peach-100'}`}>{g.ok ? '정답!' : g.text}</span>
        ))}
      </div>

      {!drawing && (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (guess.trim() && state.phase === 'draw') { act({ type: 'guess', text: guess }); setGuess('') } }}>
          <input value={guess} onChange={(e) => setGuess(filterGuessInput(e.target.value))} spellCheck={false} disabled={state.phase !== 'draw'} maxLength={20} placeholder="정답을 입력하세요" enterKeyHint="send" autoComplete="off"
            className="flex-1 h-12 rounded-2xl bg-white border border-lav-100 px-4 text-[16px] font-semibold outline-none focus:border-lav-400" />
          <button className="h-12 px-5 rounded-2xl bg-lav-400 text-white font-bold disabled:bg-lav-200" disabled={!guess.trim() || state.phase !== 'draw'}>보내기</button>
        </form>
      )}
      {drawing && <p className="text-center text-[13px] font-bold text-ink-soft">그림을 그려서 상대방이 정답을 맞히게 해요!</p>}
    </div>
  )
}
