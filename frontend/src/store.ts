import { create } from 'zustand'
import { recordGame as recordProgress, unlockName, type LimitedId } from './lib/unlocks'
import { toAvatarId, type AvatarId } from './components/Avatar'
import { ENGINES, META } from './games/registry'
import type { GameId } from './games/types'
import { makeRoomCode } from './lib/rng'
import { sfx } from './lib/sfx'
import { settings } from './lib/settings'
import { track } from './lib/analytics'
import { isKakao, saveHistory, saveMyProfile, saveUnlocks } from './lib/account'
import { duckMusic } from './lib/bgm'
import {
  clearHostState, getDeviceId, getPlayerId, loadActive, loadHostState, loadProfile, pushHistory, saveActive, saveProfile, type Profile,
} from './lib/storage'
import { BOT_INFO, Bot } from './net/bot'
import { HostController, newRoom } from './net/host'
import { cleanNickname } from './net/validate'
import { persistRoom, recordGame } from './net/persist'
import { gameMs, type Intent, type Msg, type PlayerInfo, type RoomState, type Transport } from './net/protocol'
import { LocalTransport, MemoryHub, SupabaseTransport, supabaseConfigured } from './net/transports'

export type Screen = 'onboard' | 'home' | 'room' | 'history' | 'settings' | 'notfound' | 'invite'
export type Mode = 'supabase' | 'local' | 'bot'

interface Pending { seq: number; a: unknown }
interface State {
  screen: Screen
  profile: Profile | null
  me: PlayerInfo
  mode: Mode | null
  room: RoomState | null
  isHost: boolean
  busy: boolean
  error: string | null
  offset: number
  pending: Pending[]
  presentIds: string[]
  toast: { id: number; text: string } | null
  /** 방금 끝난 판에서 새로 해금된 한정판 아바타 (결과 화면 표시용) */
  unlockedNow: LimitedId[]
  joinPrefill: string | null
  hostAwaySince: number | null

  go: (s: Screen) => void
  setProfile: (nickname: string, avatar: AvatarId) => void
  showToast: (text: string) => void
  setError: (e: string | null) => void
  createRoom: (mode: Mode, game?: GameId, restore?: { code: string; state: RoomState | null }) => Promise<void>
  joinRoom: (code: string, mode?: Mode) => Promise<void>
  /** 랜덤 매칭 성공 → 방장은 방 생성, 참가자는 입장 (둘 다 자동 준비) */
  enterMatch: (r: { code: string; game: GameId; isHost: boolean }) => Promise<void>
  leaveRoom: (msg?: string) => void
  intent: (i: Intent) => void
  act: (a: unknown) => void
  eph: (k: string, d: unknown) => void
}

// ── 모듈 단위 연결 자원 ──
let transport: Transport | null = null
let host: HostController | null = null
let bot: Bot | null = null
let seq = 0
let pingTimer: ReturnType<typeof setInterval> | null = null
let bestRtt = Infinity
/** 랜덤 매칭으로 들어온 방이면 둘 다 들어왔을 때 자동으로 준비 */
let matchAuto = false
type EphListener = (from: string, k: string, d: any) => void
const ephListeners = new Set<EphListener>()
export const onEph = (fn: EphListener) => { ephListeners.add(fn); return () => { ephListeners.delete(fn) } }

export const defaultMode = (): Mode => (supabaseConfigured ? 'supabase' : 'local')
export const hostNow = () => Date.now() + useStore.getState().offset

function makeTransport(mode: Mode): Transport {
  return mode === 'supabase' ? new SupabaseTransport() : new LocalTransport()
}

function teardown() {
  if (pingTimer) clearInterval(pingTimer); pingTimer = null
  host?.dispose(); host = null
  bot?.dispose(); bot = null
  transport?.close(); transport = null
  seq = 0; bestRtt = Infinity
}

