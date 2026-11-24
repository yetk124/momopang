import type { AppleState } from '../games/apple/engine'
import { findTens } from '../games/apple/engine'
import { N, SHAPES, fits, previewClear, type BlockState } from '../games/block/engine'
import { WORDS, type DrawState } from '../games/draw/engine'
import { fiveFruit, type HalliState } from '../games/halli/engine'
import type { RushState } from '../games/rush/engine'
import { puzzleOf, type SpotState } from '../games/spot/engine'
import { allowedStarts, type WordState } from '../games/word/engine'
import { WORDS as DICT } from '../games/word/words'
import type { QuizState } from '../games/quiz/engine'
import type { BombState } from '../games/bomb/engine'
import type { MemState } from '../games/memory/engine'
import type { PairsState } from '../games/pairs/engine'
import { canMove, slide, type Dir, type MergeState } from '../games/merge/engine'
import type { BalanceState } from '../games/balance/engine'
import { omokBest, type OmokState } from '../games/omok/engine'
import type { SuikaState } from '../games/suika/engine'
import { BOX_W, RADIUS, drop as suikaDrop, newWorld, nextKind, snapshot as suikaSnap, step as suikaStep, type World } from '../games/suika/physics'
import { gameMs, type Intent, type Msg, type PlayerInfo, type RoomState, type Transport } from './protocol'

const rand = (a: number, b: number) => a + Math.random() * (b - a)

/** 혼자 연습용 봇. 실제 상대와 같은 메시지 프로토콜로 방에 참가한다. */
export class Bot {
  private room: RoomState | null = null
  private seq = 0
  private timer: ReturnType<typeof setInterval> | null = null
  private nextAt = 0
  private memo = new Map<string, unknown>()
  constructor(private tr: Transport, readonly info: PlayerInfo) {}

  async connect(code: string) {
    this.tr.onMessage((m) => this.onMsg(m))
    this.tr.onPresence(() => {})
    await this.tr.connect(code, this.info)
    this.send({ type: 'join', player: this.info })
    this.timer = setInterval(() => this.think(), 80)
  }
  dispose() { if (this.timer) clearInterval(this.timer); this.tr.close() }

  private send(i: Intent) { this.tr.send({ t: 'intent', from: this.info.id, seq: ++this.seq, i }) }
  private eph(k: string, d: unknown) { this.tr.send({ t: 'eph', from: this.info.id, k, d }) }
  private once(key: string, delay: number, fn: () => void) {
    if (this.memo.has(key)) return
    this.memo.set(key, true)
    setTimeout(fn, delay)
  }

  private onMsg(m: Msg) {
    if (m.t !== 'room') return
    const prev = this.room; this.room = m.s
    const s = m.s
    if (prev?.session?.id !== s.session?.id) { this.memo.clear(); this.nextAt = 0 }
    const me = s.players.find((p) => p.id === this.info.id)
    if (!me) return
    if (s.phase === 'lobby' && s.game && !me.ready && s.players.length === 2) this.once(`ready-${s.version}-${s.game}`, rand(700, 1500), () => {
      const r = this.room; const m2 = r?.players.find((p) => p.id === this.info.id)
      if (r?.phase === 'lobby' && r.game && m2 && !m2.ready) this.send({ type: 'ready', v: true })
    })
    if (s.phase === 'result' && s.rematch && s.rematch.from !== this.info.id) this.once(`rm-${s.rematch.at}`, rand(800, 1500), () => this.send({ type: 'rematchAccept' }))
  }

