import { useEffect, useRef, useState } from 'react'
import { sfx } from '../../lib/sfx'
import { useStore } from '../../store'
import { Fit } from '../../components/ui'
import type { GameProps } from '../rush/RushGame'
import { SIZE, lineIdx, slide, type Dir, type MergeState } from './engine'

const TILE: Record<number, [string, string]> = {
  2: ['#FBF4EC', '#5A4F5F'], 4: ['#F6E3CF', '#5A4F5F'], 8: ['#FFC48A', '#5A3A2A'], 16: ['#FF9FB4', '#fff'], 32: ['#FF7F96', '#fff'], 64: ['#F2675B', '#fff'],
  128: ['#C9B6FA', '#fff'], 256: ['#A897F5', '#fff'], 512: ['#8F7BEA', '#fff'], 1024: ['#FFD24D', '#5A3A2A'], 2048: ['#FFB800', '#fff'],
}
const tileColor = (v: number) => TILE[v] ?? ['#3B3541', '#fff']
const SLIDE_MS = 120

interface Tile { id: number; v: number; pos: number; state: 'idle' | 'new' | 'merged' | 'dying' }
let nextId = 1
const fromBoard = (b: number[]): Tile[] => b.flatMap((v, pos) => (v ? [{ id: nextId++, v, pos, state: 'new' as const }] : []))

/** 이전 타일 배치 + 방향 → 이동 후 타일(합쳐지는 쪽은 dying으로 같은 칸에 겹침) */
function moveTiles(tiles: Tile[], dir: Dir): Tile[] {
  const at = new Map(tiles.filter((t) => t.state !== 'dying').map((t) => [t.pos, t]))
  const out: Tile[] = []
  for (let k = 0; k < SIZE; k++) {
    const idx = lineIdx(dir, k)
    const line = idx.map((i) => at.get(i)).filter(Boolean) as Tile[]
    let slot = 0
    for (let i = 0; i < line.length; i++) {
      const a = line[i], b = line[i + 1]
      if (b && a.v === b.v) {
        out.push({ ...a, pos: idx[slot], v: a.v * 2, state: 'merged' }, { ...b, pos: idx[slot], state: 'dying' })
        i++
      } else out.push({ ...a, pos: idx[slot], state: 'idle' })
      slot++
    }
  }
  return out
}

