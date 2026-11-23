import { mulberry32 } from '../../lib/rng'
import { clone, type Engine } from '../types'

export const MERGE_TIME = 120_000
export const SIZE = 4
export type Dir = 'up' | 'down' | 'left' | 'right'

export interface MergePlayer { board: number[]; moves: number; score: number; best: number; over: boolean; merged: number[]; spawned: number; lastDir: Dir | null; gained: number }
export interface MergeState { seed: number; p: Record<string, MergePlayer> }
export type MergeAction = { dir: Dir }

export function lineIdx(dir: Dir, k: number) {
  const out: number[] = []
  for (let i = 0; i < SIZE; i++) {
    if (dir === 'left') out.push(k * SIZE + i)
    else if (dir === 'right') out.push(k * SIZE + (SIZE - 1 - i))
    else if (dir === 'up') out.push(i * SIZE + k)
    else out.push((SIZE - 1 - i) * SIZE + k)
  }
  return out
}
/** 한 방향 이동 결과 (변화 없으면 null) */
export function slide(board: number[], dir: Dir) {
  const b = board.slice(); let gained = 0; let moved = false; const merged: number[] = []
  for (let k = 0; k < SIZE; k++) {
    const idx = lineIdx(dir, k)
    const vals = idx.map((i) => b[i]).filter(Boolean)
    const res: number[] = []
    for (let i = 0; i < vals.length; i++) {
      if (vals[i] === vals[i + 1]) { res.push(vals[i] * 2); gained += vals[i] * 2; merged.push(idx[res.length - 1]); i++ }
      else res.push(vals[i])
    }
    idx.forEach((pos, i) => { const v = res[i] ?? 0; if (b[pos] !== v) moved = true; b[pos] = v })
  }
  return moved ? { board: b, gained, merged } : null
}
export const canMove = (b: number[]) => (['up', 'down', 'left', 'right'] as Dir[]).some((d) => slide(b, d))

function spawn(board: number[], seed: number, k: number) {
  const empty = board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0)
  if (!empty.length) return -1
  const r = mulberry32(seed * 13 + k * 7907)
  const pos = empty[Math.floor(r() * empty.length)]
  board[pos] = r() < 0.9 ? 2 : 4
  return pos
}

export const mergeEngine: Engine<MergeState, MergeAction> = {
  id: 'merge',
  predict: true,
  statLabels: { best: '최대 타일', moves: '이동 횟수' },
  init(seed, players) {
    const p: Record<string, MergePlayer> = {}
    for (const id of players) {
      const board = Array(SIZE * SIZE).fill(0)
      spawn(board, seed, 0); const last = spawn(board, seed, 1)
      p[id] = { board, moves: 0, score: 0, best: 2, over: false, merged: [], spawned: last, lastDir: null, gained: 0 }
    }
    return { seed, p }
  },
  apply(s, pid, a, t) {
    const me0 = s.p[pid]
    if (!me0 || me0.over || t >= MERGE_TIME) return null
    const res = slide(me0.board, a.dir); if (!res) return null
    const n = clone(s); const me = n.p[pid]
    me.board = res.board; me.score += res.gained; me.moves++; me.merged = res.merged; me.lastDir = a.dir; me.gained = res.gained
    // 같은 시드 + 이동 횟수 → 두 사람에게 같은 순서로 타일이 생김
    me.spawned = spawn(me.board, s.seed, me.moves + 1)
    me.best = Math.max(...me.board)
    if (!canMove(me.board)) me.over = true
    return n
  },
  isOver: (s, t) => t >= MERGE_TIME || Object.values(s.p).every((p) => p.over),
  result(s) {
    const scores: Record<string, number> = {}; const stats: Record<string, Record<string, number>> = {}
    for (const [id, p] of Object.entries(s.p)) { scores[id] = p.score; stats[id] = { best: p.best, moves: p.moves } }
    return { scores, stats }
  },
}