  private think() {
    const s = this.room
    if (!s || s.phase !== 'playing' || !s.session || s.pause) return
    const t = gameMs(s.session.clock, Date.now())
    const st = s.session.state
    const me = this.info.id
    switch (s.session.game) {
      case 'rush': {
        const p = (st as RushState).p[me]; if (!p) return
        if (t < this.nextAt) return
        this.nextAt = t + rand(620, 1150)
        const wrong = Math.random() < 0.06
        const cell = wrong ? Math.floor(Math.random() * 9) : p.board.indexOf(p.next)
        this.send({ type: 'act', a: { cell } })
        break
      }
      case 'halli': {
        const h = st as HalliState
        if (h.turn === me && t >= h.pauseUntil && h.decks[me]?.length) this.once(`flip-${h.flips}`, rand(900, 1700), () => this.send({ type: 'act', a: { type: 'flip' } }))
        if (h.flips > 0 && !h.locked && !h.clearPending) {
          if (fiveFruit(h.top) >= 0) this.once(`bell-${h.flips}`, rand(650, 1250), () => this.send({ type: 'act', a: { type: 'bell' } }))
          else if (Math.random() < 0.0015) this.once(`oops-${h.flips}`, rand(300, 600), () => this.send({ type: 'act', a: { type: 'bell' } }))
        }
        break
      }
      case 'apple': {
        if (t < this.nextAt) return
        this.nextAt = t + rand(3000, 5200)
        const options = findTens((st as AppleState).board)
        if (!options.length) return
        options.sort((a, b) => (a.r2 - a.r1 + 1) * (a.c2 - a.c1 + 1) - (b.r2 - b.r1 + 1) * (b.c2 - b.c1 + 1))
        const pick = options[Math.floor(Math.random() * Math.min(6, options.length))]
        this.eph('sel', pick)
        setTimeout(() => { this.send({ type: 'act', a: pick }); this.eph('sel', null) }, 650)
        break
      }
      case 'block': {
        const p = (st as BlockState).p[me]; if (!p || p.over) return
        if (t < this.nextAt) return
        this.nextAt = t + rand(1700, 2800)
        let best: { h: number; r: number; c: number; v: number } | null = null
        p.hand.forEach((si, h) => {
          if (si == null) return
          const sh = SHAPES[si]
          for (let r = 0; r <= N - sh.h; r++) for (let c = 0; c <= N - sh.w; c++) {
            if (!fits(p.board, sh, r, c)) continue
            const { rows, cols } = previewClear(p.board, sh, r, c)
            let adj = 0
            for (const [dr, dc] of sh.cells) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const rr = r + dr + a, cc = c + dc + b
              if (rr < 0 || cc < 0 || rr >= N || cc >= N || p.board[rr * N + cc]) adj++
            }
            const v = (rows.length + cols.length) * 30 + adj + Math.random() * 3
            if (!best || v > best.v) best = { h, r, c, v }
          }
        })
        if (best) { const b = best as { h: number; r: number; c: number }; this.send({ type: 'act', a: { h: b.h, r: b.r, c: b.c } }) }
        break
      }
      case 'word': {
        const w = st as WordState
        if (w.turn !== me) return
        const key = `w-${w.chain.length}-${w.resets}`
        this.once(key, rand(2500, 6500), () => {
          const cur = this.room?.session?.state as WordState | undefined
          if (!cur || cur.turn !== me || `w-${cur.chain.length}-${cur.resets}` !== key) return
          if (Math.random() < 0.08) return // 가끔 막힘
          const starts = allowedStarts(cur)
          const opts = DICT.filter((x) => starts.includes(x[0]) && !cur.used.includes(x))
          if (opts.length) this.send({ type: 'act', a: { word: opts[Math.floor(Math.random() * opts.length)] } })
        })
        break
      }
      case 'quiz': {
        const q = st as QuizState
        if (q.phase !== 'ask' || t < q.askAt || q.answers[me]) return
        this.once(`q-${q.idx}`, rand(2200, 6500), () => {
          const cur = this.room?.session?.state as QuizState | undefined
          if (!cur || cur.idx !== q.idx || cur.phase !== 'ask') return
          const ok = Math.random() < 0.72
          const choice = ok ? cur.qs[cur.idx].a : (cur.qs[cur.idx].a + 1 + Math.floor(Math.random() * 3)) % 4
          this.send({ type: 'act', a: { choice } })
        })
        break
      }
      case 'bomb': {
        const b = st as BombState
        if (b.phase !== 'play' || b.holder !== me || t < b.roundStart || t < b.p[me].lockUntil) return
        this.once(`b-${b.taskSeq}-${b.p[me].lockUntil}`, rand(1400, 3400), () => {
          const cur = this.room?.session?.state as BombState | undefined
          if (!cur || cur.holder !== me || cur.taskSeq !== b.taskSeq || cur.phase !== 'play') return
          const ok = Math.random() < 0.85
          const choice = ok ? cur.task.ans : cur.task.opts.find((o) => o !== cur.task.ans)!
          this.send({ type: 'act', a: { choice } })
        })
        break
      }
      case 'memory': {
        const m = st as MemState
        const p = m.p[me]
        if (m.phase !== 'input' || !p || p.done || p.failed) return
        if (t < this.nextAt) return
        this.nextAt = t + rand(420, 750)
        const err = Math.random() < 0.025 * m.seq.length
        const c = err ? (m.seq[p.idx] + 1) % 4 : m.seq[p.idx]
        this.send({ type: 'act', a: { c } })
        break
      }
      case 'pairs': {
        const ps = st as PairsState
        const seen = (this.memo.get('seen') as Map<number, number>) ?? new Map<number, number>()
        this.memo.set('seen', seen)
        // 시작 미리보기 때 사람처럼 몇 장만 기억
        if (t < (ps.peekUntil ?? 0) && !this.memo.get('peeked')) { this.memo.set('peeked', true); ps.board.forEach((f, c) => { if (Math.random() < 0.3) seen.set(c, f) }) }
        ps.open.forEach((c) => { if (Math.random() < 0.85) seen.set(c, ps.board[c]) }) // 상대가 뒤집은 것도 (가끔 까먹으며) 기억
        Object.keys(ps.owner).forEach((c) => seen.delete(+c))
        if (ps.turn !== me || ps.open.length >= 2 || t < ps.turnStart || t < this.nextAt) return
        this.nextAt = t + rand(900, 1500)
        const hidden = ps.board.map((_, i) => i).filter((i) => !ps.owner[i] && !ps.open.includes(i))
        let pick = -1
        if (ps.open.length === 1) {
          const f = ps.board[ps.open[0]]
          const known = [...seen].find(([c, v]) => v === f && c !== ps.open[0] && hidden.includes(c))
          if (known && Math.random() < 0.8) pick = known[0]
        } else {
          const byFace = new Map<number, number[]>()
          seen.forEach((v, c) => { if (hidden.includes(c)) byFace.set(v, [...(byFace.get(v) ?? []), c]) })
          const pair = [...byFace.values()].find((cs) => cs.length >= 2)
          if (pair && Math.random() < 0.8) pick = pair[0]
        }
        if (pick < 0) { const unseen = hidden.filter((i) => !seen.has(i)); const pool = unseen.length ? unseen : hidden; pick = pool[Math.floor(Math.random() * pool.length)] ?? -1 }
        if (pick >= 0) { seen.set(pick, ps.board[pick]); this.send({ type: 'act', a: { cell: pick } }) }
        break
      }
      case 'balance': {
        const b = st as BalanceState
        if (b.phase === 'vote' && b.votes[me] === undefined) this.once(`bv-${b.idx}`, rand(1500, 4500), () => this.send({ type: 'act', a: { choice: Math.random() < 0.5 ? 0 : 1 } }))
        break
      }
      case 'omok': {
        const o = st as OmokState
        if (o.winner || o.turn !== me || t < o.turnStart) return
        this.once(`om-${o.moves}`, rand(900, 2200), () => {
          const cur = this.room?.session?.state as OmokState | undefined
          if (!cur || cur.turn !== me || cur.winner) return
          const cell = omokBest(cur, me); if (cell >= 0) this.send({ type: 'act', a: { cell } })
        })
        break
      }
      case 'suika': {
        // 봇도 자기 폰처럼 물리를 직접 돌려요
        const ss = st as SuikaState; const p = ss.p[me]; if (!p) return
        let w = this.memo.get('suika') as World | undefined
        if (!w) { w = newWorld(); this.memo.set('suika', w); this.memo.set('suikaT', Date.now()) }
        const nowMs = Date.now(), prevMs = this.memo.get('suikaT') as number
        this.memo.set('suikaT', nowMs)
        suikaStep(w, (nowMs - prevMs) / 1000); w.pops = []
        if (!w.over && t >= this.nextAt && t < 120_000) {
          this.nextAt = t + rand(1100, 1900)
          const k = nextKind(ss.seed, w.drops)
          // 같은 과일 위를 노리거나, 아니면 아무 데나
          const same = w.fruits.filter((f) => f.k === k).sort((a, b) => a.y - b.y)[0]
          const x = same && Math.random() < 0.7 ? same.x + rand(-6, 6) : rand(RADIUS[k], BOX_W - RADIUS[k])
          suikaDrop(w, k, x)
        }
        const last = this.memo.get('suikaSent') as string | undefined
        const cur = { score: w.score, best: w.best, n: w.drops, over: w.over ? 1 : 0 }
        const key = JSON.stringify(cur)
        if (key !== last && nowMs - ((this.memo.get('suikaRep') as number) ?? 0) > 300) { this.memo.set('suikaSent', key); this.memo.set('suikaRep', nowMs); this.send({ type: 'act', a: { type: 'report', ...cur } }) }
        if (nowMs - ((this.memo.get('suikaSnap') as number) ?? 0) > 400) { this.memo.set('suikaSnap', nowMs); this.eph('suika', { f: suikaSnap(w), s: w.score }) }
        break
      }
      case 'merge': {
        const ms = st as MergeState; const p = ms.p[me]
        if (!p || p.over || t < this.nextAt || !canMove(p.board)) return
        this.nextAt = t + rand(450, 850)
        const order: Dir[] = ['down', 'left', 'right', 'up']
        let best: { d: Dir; v: number } | null = null
        for (const d of order) {
          const r = slide(p.board, d); if (!r) continue
          const v = r.gained + r.board.filter((x) => !x).length * 4 + (d === 'up' ? -20 : 0) + Math.random() * 3
          if (!best || v > best.v) best = { d, v }
        }
        if (best) this.send({ type: 'act', a: { dir: best.d } })
        break
      }
      case 'spot': {
        const sp = st as SpotState
        if (t < this.nextAt) return
        if (this.nextAt === 0) { this.nextAt = t + rand(5000, 8000); return }
        this.nextAt = t + rand(6500, 11000)
        const left = puzzleOf(sp).diffs.map((d, i) => ({ d, i })).filter(({ i }) => sp.found[i] === undefined)
        if (!left.length) return
        if (Math.random() < 0.15) { this.send({ type: 'act', a: { x: Math.random(), y: Math.random() } }); return }
        const { d } = left[Math.floor(Math.random() * left.length)]
        this.send({ type: 'act', a: { x: d.x + (Math.random() - 0.5) * d.rx, y: d.y + (Math.random() - 0.5) * d.ry } })
        break
      }
      case 'draw': {
        const d = st as DrawState
        if (d.phase !== 'draw') return
        if (d.drawer === me) this.once(`doodle-${d.round}`, 1500, () => this.doodle(d.round))
        else {
          const chance = [0.92, 0.8, 0.75, 0.55][d.round] ?? 0.7
          const all = [...WORDS.easy, ...WORDS.normal, ...WORDS.hard].filter((w) => w !== d.word)
          this.once(`g1-${d.round}`, rand(7000, 11000), () => this.guess(d.round, all[Math.floor(Math.random() * all.length)]))
          this.once(`g2-${d.round}`, rand(16000, 22000), () => this.guess(d.round, all[Math.floor(Math.random() * all.length)]))
          if (Math.random() < chance) this.once(`ok-${d.round}`, rand(13000, 42000), () => this.guess(d.round, d.word))
          else this.once(`ok-${d.round}`, 0, () => {})
        }
        break
      }
    }
  }

  private guess(round: number, text: string) {
    const d = this.room?.session?.state as DrawState | undefined
    if (!d || d.round !== round || d.phase !== 'draw') return
    this.send({ type: 'act', a: { type: 'guess', text } })
  }

  /** 봇은 그림 실력이 별로라서… 귀여운 낙서를 그린다 */
  private doodle(round: number) {
    const strokes: number[][] = []
    const circle = (cx: number, cy: number, r: number) => Array.from({ length: 28 }, (_, i) => { const a = (i / 27) * Math.PI * 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] }).flat()
    strokes.push(circle(0.5, 0.5, rand(0.18, 0.26)))
    strokes.push(circle(rand(0.42, 0.46), 0.45, 0.02), circle(rand(0.54, 0.58), 0.45, 0.02))
    strokes.push(Array.from({ length: 12 }, (_, i) => [0.42 + i * 0.015, 0.58 + Math.sin(i / 3.5) * 0.03]).flat())
    for (let k = 0; k < 3; k++) { const x = rand(0.15, 0.85), y = rand(0.15, 0.85); strokes.push(Array.from({ length: 10 }, (_, i) => [x + i * 0.015, y + Math.sin(i) * 0.02]).flat()) }
    const colors = ['#3B3541', '#F2554A', '#8F7BEA', '#F7C948']
    strokes.forEach((pts, i) => setTimeout(() => {
      const d = this.room?.session?.state as DrawState | undefined
      if (!d || d.round !== round || d.phase !== 'draw') return
      this.eph('stroke', { round, sid: `${this.info.id}-${round}-${i}`, color: colors[i % colors.length], size: 5, pts, done: true })
    }, i * 2200))
  }
}

export const BOT_INFO = (): PlayerInfo => ({ id: 'bot-' + Math.random().toString(36).slice(2, 8), nickname: '말랑봇', avatar: 'bot', bot: true })
