// [백엔드 연결] Supabase DB 기록·조회 — 테이블 정의: backend/supabase/migrations
import { getSupabase } from './transports'
import type { PlayerInfo, ResultData } from './protocol'

/**
 * Supabase DB 기록 (선택). 실시간 동기화는 Realtime 채널만으로 동작하고,
 * 테이블이 없거나 RLS로 막혀도 게임 진행에는 영향 없음.
 */
export async function persistRoom(code: string, host: PlayerInfo) {
  const sb = getSupabase(); if (!sb) return
  try {
    await sb.from('players').upsert({ id: host.id, nickname: host.nickname, avatar_id: host.avatar }, { onConflict: 'id', ignoreDuplicates: true })
    await sb.from('rooms').insert({ room_code: code, host_id: host.id, status: 'WAITING', expires_at: new Date(Date.now() + 6 * 3600_000).toISOString() })
  } catch { /* optional */ }
}

export async function persistResult(code: string, r: ResultData) {
  const sb = getSupabase(); if (!sb) return
  try {
    const { data } = await sb.from('rooms').select('id').eq('room_code', code).order('created_at', { ascending: false }).limit(1).maybeSingle()
    await sb.from('game_sessions').insert({
      id: r.sessionId, room_id: data?.id ?? null, game_type: r.game, status: 'ENDED',
      end_at: new Date().toISOString(), winner_id: r.winnerId, result: r,
    })
  } catch { /* optional */ }
}

export interface RankRow { nickname: string; avatar: string; wins: number; games: number; me?: boolean }

/** 게임 끝날 때 내 기록 1판 추가 (서버 함수에서 검증·도배 방지) */
/** 서버가 판마다 1번만, 승리는 한 사람만, 시간당 횟수 제한을 걸어서 반영 (20261125010000_anticheat.sql) */
export async function recordGame(deviceId: string, nickname: string, avatar: string, win: boolean, game: string, sessionId: string) {
  const sb = getSupabase(); if (!sb) return
  try { await sb.rpc('record_game', { p_device: deviceId, p_nickname: nickname, p_avatar: avatar, p_win: win, p_game: game, p_session: sessionId }) } catch { /* optional */ }
}

/** 전체 사용자 승리 TOP N (기기 ID는 받지 않고, 내 기록인지만 받음) */
export async function fetchTop(deviceId: string, n = 3): Promise<RankRow[] | null> {
  const sb = getSupabase(); if (!sb) return null
  try {
    const { data, error } = await sb.rpc('top_players', { p_device: deviceId, p_n: n })
    if (error || !Array.isArray(data)) return null
    return (data as RankRow[]).map((r) => ({ nickname: r.nickname, avatar: r.avatar, wins: r.wins, games: r.games, me: !!r.me }))
  } catch { return null }
}
