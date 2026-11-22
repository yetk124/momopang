import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { sfx } from '../../lib/sfx'
import { useStore } from '../../store'
import type { GameProps } from '../rush/RushGame'
import { BLOCK_COLORS, N, SHAPES, fits, previewClear, type BlockState } from './engine'

interface Drag { h: number; x: number; y: number; target: { r: number; c: number } | null }

export function BlockGame({ state, meId, oppId }: GameProps<BlockState>) {
  const act = useStore((s) => s.act)
  const wrap = useRef<HTMLDivElement>(null)
  const boardEl = useRef<HTMLDivElement>(null)
  const [cell, setCell] = useState(30)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [flash, setFlash] = useState<{ id: number; cells: number[]; n: number } | null>(null)
  const me = state.p[meId]; const opp = state.p[oppId]

  useLayoutEffect(() => {
    const el = wrap.current; if (!el) return
    const ro = new ResizeObserver(() => setCell(Math.floor(Math.min(el.clientWidth, el.clientHeight) / N)))
    ro.observe(el); return () => ro.disconnect()
  }, [])
  const lastClear = useRef(me?.lastClear?.t ?? -1)
  useEffect(() => {
    const lc = me?.lastClear
    if (lc && lc.t !== lastClear.current) {
      lastClear.current = lc.t; sfx.pop()
      setFlash({ id: lc.t, cells: lc.cells, n: lc.n }); setTimeout(() => setFlash((f) => (f?.id === lc.t ? null : f)), 650)
    }
  }, [me?.lastClear])

  // 드래그: 손가락 위로 블록을 띄워서 가리지 않게
  const LIFT = 70
  const targetFor = (h: number, x: number, y: number) => {
    const si = me?.hand[h]; const b = boardEl.current
    if (si == null || !b || !me) return null
    const sh = SHAPES[si]; const rect = b.getBoundingClientRect()
    const left = x - (sh.w * cell) / 2, top = y - LIFT - (sh.h * cell) / 2
    const r = Math.round((top - rect.top) / cell), c = Math.round((left - rect.left) / cell)
    return fits(me.board, sh, r, c) ? { r, c } : null
  }
  const dragRef = useRef<Drag | null>(null)
  const setD = (d: Drag | null) => { dragRef.current = d; setDrag(d) }
  useEffect(() => {
    if (!drag) return
    const move = (e: PointerEvent) => { const d = dragRef.current; if (d) setD({ ...d, x: e.clientX, y: e.clientY, target: targetFor(d.h, e.clientX, e.clientY) }) }
    const up = () => {
      const d = dragRef.current
      if (d?.target) { act({ h: d.h, r: d.target.r, c: d.target.c }); sfx.tap() }
      setD(null)
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up) }
  }, [drag?.h, cell, me]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!me) return null
  const dshape = drag && me.hand[drag.h] != null ? SHAPES[me.hand[drag.h]!] : null
  const preview = drag?.target && dshape ? previewClear(me.board, dshape, drag.target.r, drag.target.c) : null
  const ghostSet = new Set(preview && dshape && drag?.target ? dshape.cells.map(([dr, dc]) => (drag.target!.r + dr) * N + drag.target!.c + dc) : [])
  const clearSet = new Set<number>()
  preview?.rows.forEach((r) => { for (let j = 0; j < N; j++) clearSet.add(r * N + j) })
  preview?.cols.forEach((c) => { for (let j = 0; j < N; j++) clearSet.add(j * N + c) })
  const flashSet = new Set(flash?.cells ?? [])

  return (
    <div className="flex-1 flex flex-col gap-2 min-h-0 no-select">
      <div className="flex items-center gap-3">
        <MiniBoard board={opp?.board ?? []} over={!!opp?.over} />
        <div className="flex-1 text-[13px] font-bold text-ink-soft leading-relaxed">
          <p>상대 보드 {opp?.over && <span className="text-[#C9433A]">· 더 놓을 곳 없음</span>}</p>
          <p>내 줄 <b className="text-ink tabular-nums">{me.lines}</b> · 콤보 <b className="text-ink tabular-nums">{me.combo}</b></p>
        </div>
      </div>
      <div ref={wrap} className="relative flex-1 min-h-[200px] flex items-center justify-center">
        <div ref={boardEl} className="relative grid rounded-2xl bg-[#3B3550] p-[3px] shadow-card" style={{ gridTemplateColumns: `repeat(${N}, ${cell - 0.6}px)`, gap: 0 }}>
          {me.board.map((v, i) => {
            const g = ghostSet.has(i), cl = clearSet.has(i), fl = flashSet.has(i)
            const color = v ? BLOCK_COLORS[v] : g ? BLOCK_COLORS[dshape!.color] : ''
            return (
              <div key={i} className="p-[1.5px]" style={{ width: cell - 0.6, height: cell - 0.6 }}>
                <div className={`w-full h-full rounded-[5px] ${fl ? 'animate-pop bg-white' : ''}`}
                  style={fl ? undefined : { background: color || '#4A4463', opacity: g && !v ? 0.55 : 1, boxShadow: color ? `inset 0 -3px 0 rgba(0,0,0,.18), inset 0 2px 0 rgba(255,255,255,.35)${cl ? ', 0 0 0 2px #fff' : ''}` : undefined }} />
              </div>
            )
          })}
          {flash && <div className="absolute inset-0 grid place-items-center pointer-events-none"><span className="font-round text-[34px] text-white drop-shadow animate-pop">{flash.n >= 2 ? `${flash.n}줄!` : 'Nice!'}</span></div>}
          {me.over && <div className="absolute inset-0 rounded-2xl bg-ink/60 grid place-items-center text-white text-center"><div><p className="font-round text-[26px]">더 놓을 곳이 없어요</p><p className="text-[14px] mt-1 opacity-80">상대가 끝날 때까지 기다려요</p></div></div>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 h-[108px]">
        {me.hand.map((si, h) => {
          const sh = si == null ? null : SHAPES[si]
          const can = sh && !me.over && canAny(me.board, si!)
          const mini = 18
          return (
            <div key={`${me.set}-${h}`} className="rounded-2xl bg-white/70 grid place-items-center touch-none"
              onPointerDown={(e) => { if (!sh || !can) return; e.preventDefault(); setD({ h, x: e.clientX, y: e.clientY, target: targetFor(h, e.clientX, e.clientY) }) }}>
              {sh && (
                <div className={`relative animate-pop ${drag?.h === h ? 'opacity-20' : can ? '' : 'opacity-30 grayscale'}`} style={{ width: sh.w * mini, height: sh.h * mini }}>
                  {sh.cells.map(([r, c], k) => <div key={k} className="absolute rounded-[4px]" style={{ left: c * mini, top: r * mini, width: mini - 2, height: mini - 2, background: BLOCK_COLORS[sh.color], boxShadow: 'inset 0 -2px 0 rgba(0,0,0,.18)' }} />)}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {drag && dshape && (
        <div className="fixed z-50 pointer-events-none" style={{ left: drag.x - (dshape.w * cell) / 2, top: drag.y - LIFT - (dshape.h * cell) / 2, width: dshape.w * cell, height: dshape.h * cell }}>
          {dshape.cells.map(([r, c], k) => <div key={k} className="absolute rounded-[5px]" style={{ left: c * cell + 1.5, top: r * cell + 1.5, width: cell - 3, height: cell - 3, background: BLOCK_COLORS[dshape.color], boxShadow: 'inset 0 -3px 0 rgba(0,0,0,.18), 0 6px 14px rgba(0,0,0,.2)' }} />)}
        </div>
      )}
      <p className="text-center text-[13px] font-bold text-ink-soft">블록을 끌어다 놓아 줄을 채워요!</p>
    </div>
  )
}

const canCache = new Map<string, boolean>()
function canAny(board: number[], si: number) {
  const key = si + ':' + board.join('')
  let v = canCache.get(key)
  if (v === undefined) {
    const sh = SHAPES[si]; v = false
    for (let r = 0; r <= N - sh.h && !v; r++) for (let c = 0; c <= N - sh.w && !v; c++) if (fits(board, sh, r, c)) v = true
    if (canCache.size > 500) canCache.clear()
    canCache.set(key, v)
  }
  return v
}

function MiniBoard({ board, over }: { board: number[]; over: boolean }) {
  return (
    <div className={`grid gap-[1px] rounded-lg bg-[#3B3550] p-[3px] shrink-0 ${over ? 'opacity-50' : ''}`} style={{ gridTemplateColumns: `repeat(${N}, 7px)` }}>
      {Array.from({ length: N * N }, (_, i) => <div key={i} className="w-[7px] h-[7px] rounded-[1.5px]" style={{ background: board[i] ? BLOCK_COLORS[board[i]] : '#4A4463' }} />)}
    </div>
  )
}
