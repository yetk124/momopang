import { useEffect, useRef } from 'react'
import { sfx } from '../../lib/sfx'
import { useStore } from '../../store'
import type { GameProps } from '../rush/RushGame'
import type { QuizState } from './engine'

export function QuizGame({ state, t, meId, oppId }: GameProps<QuizState>) {
  const act = useStore((s) => s.act)
  const players = useStore((s) => s.room?.players ?? [])
  const name = (id: string) => (id === meId ? '내가' : `${players.find((p) => p.id === id)?.nickname ?? '상대'}님이`)
  const q = state.qs[state.idx]
  const mine = state.answers[meId]; const opp = state.answers[oppId]
  const reveal = state.phase !== 'ask'
  const ready = t >= state.askAt

  const key = useRef(`${state.idx}-${state.phase}`)
  useEffect(() => {
    const k = `${state.idx}-${state.phase}`
    if (k === key.current) return
    key.current = k
    if (state.phase === 'reveal') { if (state.winner === meId) sfx.pop(); else if (state.winner) sfx.error() }
  }, [state.idx, state.phase, state.winner, meId])

  if (!q) return null
  return (
    <div className="flex-1 flex flex-col gap-3">
      <p className="text-center text-[13px] font-bold text-ink-mute">문제 {state.idx + 1} / {state.qs.length}</p>
      <div key={state.idx} className="rounded-3xl bg-white shadow-card px-5 py-7 text-center animate-pop">
        <p className="text-[22px] font-extrabold leading-snug text-balance">{ready ? q.q : '준비…'}</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {q.opts.map((o, i) => {
          const isAns = i === q.a
          const pickedMe = mine?.choice === i, pickedOpp = opp?.choice === i
          let cls = 'bg-white text-ink'
          if (reveal && isAns) cls = 'bg-mint-300 text-ink ring-[3px] ring-mint-500'
          else if (pickedMe && !mine.ok) cls = 'bg-[#FFE4E1] text-[#C9433A]'
          else if (pickedMe) cls = 'bg-lav-200 text-ink'
          return (
            <button key={i} disabled={!ready || reveal || !!mine} onClick={() => { sfx.tap(); act({ choice: i }) }}
              className={`relative min-h-[72px] rounded-2xl px-3 text-[18px] font-extrabold shadow-soft transition active:scale-95 disabled:active:scale-100 ${cls}`}>
              {o}
              {reveal && pickedOpp && <span className="absolute -top-2 -right-1 text-[11px] font-extrabold bg-peach-400 text-white rounded-full px-2 py-0.5">상대</span>}
              {pickedMe && <span className="absolute -top-2 -left-1 text-[11px] font-extrabold bg-lav-500 text-white rounded-full px-2 py-0.5">나</span>}
            </button>
          )
        })}
      </div>
      <div className="h-10 flex items-center justify-center">
        {reveal ? (
          <span className={`rounded-full px-4 py-2 text-[15px] font-extrabold animate-pop ${state.winner === meId ? 'bg-lav-100 text-lav-600' : state.winner ? 'bg-peach-100 text-ink' : 'bg-white text-ink-soft'}`}>
            {state.winner ? `${name(state.winner)} 먼저 맞혔어요! +1` : `정답은 ${q.opts[q.a]}`}
          </span>
        ) : mine && !mine.ok ? <span className="text-[14px] font-bold text-[#C9433A]">땡! 이번 문제는 끝까지 못 골라요</span> : null}
      </div>
      <p className="mt-auto mx-auto rounded-2xl bg-butter-100 text-ink font-bold px-4 py-2.5 text-[14px]">정답을 빠르게 선택하세요! 먼저 맞힌 사람만 +1</p>
    </div>
  )
}