function parseInvite(): string | null {
  try {
    const u = new URL(window.location.href)
    const q = u.searchParams.get('code')
    if (q) return /^[A-Za-z0-9]{6}$/.test(q) ? q.toUpperCase() : null
    const m = u.hash.match(/^#join-([A-Za-z0-9]{6})$/)
    return m ? m[1].toUpperCase() : null
  } catch { return null }
}

export function inviteLink(code: string) {
  const { origin, pathname } = window.location
  if (useStore.getState().mode === 'supabase') return `${origin}/join?code=${code}`
  return `${origin}${pathname}#join-${code}`
}

const raw0 = loadProfile()
const nick0 = raw0 ? cleanNickname(raw0.nickname) : null
const profile0 = raw0 && nick0 ? { nickname: nick0, avatar: toAvatarId(String(raw0.avatar)) } : null
// 모르는 주소 → 404 화면 (한 파일 데모 빌드는 주소가 다르므로 제외)
const badPath = (() => { try { return import.meta.env.MODE !== 'single' && location.protocol.startsWith('http') && !['/', '/index.html', '/join', '/join/'].includes(location.pathname) } catch { return false } })()

export const useStore = create<State>((set, get) => ({
  screen: badPath ? 'notfound' : profile0 ? 'home' : 'onboard',
  profile: profile0,
  me: { id: getPlayerId(), nickname: profile0?.nickname ?? '', avatar: toAvatarId(profile0?.avatar ?? 'rabbit') },
  mode: null,
  room: null,
  isHost: false,
  busy: false,
  error: null,
  offset: 0,
  pending: [],
  presentIds: [],
  toast: null,
  unlockedNow: [],
  joinPrefill: parseInvite(),
  hostAwaySince: null,

  go: (screen) => set({ screen }),
  setProfile: (rawNick, avatar) => {
    const nickname = cleanNickname(rawNick)
    if (!nickname) { get().showToast('사용할 수 없는 닉네임이에요'); return }
    const p = { nickname, avatar: toAvatarId(avatar) }
    saveProfile(p)
    const me = { ...get().me, nickname, avatar: p.avatar }
    set({ profile: p, me, screen: get().screen === 'onboard' ? 'home' : get().screen })
    if (isKakao()) void saveMyProfile(nickname, p.avatar) // 계정에도 저장
    if (get().room) get().intent({ type: 'join', player: me })
    else if (get().screen === 'settings') get().showToast('저장했어요')
  },
  showToast: (text) => { const id = Date.now(); set({ toast: { id, text } }); setTimeout(() => { if (get().toast?.id === id) set({ toast: null }) }, 2200) },
  setError: (error) => set({ error }),

  async createRoom(mode, game, restore) {
    if (get().busy) return
    teardown()
    const me = get().me
    const code = restore?.code ?? makeRoomCode()
    set({ busy: true, error: null, mode, isHost: true, pending: [], offset: 0 })
    try {
      let hub: MemoryHub | null = null
      if (mode === 'bot') { hub = new MemoryHub(); transport = hub.ends[0] } else transport = makeTransport(mode)
      const tr = transport
      tr.onMessage((m) => { if (m.t === 'eph') emitEph(m); else host?.handle(m) })
      tr.onPresence((ids) => { set({ presentIds: ids }); host?.presence(ids) })
      await tr.connect(code, me)
      host = new HostController(tr, me, (s) => onRoom(s), restore?.state ?? newRoom(code, me))
      if (game) host.local({ type: 'select', game }, ++seq)
      if (hub) { bot = new Bot(hub.ends[1], BOT_INFO()); await bot.connect(code) }
      if (mode !== 'bot') saveActive({ code, mode, host: true })
      if (mode === 'supabase' && !restore) void persistRoom(code, me)
      set({ screen: 'room', busy: false })
      track('room_create', { mode, game: game ?? '' })
    } catch (e) {
      teardown()
      set({ busy: false, error: (e as Error).message || '방을 만들지 못했어요', room: null, mode: null })
    }
  },

  async joinRoom(rawCode, mode = defaultMode()) {
    if (get().busy) return
    const code = rawCode.toUpperCase()
    if (!/^[A-Z0-9]{6}$/.test(code)) { set({ error: '방 코드는 영문·숫자 6자리예요' }); return }
    teardown()
    const me = get().me
    set({ busy: true, error: null, mode, isHost: false, pending: [], room: null, offset: 0 })
    try {
      const tr = makeTransport(mode); transport = tr
      let resolveRoom: (() => void) | null = null
      const gotRoom = new Promise<void>((r) => (resolveRoom = r))
      let knownHost: string | null = null
      tr.onMessage((m) => {
        if (m.t === 'room') {
          // 처음 받은 방장 ID와 다른 곳에서 온 방 상태는 무시 (가짜 상태 주입 방지)
          if (!m.s || m.s.code !== code || typeof m.s.hostId !== 'string') return
          if (knownHost && m.s.hostId !== knownHost) return
          knownHost ??= m.s.hostId
          resolveRoom?.(); onRoom(m.s)
        }
        else if (m.t === 'pong' && m.to === me.id) {
          const now = Date.now(); const rtt = now - m.t0
          if (rtt <= bestRtt) { bestRtt = rtt; set({ offset: m.h + rtt / 2 - now }) }
        } else if (m.t === 'eph') emitEph(m)
      })
      tr.onPresence((ids) => {
        const room = get().room
        const hostIn = !room || ids.includes(room.hostId)
        set({ presentIds: ids, hostAwaySince: hostIn ? null : (get().hostAwaySince ?? Date.now()) })
        // 호스트가 재접속하면 내 정보를 다시 알림
        if (hostIn && room) { tr.send({ t: 'hello', from: me.id }); tr.send({ t: 'intent', from: me.id, seq: ++seq, i: { type: 'join', player: me } }) }
      })
      await tr.connect(code, me)
      tr.send({ t: 'hello', from: me.id })
      tr.send({ t: 'intent', from: me.id, seq: ++seq, i: { type: 'join', player: me } })
      // 방장이 아직 채널에 붙는 중일 수 있어 몇 번 더 알림
      for (const ms of [1200, 2500, 4000]) setTimeout(() => { if (transport === tr && !get().room) { tr.send({ t: 'hello', from: me.id }); tr.send({ t: 'intent', from: me.id, seq: ++seq, i: { type: 'join', player: me } }) } }, ms)
      const ping = () => tr.send({ t: 'ping', from: me.id, t0: Date.now() })
      ping(); setTimeout(ping, 300); setTimeout(ping, 800)
      pingTimer = setInterval(ping, 5000)
      const ok = await Promise.race([gotRoom.then(() => true), new Promise<boolean>((r) => setTimeout(() => r(false), 6000))])
      if (!ok) throw new Error('유효하지 않은 방 코드예요')
      const room = get().room!
      if (room.closed) throw new Error('종료된 방이에요')
      if (!room.players.some((p) => p.id === me.id)) {
        // join 처리까지 잠깐 기다림
        await new Promise((r) => setTimeout(r, 700))
        const r2 = get().room!
        if (!r2.players.some((p) => p.id === me.id)) throw new Error(r2.phase === 'playing' ? '지금 게임이 진행 중이라 들어갈 수 없어요 (관전 불가)' : '방이 가득 찼어요')
      }
      saveActive({ code, mode: mode as 'supabase' | 'local', host: false })
      set({ screen: 'room', busy: false, joinPrefill: null })
      track('room_join', { mode })
    } catch (e) {
      teardown()
      saveActive(null)
      set({ busy: false, error: (e as Error).message || '연결에 실패했어요. 다시 시도해 주세요', room: null, mode: null })
    }
  },

  async enterMatch(r) {
    matchAuto = true
    track('match_success', { game: r.game, role: r.isHost ? 'host' : 'guest' })
    if (r.isHost) { await get().createRoom(defaultMode(), r.game, { code: r.code, state: null }); return }
    await new Promise((res) => setTimeout(res, 900))
    await get().joinRoom(r.code)
    if (!get().room) { set({ error: null }); await new Promise((res) => setTimeout(res, 1200)); await get().joinRoom(r.code) }
    if (!get().room) { matchAuto = false; set({ error: '상대와 연결하지 못했어요. 다시 매칭해 주세요' }) }
  },

  leaveRoom(msg) {
    matchAuto = false
    const { room, me, isHost } = get()
    if (room) track('room_leave', { phase: room.phase, game: room.session?.game ?? room.game ?? '' })
    if (room && transport) {
      if (isHost) host?.local({ type: 'leave' }, ++seq)
      else transport.send({ t: 'intent', from: me.id, seq: ++seq, i: { type: 'leave' } })
      if (isHost) clearHostState(room.code)
    }
    saveActive(null)
    setTimeout(teardown, 150)
    set({ room: null, screen: 'home', mode: null, pending: [], hostAwaySince: null })
    if (msg) get().showToast(msg)
  },

  intent(i) {
    const { me, isHost } = get()
    if (i.type === 'select') track('game_select', { game: i.game })
    if (i.type === 'rematch') track('rematch_request', { game: get().room?.result?.game ?? '' })
    const s = ++seq
    if (isHost) host?.local(i, s)
    else transport?.send({ t: 'intent', from: me.id, seq: s, i })
  },

  act(a) {
    const { me, isHost, room } = get()
    const s = ++seq
    if (isHost) { host?.local({ type: 'act', a }, s); return }
    const g = room?.session?.game
    if (g && ENGINES[g].predict) set({ pending: [...get().pending, { seq: s, a }] })
    transport?.send({ t: 'intent', from: me.id, seq: s, i: { type: 'act', a } })
  },

  eph(k, d) { const me = get().me; transport?.send({ t: 'eph', from: me.id, k, d }) },
}))

function emitEph(m: Msg) { if (m.t === 'eph') ephListeners.forEach((fn) => fn(m.from, m.k, m.d)) }

function onRoom(s: RoomState) {
  const st = useStore.getState()
  const prev = st.room
  if (prev && s.version < prev.version && prev.code === s.code && !st.isHost) return // 오래된 상태 무시
  const ack = s.session?.ack[st.me.id] ?? 0
  const pending = prev?.session?.id === s.session?.id ? st.pending.filter((p) => p.seq > ack) : []
  useStore.setState({ room: s, pending })
  // 랜덤 매칭: 둘 다 들어오고 게임이 정해지면 자동 준비 → 카운트다운
  if (matchAuto && s.phase === 'lobby' && s.game && s.players.length === 2) {
    const mine = s.players.find((p) => p.id === st.me.id)
    if (mine && !mine.ready) { matchAuto = false; setTimeout(() => useStore.getState().intent({ type: 'ready', v: true }), 300) }
  }

  if (s.closed && !st.isHost) { useStore.getState().leaveRoom('방장이 방을 닫았어요'); return }
  if (prev && !st.isHost && prev.players.some((p) => p.id === st.me.id) && !s.players.some((p) => p.id === st.me.id)) {
    useStore.getState().leaveRoom('방에서 나왔어요'); return
  }
  // 상대 입·퇴장 토스트
  if (prev && prev.code === s.code) {
    const opp = s.players.find((p) => p.id !== st.me.id)
    const prevOpp = prev.players.find((p) => p.id !== st.me.id)
    const n = settings()
    if (opp && !prevOpp && n.notifyJoin) { useStore.getState().showToast(`${opp.nickname}님이 들어왔어요!`); sfx.pop() }
    if (!opp && prevOpp && n.notifyJoin) useStore.getState().showToast(`${prevOpp.nickname}님이 나갔어요`)
    if (opp && prevOpp?.ready === false && opp.ready && s.phase === 'lobby' && n.notifyReady) useStore.getState().showToast(`${opp.nickname}님 준비 완료!`)
    if (opp && s.rematch && s.rematch.from === opp.id && prev.rematch?.at !== s.rematch.at && n.notifyRematch) { useStore.getState().showToast(`${opp.nickname}님이 한 판 더 하재요!`); sfx.pop() }
  }
  // GA 게임 이벤트
  if (s.phase === 'playing' && prev?.phase !== 'playing' && s.session) track('game_start', { game: s.session.game, mode: st.mode ?? '' })
  if (s.phase === 'result' && prev?.phase !== 'result' && s.result) {
    const r = s.result
    track('game_end', { game: r.game, mode: st.mode ?? '', outcome: r.winnerId === null ? 'draw' : r.winnerId === st.me.id ? 'win' : 'lose', end_reason: r.endReason, duration_sec: Math.round(r.durationMs / 1000), score: r.scores[st.me.id] ?? 0 })
  }
  // 결과 기록
  if (s.phase === 'result' && s.result && prev?.phase !== 'result') {
    const r = s.result; const me = st.me.id
    const opp = s.players.find((p) => p.id !== me) ?? prev?.players.find((p) => p.id !== me)
    const oppId = Object.keys(r.scores).find((k) => k !== me) ?? ''
    const item = {
      id: r.sessionId, game: r.game, at: Date.now(), myScore: r.scores[me] ?? 0, oppScore: r.scores[oppId] ?? 0,
      oppName: opp?.nickname ?? '상대', outcome: (r.winnerId === null ? 'draw' : r.winnerId === me ? 'win' : 'lose') as 'win' | 'lose' | 'draw',
    }
    pushHistory(item)
    void saveHistory(item) // 카카오 로그인 상태면 서버에도 저장
    duckMusic(2600)
    if (r.winnerId === me) sfx.win(); else if (r.winnerId) sfx.lose(); else sfx.draw()
    if (st.mode === 'supabase') void recordGame(getDeviceId(), st.me.nickname, st.me.avatar, r.winnerId === me)
    // 한정판 아바타 해금 체크
    const fresh = recordProgress(r.game, item.outcome)
    useStore.setState({ unlockedNow: fresh })
    if (fresh.length) {
      setTimeout(() => useStore.getState().showToast(`🎉 ${fresh.map(unlockName).join(', ')} 해금! 프로필에서 바꿀 수 있어요`), 1200)
      void saveUnlocks()
    }
  }
  if (s.phase === 'playing' && prev?.phase !== 'playing' && st.unlockedNow.length) useStore.setState({ unlockedNow: [] })
}

/** 화면용 게임 상태: 호스트 상태 + 아직 확인 안 된 내 입력(낙관적 적용) */
export function selectGameView(st: State, now: number) {
  const sess = st.room?.session
  if (!sess) return null
  const t = gameMs(sess.clock, now + st.offset)
  let state = sess.state
  const eng = ENGINES[sess.game]
  if (eng.predict && !st.isHost) for (const p of st.pending) { const nx = eng.apply(state, st.me.id, p.a, t); if (nx) state = nx }
  return { state, t, game: sess.game, meta: META[sess.game] }
}

/** 새로고침 후 진행 중이던 방 복구 */
export function restoreSession() {
  const a = loadActive(); const st = useStore.getState()
  if (!a || !st.profile) return
  if (a.host) void st.createRoom(a.mode, undefined, { code: a.code, state: loadHostState<RoomState>(a.code) })
  else void st.joinRoom(a.code, a.mode)
}

// 호스트 장기 부재 감시 (게스트)
setInterval(() => {
  const st = useStore.getState()
  if (st.hostAwaySince && st.room && Date.now() - st.hostAwaySince > 30_000) st.leaveRoom('방장과 연결이 끊겨 방을 나왔어요')
}, 1000)
