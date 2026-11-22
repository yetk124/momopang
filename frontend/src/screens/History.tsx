import { useEffect, useState } from 'react'
import { Avatar, type AvatarId } from '../components/Avatar'
import { GameIcon } from '../components/Icons'
import { TopBar } from '../components/ui'
import { META } from '../games/registry'
import { getDeviceId, loadHistory } from '../lib/storage'
import { fetchTop, type RankRow } from '../net/persist'
import { supabaseConfigured } from '../net/transports'
import { useStore } from '../store'
import { fetchHistory, isKakao } from '../lib/account'
import { getSupabase } from '../net/transports'

const MEDAL = ['#FFC93C', '#C9CFDB', '#E8A670']

/** 데모 모드: 이 기기에서 함께한 사람들 기준 순위 */
function localTop(myName: string, myAvatar: string): RankRow[] {
  const map = new Map<string, RankRow>()
  const add = (name: string, avatar: string, win: boolean, me = false) => {
    const r = map.get(name) ?? { nickname: name, avatar, wins: 0, games: 0, me }
    r.games++; if (win) r.wins++; map.set(name, r)
  }
  for (const h of loadHistory()) {
    add(myName, myAvatar, h.outcome === 'win', true)
    add(h.oppName, h.oppName === '말랑봇' ? 'bot' : 'tiger', h.outcome === 'lose')
  }
  return [...map.values()].filter((r) => r.wins > 0).sort((a, b) => b.wins - a.wins || a.games - b.games).slice(0, 3)
}

function Top3() {
  const me = useStore((s) => s.me)
  const [rows, setRows] = useState<RankRow[] | null>(supabaseConfigured ? null : localTop(me.nickname, me.avatar))
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!supabaseConfigured) return
    let alive = true
    void fetchTop(3).then(async (r) => {
      if (!alive) return
      if (!r) { setFailed(true); setRows(localTop(me.nickname, me.avatar)); return }
      const myIds = [getDeviceId(), (await getSupabase()?.auth.getSession())?.data.session?.user.id]
      setRows(r.map((x) => ({ ...x, me: myIds.includes((x as RankRow & { id?: string }).id) })))
    })
    return () => { alive = false }
  }, [me.nickname, me.avatar])

  const online = supabaseConfigured && !failed
  // 시상대 순서: 2등 · 1등 · 3등
  const podium = rows ? [rows[1], rows[0], rows[2]] : []
  const heights = ['h-14', 'h-20', 'h-10']
  return (
    <section className="rounded-3xl bg-white/85 shadow-soft p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-extrabold text-[16px]">명예의 전당 TOP 3</h2>
        <span className="text-[12px] text-ink-mute">{online ? '전체 사용자 · 누적 승리' : '이 기기에서 함께한 사람'}</span>
      </div>
      {rows === null ? (
        <p className="py-8 text-center text-[14px] text-ink-mute">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-[14px] text-ink-soft">아직 순위가 없어요 · 첫 승리의 주인공이 되어 보세요!</p>
      ) : (
        <div className="mt-3 grid grid-cols-3 items-end gap-2">
          {podium.map((r, i) => {
            const rank = i === 1 ? 1 : i === 0 ? 2 : 3
            if (!r) return <div key={i} />
            return (
              <div key={i} className="flex flex-col items-center min-w-0">
                {rank === 1 && <span className="text-[18px] -mb-1" aria-hidden>👑</span>}
                <Avatar id={r.avatar as AvatarId} size={rank === 1 ? 58 : 46} ring={MEDAL[rank - 1]} />
                <p className={`mt-1.5 text-[13px] font-bold truncate max-w-full ${r.me ? 'text-lav-500' : ''}`}>{r.nickname}{r.me && ' (나)'}</p>
                <p className="text-[12px] text-ink-mute tabular-nums">{r.wins}승</p>
                <div className={`mt-1 w-full ${heights[i]} rounded-t-xl grid place-items-start justify-center pt-1 font-round text-[20px] text-white`} style={{ background: MEDAL[rank - 1] }}>{rank}</div>
              </div>
            )
          })}
        </div>
      )}
      {!online && <p className="mt-2 text-[11px] text-ink-mute text-center">온라인(Supabase) 연결 후에는 전체 사용자 순위가 보여요</p>}
    </section>
  )
}

export function History() {
  const [list, setList] = useState(loadHistory())
  const [online, setOnline] = useState(false)
  useEffect(() => { if (isKakao()) void fetchHistory().then((h) => { if (h) { setList(h); setOnline(true) } }) }, [])
  const wins = list.filter((x) => x.outcome === 'win').length
  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="기록" />
      <div className="px-5 pb-6 flex flex-col gap-4">
        <Top3 />
        <section>
          <h2 className="font-extrabold text-[16px] mb-2">내 기록</h2>
          <div className="grid grid-cols-3 gap-2.5">
            {[['플레이', list.length], ['승리', wins], ['승률', list.length ? Math.round((wins / list.length) * 100) + '%' : '-']].map(([k, v]) => (
              <div key={k as string} className="rounded-3xl bg-white/80 shadow-soft p-3 text-center"><p className="text-[12px] font-bold text-ink-mute">{k}</p><p className="text-[24px] font-extrabold tabular-nums">{v}</p></div>
            ))}
          </div>
          <p className="text-[12px] text-ink-mute mt-2">최근 50판 · {online ? '카카오 계정에 저장돼요' : '이 기기에만 저장돼요'}</p>
          {list.length === 0 ? (
            <div className="mt-10 text-center text-ink-soft"><p className="font-round text-[22px]">아직 기록이 없어요</p><p className="mt-1 text-[14px]">친구랑 한 판 하고 오면 여기에 쌓여요</p></div>
          ) : (
            <ul className="mt-3 rounded-3xl bg-white/85 shadow-soft divide-y divide-lav-100 overflow-hidden">
              {list.map((h) => (
                <li key={h.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: META[h.game]?.tint }}><GameIcon id={h.game} className="w-7 h-7" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[15px] truncate">{META[h.game]?.name} <span className="text-ink-mute font-semibold text-[13px]">vs {h.oppName}</span></p>
                    <p className="text-[12px] text-ink-mute">{new Date(h.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-[12px] font-extrabold ${h.outcome === 'win' ? 'text-lav-500' : h.outcome === 'lose' ? 'text-ink-mute' : 'text-ink-soft'}`}>{h.outcome === 'win' ? '승리' : h.outcome === 'lose' ? '패배' : '무승부'}</p>
                    <p className="tabular-nums font-bold whitespace-nowrap">{h.myScore} : {h.oppScore}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
