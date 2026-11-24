import { useEffect, useRef, useState } from 'react'
import { sfx } from '../../lib/sfx'
import { useStore } from '../../store'
import { Fit } from '../../components/ui'
import { rushProgress, type RushState } from './engine'

export interface GameProps<S> { state: S; t: number; meId: string; oppId: string }

export function RushGame({ state, meId, oppId }: GameProps<RushState>) {
  const act = useStore((s) => s.act)
  const me = state.p[meId]; const opp = state.p[oppId]
  const [shake, setShake] = useState(0)
  const lastErr = useRef(me?.errAt ?? -1)
  useEffect(() => { if (me && me.errAt !== lastErr.current) { lastErr.current = me.errAt; setShake((x) => x + 1); sfx.error() } }, [me?.errAt, me])
  const setDone = useRef(me?.sets ?? 0)
  useEffect(() => { if (me && me.sets !== setDone.current) { setDone.current = me.sets; sfx.pop() } }, [me?.sets, me])
  if (!me) return null
  const oppPct = opp ? (rushProgress(opp) / 9) * 100 : 0

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <div className="rounded-3xl bg-white/80 p-3 shadow-soft">
        <div className="flex items-center justify-between text-[13px] font-bold"><span className="text-ink-soft">상대 진행률</span><span className="tabular-nums text-ink-mute">{opp?.sets ?? 0}세트 · {opp ? rushProgress(opp) : 0}/9</span></div>
        <div className="mt-1.5 h-2.5 rounded-full bg-peach-100 overflow-hidden"><div className="h-full bg-peach-400 rounded-full transition-all duration-200" style={{ width: `${oppPct}%` }} /></div>
      </div>
      <div className="text-center">
        <p className="text-[13px] font-bold text-ink-mute">다음 숫자</p>
        <p key={me.next} className="font-round text-[38px] leading-none text-lav-500 animate-pop">{me.next}</p>
      </div>
      <Fit max={340}>
      <div key={shake} className={`grid grid-cols-3 grid-rows-3 gap-3 w-full h-full ${shake ? 'animate-shake' : ''}`}>
        {me.board.map((v, i) => {
          const done = v < me.next
          return (
            <button key={`${me.set}-${i}`} disabled={done} onPointerDown={(e) => { e.preventDefault(); if (v === me.next) sfx.tap(); act({ cell: i }) }}
              className={`rounded-3xl text-[clamp(24px,8vw,36px)] font-extrabold tabular-nums shadow-soft transition active:scale-95 ${done ? 'bg-lav-100 text-lav-300 scale-95' : 'bg-white text-ink'} animate-pop`}
              style={{ animationDelay: `${i * 20}ms` }} aria-label={`숫자 ${v}`}>
              {v}
            </button>
          )
        })}
      </div>
      </Fit>
      <div className="mt-auto mx-auto rounded-2xl bg-lav-50 text-lav-600 font-bold px-4 py-2.5 text-[14px] text-center">숫자를 순서대로 빠르게 눌러요! 세트 완성 +3 · 내 세트 {me.sets}</div>
    </div>
  )
}