export function MergeGame({ state, meId, oppId }: GameProps<MergeState>) {
  const act = useStore((s) => s.act)
  const me = state.p[meId]; const opp = state.p[oppId]
  const start = useRef<{ x: number; y: number } | null>(null)
  const [tiles, setTiles] = useState<Tile[]>(() => fromBoard(me?.board ?? []))
  const [nudge, setNudge] = useState<{ dir: Dir; k: number } | null>(null)
  const [gain, setGain] = useState<{ v: number; k: number } | null>(null)
  const seen = useRef(me?.moves ?? 0)

  const move = (dir: Dir) => {
    if (!me || me.over) return
    if (!slide(me.board, dir)) { setNudge({ dir, k: Date.now() }); return } // 안 움직이는 방향: 살짝 튕김
    act({ dir })
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const m: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }
      if (m[e.key]) { e.preventDefault(); move(m[e.key]) }
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  })

  // 보드가 바뀌면: 이동 애니메이션 → 합침 → 새 타일
  useEffect(() => {
    if (!me) return
    if (me.moves === seen.current) return
    const jump = me.moves - seen.current
    seen.current = me.moves
    if (jump !== 1 || !me.lastDir) { setTiles(fromBoard(me.board)); return }
    setTiles((prev) => {
      const moved = moveTiles(prev, me.lastDir!)
      // 예측과 실제 보드가 다르면(동기화 보정) 그냥 실제 보드로
      const check = Array(SIZE * SIZE).fill(0); moved.filter((t) => t.state !== 'dying').forEach((t) => (check[t.pos] = t.v))
      const expected = me.board.slice(); if (me.spawned >= 0) expected[me.spawned] = 0
      if (check.join() !== expected.join()) return fromBoard(me.board)
      return me.spawned >= 0 ? [...moved, { id: nextId++, v: me.board[me.spawned], pos: me.spawned, state: 'new' }] : moved
    })
    const t = setTimeout(() => setTiles((ts) => ts.filter((x) => x.state !== 'dying')), SLIDE_MS + 20)
    if (me.gained) { setGain({ v: me.gained, k: me.moves }); sfx.pop() } else sfx.tap()
    return () => clearTimeout(t)
  }, [me?.moves]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!me) return null
  const cell = 100 / SIZE
  const nudgeXY = nudge ? { up: [0, -6], down: [0, 6], left: [-6, 0], right: [6, 0] }[nudge.dir] : [0, 0]

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2.5 no-select">
      <div className="flex items-center gap-3">
        <div className="grid grid-cols-4 grid-rows-4 gap-[2px] rounded-lg bg-[#CDBFEA] p-[3px] shrink-0 w-[66px] h-[66px]">
          {(opp?.board ?? Array(16).fill(0)).map((v, i) => <div key={i} className="rounded-[3px]" style={{ background: v ? tileColor(v)[0] : '#EDE6FA' }} />)}
        </div>
        <div className="flex-1 text-[13px] font-bold text-ink-soft leading-relaxed">
          <p>상대 최대 <b className="text-ink tabular-nums">{opp?.best ?? 0}</b>{opp?.over && <span className="text-[#C9433A]"> · 막힘</span>}</p>
          <p>내 최대 타일 <b className="text-lav-500 tabular-nums text-[16px]">{me.best}</b> · 이동 {me.moves}</p>
        </div>
      </div>
      <Fit max={340}>
        <div
          key={nudge?.k}
          className="relative w-full h-full rounded-3xl bg-[#CDBFEA] p-2 touch-none shadow-card"
          style={nudge ? { animation: 'boardNudge .18s ease-out', ['--nx' as string]: `${nudgeXY[0]}px`, ['--ny' as string]: `${nudgeXY[1]}px` } : undefined}
          onPointerDown={(e) => { start.current = { x: e.clientX, y: e.clientY } }}
          onPointerUp={(e) => {
            const s = start.current; start.current = null; if (!s) return
            const dx = e.clientX - s.x, dy = e.clientY - s.y
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return
            move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'))
          }}
          onPointerCancel={() => (start.current = null)}
        >
          <div className="relative w-full h-full">
            {/* 빈 칸: 4×4 정사각형 */}
            {Array.from({ length: SIZE * SIZE }, (_, i) => (
              <div key={i} className="absolute p-1" style={{ left: `${(i % SIZE) * cell}%`, top: `${Math.floor(i / SIZE) * cell}%`, width: `${cell}%`, height: `${cell}%` }}>
                <div className="w-full h-full rounded-xl bg-[#EDE6FA]" />
              </div>
            ))}
            {/* 타일: 위치가 바뀌면 미끄러지듯 이동 */}
            {tiles.map((t) => {
              const [bg, fg] = tileColor(t.v)
              return (
                <div key={t.id} className="absolute p-1" style={{ left: `${(t.pos % SIZE) * cell}%`, top: `${Math.floor(t.pos / SIZE) * cell}%`, width: `${cell}%`, height: `${cell}%`, transition: `left ${SLIDE_MS}ms ease-out, top ${SLIDE_MS}ms ease-out`, zIndex: t.state === 'dying' ? 1 : 2 }}>
                  <div className="w-full h-full rounded-xl grid place-items-center font-extrabold tabular-nums shadow-[inset_0_-4px_0_rgba(0,0,0,.08)]"
                    style={{ background: bg, color: fg, fontSize: t.v >= 1024 ? 20 : t.v >= 128 ? 24 : 28, animation: t.state === 'new' ? `tileNew .2s ${SLIDE_MS}ms ease-out both` : t.state === 'merged' ? `tileMerge .22s ${SLIDE_MS - 20}ms ease-out both` : undefined}}>
                    {t.v}
                  </div>
                </div>
              )
            })}
          </div>
          {gain && <span key={gain.k} className="absolute -top-2 right-3 font-round text-[22px] text-[#F2853A] pointer-events-none" style={{ animation: 'gainUp .8s ease-out forwards' }}>+{gain.v}</span>}
          {me.over && <div className="absolute inset-0 z-10 rounded-3xl bg-ink/55 grid place-items-center text-white text-center"><div><p className="font-round text-[26px]">더 움직일 수 없어요</p><p className="text-[14px] opacity-80 mt-1">상대가 끝날 때까지 기다려요</p></div></div>}
        </div>
      </Fit>
      <div className="grid grid-cols-3 gap-1.5 w-[156px] mx-auto">
        <span />
        <button aria-label="위" onClick={() => move('up')} className="h-10 rounded-xl bg-white shadow-soft text-ink-soft text-lg font-bold active:bg-lav-100">▲</button>
        <span />
        <button aria-label="왼쪽" onClick={() => move('left')} className="h-10 rounded-xl bg-white shadow-soft text-ink-soft text-lg font-bold active:bg-lav-100">◀</button>
        <button aria-label="아래" onClick={() => move('down')} className="h-10 rounded-xl bg-white shadow-soft text-ink-soft text-lg font-bold active:bg-lav-100">▼</button>
        <button aria-label="오른쪽" onClick={() => move('right')} className="h-10 rounded-xl bg-white shadow-soft text-ink-soft text-lg font-bold active:bg-lav-100">▶</button>
      </div>
      <p className="text-center text-[13px] font-bold text-ink-soft">스와이프 · 방향키로 같은 숫자를 합쳐요! 합친 숫자만큼 점수</p>
      <style>{`
        @keyframes tileNew { 0% { transform: scale(0); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
        @keyframes tileMerge { 0% { transform: scale(1) } 45% { transform: scale(1.22); box-shadow: 0 0 0 3px #fff, 0 0 20px rgba(255,170,110,.9) } 100% { transform: scale(1) } }
        @keyframes gainUp { 0% { transform: translateY(0); opacity: 1 } 100% { transform: translateY(-36px); opacity: 0 } }
        @keyframes boardNudge { 50% { transform: translate(var(--nx), var(--ny)) } }
      `}</style>
    </div>
  )
}
