import { useEffect, useRef } from 'react'
import { Avatar } from '../../components/Avatar'
import { Button } from '../../components/ui'
import { sfx } from '../../lib/sfx'
import { useStore } from '../../store'
import type { GameProps } from '../rush/RushGame'
import type { BalanceState } from './engine'

/** 밸런스 게임: 둘 다 고르면 공개 → 얘기 나누고 → 다음 질문 */
export function BalanceGame({ state, meId, oppId }: GameProps<BalanceState>) {
  const act = useStore((s) => s.act)
  const players = useStore((s) => s.room?.players ?? [])
  const me = players.find((p) => p.id === meId)
  const opp = players.find((p) => p.id === oppId)
  const q = state.qs[state.idx]
  const mine = state.votes[meId]
  const theirs = state.votes[oppId]
  const reveal = state.phase === 'reveal'
  const same = reveal && mine === theirs

  const key = useRef('')
  useEffect(() => {
    const k = `${state.idx}-${state.phase}`
    if (k === key.current) return
    key.current = k
    if (state.phase === 'reveal') { if (same) sfx.pop(); else sfx.count() }
  }, [state.idx, state.phase, same])

  if (!q) return null
  const option = (v: 0 | 1, text: string) => {
    const picked = mine === v
    const oppPicked = reveal && theirs === v
    const tone = v === 0 ? { bg: '#EFEAFF', ring: '#8F7BEA', ink: '#5B47C2' } : { bg: '#FFEDE4', ring: '#FF9B6A', ink: '#C8562A' }
    return (
      <button
        type="button" disabled={mine !== undefined || reveal}
        onClick={() => { sfx.tap(); act({ choice: v }) }}
        className={`press relative flex-1 min-h-0 rounded-3xl px-5 py-4 flex flex-col items-center justify-center text-center transition ${mine !== undefined && !picked && !oppPicked ? 'opacity-45' : ''}`}
        style={{ background: tone.bg, boxShadow: picked || oppPicked ? `0 0 0 3px ${tone.ring}` : undefined }}
        aria-pressed={picked}
      >
        <span className="font-round text-[22px] leading-none" style={{ color: tone.ink }}>{v === 0 ? 'A' : 'B'}</span>
        <span className="mt-2 text-[18px] font-extrabold leading-snug text-ink text-balance">{text}</span>
        {(picked || oppPicked) && (
          <span className="absolute top-2.5 right-2.5 flex -space-x-2">
            {picked && me && <Avatar id={me.avatar} size={30} className="ring-2 ring-white rounded-full" />}
            {oppPicked && opp && <Avatar id={opp.avatar} size={30} className="ring-2 ring-white rounded-full" />}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2.5">
      <div className="flex items-center justify-between px-1">
        <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-[12px] font-bold text-ink-soft">{q.cat}</span>
        <span className="text-[13px] font-bold text-ink-mute tabular-nums">질문 {state.idx + 1} / {state.qs.length}</span>
      </div>
      <div key={state.idx} className="flex-1 min-h-0 flex flex-col gap-2 animate-pop">
        {option(0, q.a)}
        <div className="text-center font-round text-[18px] text-ink-mute leading-none">VS</div>
        {option(1, q.b)}
      </div>
      <div className="min-h-[96px] flex flex-col justify-end">
        {reveal ? (
          <div className="animate-fadeup">
            <p className={`text-center font-round text-[20px] ${same ? 'text-lav-500' : 'text-peach-400'}`}>{same ? '같은 선택! 💕' : '서로 달라요! 🔥'}</p>
            <p className="text-center text-[13px] font-bold text-ink-soft mt-0.5">{same ? '통했다! 왜 골랐는지 얘기해봐요' : '왜 그걸 골랐는지 서로 물어봐요'}</p>
            <Button className="w-full mt-2" onClick={() => act({ choice: -1 })}>{state.idx + 1 >= state.qs.length ? '결과 보기' : '다음 질문 →'}</Button>
          </div>
        ) : (
          <p className="text-center rounded-2xl bg-white/80 px-4 py-3 text-[14px] font-bold text-ink-soft">
            {mine === undefined ? '둘 중 하나를 골라요! 시간 제한은 없어요' : theirs === undefined ? `${opp?.nickname ?? '상대'}님이 고르는 중…` : '공개!'}
          </p>
        )}
      </div>
    </div>
  )
}
