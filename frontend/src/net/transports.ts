// [백엔드 연결] Supabase Realtime 채널 연결 — 설정: frontend/.env, 서버: backend/supabase
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import type { Msg, PlayerInfo, Transport } from './protocol'

// 공개돼도 되는 값(프로젝트 URL, publishable 키)이라 기본값으로 둬요. 환경변수가 있으면 그걸 우선 사용.
// ⚠️ 비밀 키(sb_secret_, service_role)는 절대 여기에 넣지 마세요.
const URL = ((import.meta.env.VITE_SUPABASE_URL as string | undefined) || 'https://goqikjhpjrhlygkrlyhw.supabase.co').trim()
const KEY = ((import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || 'sb_publishable_BnP2C9NyGPOe2lIXRliyPA_y_MFzu6h').trim()
export const supabaseConfigured = !!(URL && KEY)
/** true면 익명 로그인 + 비공개(Private) 채널 사용 — backend/supabase/migrations 의 realtime 정책 필요 */
const PRIVATE = import.meta.env.VITE_SUPABASE_PRIVATE_CHANNELS === 'true'
let client: SupabaseClient | null = null
export const getSupabase = () => (supabaseConfigured ? (client ??= createClient(URL!, KEY!, { auth: { detectSessionInUrl: true, persistSession: true, flowType: 'pkce' }, realtime: { params: { eventsPerSecond: 30 } } })) : null)

/** Supabase Realtime: broadcast(게임 메시지) + presence(접속 상태) */
export class SupabaseTransport implements Transport {
  readonly kind = 'supabase' as const
  private ch: RealtimeChannel | null = null
  private msgCb: (m: Msg) => void = () => {}
  private presCb: (ids: string[]) => void = () => {}
  onMessage(cb: (m: Msg) => void) { this.msgCb = cb }
  onPresence(cb: (ids: string[]) => void) { this.presCb = cb }
  async connect(code: string, me: PlayerInfo) {
    const sb = getSupabase()
    if (!sb) throw new Error('Supabase가 설정되지 않았어요')
    if (PRIVATE) {
      const { data } = await sb.auth.getSession()
      if (!data.session) { const { error } = await sb.auth.signInAnonymously(); if (error) throw new Error('익명 로그인에 실패했어요') }
      await sb.realtime.setAuth()
    }
    return new Promise<void>((resolve, reject) => {
      const ch = sb.channel(`duo:${code}`, { config: { private: PRIVATE, broadcast: { self: false, ack: false }, presence: { key: me.id } } })
      this.ch = ch
      ch.on('broadcast', { event: 'm' }, ({ payload }) => {
        if (!payload || typeof payload !== 'object' || typeof (payload as Msg).t !== 'string') return
        this.msgCb(payload as Msg)
      })
      ch.on('presence', { event: 'sync' }, () => this.presCb(Object.keys(ch.presenceState())))
      let done = false
      const timer = setTimeout(() => { if (!done) { done = true; reject(new Error('서버 연결 시간 초과')) } }, 10_000)
      ch.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await ch.track({ id: me.id, nickname: me.nickname, at: Date.now() })
          if (!done) { done = true; clearTimeout(timer); resolve() }
        } else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !done) {
          done = true; clearTimeout(timer); reject(new Error('실시간 서버에 연결하지 못했어요'))
        }
      })
    })
  }
  send(m: Msg) { void this.ch?.send({ type: 'broadcast', event: 'm', payload: m }) }
  close() { if (this.ch) { void this.ch.untrack(); void getSupabase()?.removeChannel(this.ch) }; this.ch = null }
}

/** 같은 브라우저의 다른 탭끼리 연결 (BroadcastChannel) — 백엔드 없이 테스트용 */
export class LocalTransport implements Transport {
  readonly kind = 'local' as const
  private bc: BroadcastChannel | null = null
  private msgCb: (m: Msg) => void = () => {}
  private presCb: (ids: string[]) => void = () => {}
  private seen = new Map<string, number>()
  private timer: ReturnType<typeof setInterval> | null = null
  private me: PlayerInfo | null = null
  onMessage(cb: (m: Msg) => void) { this.msgCb = cb }
  onPresence(cb: (ids: string[]) => void) { this.presCb = cb }
  async connect(code: string, me: PlayerInfo) {
    if (typeof BroadcastChannel === 'undefined') throw new Error('이 브라우저는 로컬 모드를 지원하지 않아요')
    this.me = me
    this.bc = new BroadcastChannel('duoplay-' + code)
    this.bc.onmessage = (e) => {
      const d = e.data as { hb?: string; bye?: string; m?: Msg }
      if (d.hb) { const isNew = !this.seen.has(d.hb); this.seen.set(d.hb, Date.now()); if (isNew) this.emitPresence() }
      else if (d.bye) { this.seen.delete(d.bye); this.emitPresence() }
      else if (d.m) this.msgCb(d.m)
    }
    this.seen.set(me.id, Date.now() + 1e12)
    const beat = () => {
      this.bc?.postMessage({ hb: me.id })
      const now = Date.now(); let changed = false
      for (const [id, t] of this.seen) if (now - t > 3500) { this.seen.delete(id); changed = true }
      if (changed) this.emitPresence()
    }
    beat(); this.timer = setInterval(beat, 1000)
    this.emitPresence()
  }
  private emitPresence() { this.presCb([...this.seen.keys()]) }
  send(m: Msg) { this.bc?.postMessage({ m }) }
  close() { if (this.timer) clearInterval(this.timer); if (this.me) this.bc?.postMessage({ bye: this.me.id }); this.bc?.close(); this.bc = null }
}

/** 봇 대전용 인메모리 연결: 한 쌍의 엔드포인트 */
export class MemoryHub {
  ends: MemoryTransport[] = []
  constructor() { this.ends = [new MemoryTransport(this, 0), new MemoryTransport(this, 1)] }
  ids: (string | null)[] = [null, null]
  presence() { const ids = this.ids.filter(Boolean) as string[]; this.ends.forEach((e) => e.presCb(ids)) }
}
export class MemoryTransport implements Transport {
  readonly kind = 'bot' as const
  msgCb: (m: Msg) => void = () => {}
  presCb: (ids: string[]) => void = () => {}
  constructor(private hub: MemoryHub, private idx: number) {}
  onMessage(cb: (m: Msg) => void) { this.msgCb = cb }
  onPresence(cb: (ids: string[]) => void) { this.presCb = cb }
  async connect(_code: string, me: PlayerInfo) { this.hub.ids[this.idx] = me.id; setTimeout(() => this.hub.presence(), 0) }
  send(m: Msg) {
    const other = this.hub.ends[1 - this.idx]
    const copy = JSON.parse(JSON.stringify(m)) as Msg
    // 약간의 네트워크 지연 흉내
    setTimeout(() => other.msgCb(copy), 30 + Math.random() * 40)
  }
  close() { this.hub.ids[this.idx] = null; this.hub.presence(); this.msgCb = () => {} }
}
