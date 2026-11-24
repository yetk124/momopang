// 수박게임 물리: 원끼리 부딪히고 쌓이는 아주 작은 엔진 (각자 폰에서 실행)
import { mulberry32 } from '../../lib/rng'

export const BOX_W = 300
export const BOX_H = 420
/** 이 선 위로 과일이 2초 넘게 걸쳐 있으면 게임 오버 */
export const DANGER_Y = 72
export const DROP_Y = 36
export const FRUITS = ['cherry', 'blueberry', 'strawberry', 'grape', 'orange', 'lemon', 'peach', 'apple', 'pineapple', 'melon', 'watermelon'] as const
export const RADIUS = [13, 17, 22, 27, 33, 39, 46, 53, 61, 70, 80]
/** 합쳐서 만든 과일 점수 (수박끼리 합치면 사라지며 +100) */
export const MERGE_SCORE = [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55]
export const DROP_KINDS = 5

/** i번째로 떨어뜨릴 과일 (같은 seed면 두 사람 모두 같은 순서) */
export const nextKind = (seed: number, i: number) => Math.floor(mulberry32(seed + i * 7919)() * DROP_KINDS)

export interface Fruit { id: number; k: number; x: number; y: number; vx: number; vy: number; born: number; merged?: boolean }
export interface World {
  fruits: Fruit[]
  t: number
  score: number
  best: number
  drops: number
  dangerSince: number | null
  over: boolean
  nextId: number
  /** 이번 단계에서 생긴 합치기 (효과음용) */
  pops: { x: number; y: number; k: number }[]
}

export const newWorld = (): World => ({ fruits: [], t: 0, score: 0, best: 0, drops: 0, dangerSince: null, over: false, nextId: 1, pops: [] })

export function drop(w: World, k: number, x: number) {
  if (w.over) return
  const r = RADIUS[k]
  w.fruits.push({ id: w.nextId++, k, x: Math.max(r, Math.min(BOX_W - r, x)), y: DROP_Y, vx: 0, vy: 0, born: w.t })
  w.drops++
}

const G = 1500

/** dt초만큼 진행 (작은 단계로 나눠서) */
export function step(w: World, dt: number) {
  if (w.over) return
  const sub = 4, h = Math.min(dt, 1 / 30) / sub
  for (let s = 0; s < sub; s++) {
    w.t += h
    for (const f of w.fruits) {
      f.vy += G * h
      f.x += f.vx * h; f.y += f.vy * h
      f.vx *= 0.995
    }
    for (let it = 0; it < 3; it++) collide(w)
    for (const f of w.fruits) {
      const r = RADIUS[f.k]
      if (f.x < r) { f.x = r; f.vx = Math.abs(f.vx) * 0.2 }
      if (f.x > BOX_W - r) { f.x = BOX_W - r; f.vx = -Math.abs(f.vx) * 0.2 }
      if (f.y > BOX_H - r) { f.y = BOX_H - r; f.vy = -Math.abs(f.vy) * 0.15; f.vx *= 0.9 }
    }
  }
  // 게임 오버 판정: 떨어진 지 1초 지난 과일이 선 위에 걸쳐 있으면
  const danger = w.fruits.some((f) => w.t - f.born > 1 && f.y - RADIUS[f.k] < DANGER_Y && Math.abs(f.vy) < 60)
  if (danger) { if (w.dangerSince === null) w.dangerSince = w.t; else if (w.t - w.dangerSince > 2) w.over = true }
  else w.dangerSince = null
}

function collide(w: World) {
  const fs = w.fruits
  const add: Fruit[] = []
  for (let i = 0; i < fs.length; i++) {
    const a = fs[i]; if (a.merged) continue
    for (let j = i + 1; j < fs.length; j++) {
      const b = fs[j]; if (b.merged) continue
      const ra = RADIUS[a.k], rb = RADIUS[b.k]
      const dx = b.x - a.x, dy = b.y - a.y
      const d2 = dx * dx + dy * dy, min = ra + rb
      if (d2 >= min * min) continue
      const d = Math.sqrt(d2) || 0.01
      if (a.k === b.k) {
        // 같은 과일 → 한 단계 큰 과일로 합치기
        a.merged = b.merged = true
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
        if (a.k + 1 < FRUITS.length) {
          const k = a.k + 1
          add.push({ id: w.nextId++, k, x: mx, y: my, vx: (a.vx + b.vx) / 2, vy: Math.min(a.vy, b.vy) * 0.3, born: w.t - 1 })
          w.score += MERGE_SCORE[k]; w.best = Math.max(w.best, k)
          w.pops.push({ x: mx, y: my, k })
        } else { w.score += 100; w.pops.push({ x: mx, y: my, k: a.k }) }
        break
      }
      const nx = dx / d, ny = dy / d, overlap = min - d
      const ma = ra * ra, mb = rb * rb, tot = ma + mb
      a.x -= nx * overlap * (mb / tot); a.y -= ny * overlap * (mb / tot)
      b.x += nx * overlap * (ma / tot); b.y += ny * overlap * (ma / tot)
      const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
      if (rv < 0) {
        const imp = (-(1 + 0.1) * rv) / (1 / ma + 1 / mb)
        a.vx -= (imp / ma) * nx; a.vy -= (imp / ma) * ny
        b.vx += (imp / mb) * nx; b.vy += (imp / mb) * ny
      }
    }
  }
  if (add.length || fs.some((f) => f.merged)) w.fruits = fs.filter((f) => !f.merged).concat(add)
}

/** 상대에게 보낼 작은 스냅샷 [x, y, k, …] (정수) */
export const snapshot = (w: World) => w.fruits.flatMap((f) => [Math.round(f.x), Math.round(f.y), f.k])
