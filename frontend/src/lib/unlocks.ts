// 한정판 아바타 해금: 게임 기록으로 조건을 채우면 열려요.
// 게스트는 이 기기에, 카카오 계정은 서버(profiles.unlocked)에도 저장돼 다른 폰에서도 유지돼요.
import type { GameId } from '../games/types'
import { GAMES } from '../games/registry'

export type LimitedId = 'unicorn' | 'wizard'
export interface Progress { wins: number; played: GameId[]; unlocked: LimitedId[] }

export const UNICORN_WINS = 10
export const UNLOCKS: { id: LimitedId; name: string; how: string; done: (p: Progress) => boolean; step: (p: Progress) => [number, number] }[] = [
  { id: 'unicorn', name: '유니콘냥', how: `${UNICORN_WINS}승 달성`, done: (p) => p.wins >= UNICORN_WINS, step: (p) => [Math.min(p.wins, UNICORN_WINS), UNICORN_WINS] },
  { id: 'wizard', name: '마법사냥', how: `${GAMES.length}개 게임 모두 한 판씩`, done: (p) => p.played.length >= GAMES.length, step: (p) => [Math.min(p.played.length, GAMES.length), GAMES.length] },
]

const KEY = 'momopang.progress'
const GAME_IDS = new Set<string>(GAMES.map((g) => g.id))
const empty = (): Progress => ({ wins: 0, played: [], unlocked: [] })

function clean(v: unknown): Progress {
  if (!v || typeof v !== 'object') return empty()
  const o = v as Partial<Progress>
  return {
    wins: Number.isInteger(o.wins) && (o.wins as number) >= 0 ? Math.min(o.wins as number, 100000) : 0,
    played: Array.isArray(o.played) ? [...new Set(o.played.filter((g) => GAME_IDS.has(String(g))))] as GameId[] : [],
    unlocked: Array.isArray(o.unlocked) ? [...new Set(o.unlocked.filter((u) => u === 'unicorn' || u === 'wizard'))] as LimitedId[] : [],
  }
}

export function loadProgress(): Progress {
  try { return clean(JSON.parse(localStorage.getItem(KEY) || 'null')) } catch { return empty() }
}
function saveProgress(p: Progress) { try { localStorage.setItem(KEY, JSON.stringify(p)) } catch { /* noop */ } }

/** 조건을 채운 것 중 아직 안 열린 걸 열고, 새로 열린 목록을 돌려줌 */
function settle(p: Progress): LimitedId[] {
  const fresh: LimitedId[] = []
  for (const u of UNLOCKS) if (!p.unlocked.includes(u.id) && u.done(p)) { p.unlocked.push(u.id); fresh.push(u.id) }
  return fresh
}

/** 게임 1판이 끝날 때 호출 → 새로 해금된 아바타 */
export function recordGame(game: GameId, outcome: 'win' | 'lose' | 'draw'): LimitedId[] {
  const p = loadProgress()
  if (outcome === 'win') p.wins++
  if (!p.played.includes(game)) p.played.push(game)
  const fresh = settle(p)
  saveProgress(p)
  return fresh
}

/** 서버(카카오 계정) 기록과 합치기: 큰 값·합집합으로 → 새로 해금된 목록 */
export function mergeProgress(server: Partial<Progress>): { progress: Progress; fresh: LimitedId[] } {
  const p = loadProgress(), s = clean(server)
  p.wins = Math.max(p.wins, s.wins)
  p.played = [...new Set([...p.played, ...s.played])]
  p.unlocked = [...new Set([...p.unlocked, ...s.unlocked])]
  const fresh = settle(p)
  saveProgress(p)
  return { progress: p, fresh }
}

export const isUnlocked = (id: string) => loadProgress().unlocked.includes(id as LimitedId)
export const unlockName = (id: LimitedId) => UNLOCKS.find((u) => u.id === id)?.name ?? id
