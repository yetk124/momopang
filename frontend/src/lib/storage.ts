import { uid } from './rng'
import type { AvatarId } from '../components/Avatar'
import type { GameId } from '../games/types'

export interface Profile { nickname: string; avatar: AvatarId }
export interface HistoryItem { id: string; game: GameId; at: number; myScore: number; oppScore: number; oppName: string; outcome: 'win' | 'lose' | 'draw' }

const get = <T,>(s: Storage | undefined, k: string): T | null => { try { const v = s?.getItem(k); return v ? (JSON.parse(v) as T) : null } catch { return null } }
const set = (s: Storage | undefined, k: string, v: unknown) => { try { s?.setItem(k, JSON.stringify(v)) } catch { /* noop */ } }
const ls = (() => { try { return window.localStorage } catch { return undefined } })()
const ss = (() => { try { return window.sessionStorage } catch { return undefined } })()

/** 플레이어 ID는 탭 단위(sessionStorage) → 같은 브라우저 2탭 테스트 가능, 새로고침에도 유지 */
export function getPlayerId(): string {
  let id = get<string>(ss, 'duoplay-pid')
  if (!id) { id = uid(); set(ss, 'duoplay-pid', id) }
  return id
}
/** 랭킹용 기기 ID (브라우저 단위로 유지, 탭마다 바뀌지 않음) */
export function getDeviceId(): string {
  let id = get<string>(ls, 'duoplay-device')
  if (!id) { id = uid(); set(ls, 'duoplay-device', id) }
  return id
}
export type LoginType = 'guest' | 'kakao'
export const getLoginType = () => get<LoginType>(ls, 'duoplay-login') ?? 'guest'
export const setLoginType = (t: LoginType) => set(ls, 'duoplay-login', t)
export const loadProfile = () => get<Profile>(ls, 'duoplay-profile')
export const saveProfile = (p: Profile) => set(ls, 'duoplay-profile', p)

export const loadHistory = () => get<HistoryItem[]>(ls, 'duoplay-history') ?? []
export function pushHistory(h: HistoryItem) {
  const list = loadHistory()
  if (list.some((x) => x.id === h.id)) return
  set(ls, 'duoplay-history', [h, ...list].slice(0, 50))
}

export interface ActiveRoom { code: string; mode: 'supabase' | 'local'; host: boolean }
export const loadActive = () => get<ActiveRoom>(ss, 'duoplay-active')
export const saveActive = (a: ActiveRoom | null) => { if (a) set(ss, 'duoplay-active', a); else { try { ss?.removeItem('duoplay-active') } catch { /* noop */ } } }

export function saveHostState(code: string, state: unknown) { set(ls, 'duoplay-host-' + code, { at: Date.now(), state }) }
export function loadHostState<T>(code: string): T | null {
  const v = get<{ at: number; state: T }>(ls, 'duoplay-host-' + code)
  return v && Date.now() - v.at < 10 * 60_000 ? v.state : null
}
export function clearHostState(code: string) { try { ls?.removeItem('duoplay-host-' + code) } catch { /* noop */ } }
