import { useEffect, useRef } from 'react'
import { Avatar } from '../../components/Avatar'
import { sfx } from '../../lib/sfx'
import { vibrate } from '../../lib/settings'
import { useStore } from '../../store'
import { useBox } from '../../components/ui'
import type { GameProps } from '../rush/RushGame'
import { BOMB_ROUNDS, type BombState } from './engine'
import { BOOM_IMG } from './boomImg'

function BombArt({ shake, className = '' }: { shake: number; className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} style={{ animation: `bombShake ${Math.max(0.12, 0.6 - shake * 0.45)}s ease-in-out infinite` }} aria-hidden>
      <ellipse cx="56" cy="110" rx="34" ry="6" fill="#3B3541" opacity=".12" />
      <circle cx="56" cy="70" r="36" fill="#3B3541" />
      <circle cx="44" cy="58" r="9" fill="#fff" opacity=".28" />
      <rect x="66" y="28" width="18" height="16" rx="4" transform="rotate(40 75 36)" fill="#6E6775" />
      <path d="M82 30c6-8 10-10 16-12" stroke="#B9871E" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <g className="origin-[100px_16px] animate-pulse">
        <circle cx="100" cy="16" r="7" fill="#FF9B4A" /><circle cx="100" cy="16" r="3.5" fill="#FFE27A" />
        <path d="M100 4v-3M110 10l3-2M112 19l3 1M90 8l-3-2" stroke="#FF9B4A" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    </svg>
  )
}

export function BombGame({ state, t, meId, oppId }: GameProps<BombState>) {
  const act = useStore((s) => s.act)
  const players = useStore((s) => s.room?.players ?? [])
  const me = players.find((p) => p.id === meId); const opp = players.find((p) => p.id === oppId)
  const mine = state.holder === meId
  const elapsed = Math.max(0, t - state.roundStart)
  const tension = Math.min(1, elapsed / 22_000)
  const locked = t < (state.p[meId]?.lockUntil ?? 0)
  const area = useRef<HTMLDivElement>(null)
  const box = useBox(area)
  const bs = Math.max(60, Math.min(150, box.h * 0.9))

  // 째깍 소리: 시간이 갈수록 빨라짐
  const tRef = useRef(t); tRef.current = t
  useEffect(() => {
    if (state.phase !== 'play') return
    let stop = false
    const loop = () => {
      if (stop) return
      sfx.flip()
      const e = Math.max(0, tRef.current - state.roundStart)
      setTimeout(loop, Math.max(180, 900 - e / 30))
    }
    const id = setTimeout(loop, 400)
    return () => { stop = true; clearTimeout(id) }
  }, [state.phase, state.round, state.roundStart])
  const boomKey = useRef(state.round + state.phase)
  useEffect(() => { const k = state.round + state.phase; if (k !== boomKey.current) { boomKey.current = k; if (state.phase === 'boom') { sfx.error(); vibrate([80, 40, 160]) } } }, [state.phase, state.round])
  const passKey = useRef(state.lastPass?.t)
  useEffect(() => { if (state.lastPass && state.lastPass.t !== passKey.current) { passKey.current = state.lastPass.t; sfx.pop() } }, [state.lastPass])

  if (state.phase === 'boom' || state.phase === 'done') {
    const loserMe = state.loser === meId
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
        <img src={BOOM_IMG} alt="펑!" draggable={false} className="w-[min(52vw,200px)] h-auto select-none" style={{ animation: 'boomIn .5s cubic-bezier(.2,1.6,.4,1) both' }} />
        <style>{'@keyframes boomIn{0%{transform:scale(.2) rotate(-12deg);opacity:0}60%{transform:scale(1.12) rotate(3deg);opacity:1}100%{transform:scale(1) rotate(0)}}'}</style>
        <p className="font-round text-[26px]">{loserMe ? '내 손에서 터졌어요…' : `${opp?.nickname ?? '상대'}님 손에서 터졌어요!`}</p>
        <p className="text-ink-soft font-bold">{loserMe ? '상대 +1' : '내가 +1'} · 라운드 {state.round + 1}/{BOMB_ROUNDS}</p>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2">
      <p className="text-center text-[13px] font-bold text-ink-mute">라운드 {state.round + 1} / {BOMB_ROUNDS} · 언제 터질지 몰라요!</p>
      <div className={`flex items-center gap-2 justify-center transition-opacity ${mine ? 'opacity-40' : ''}`}>
        {opp && <Avatar id={opp.avatar} size={40} />}<span className="font-bold text-[14px]">{opp?.nickname}</span>
      </div>
      <div ref={area} className="relative flex-1 min-h-0">
        <div className="absolute left-1/2 -translate-x-1/2 transition-all duration-500 ease-out" style={{ top: mine ? Math.max(0, box.h - bs) : 0, width: bs, height: bs }}>
          <BombArt shake={tension} className="w-full h-full" />
        </div>
      </div>
      <div className={`flex items-center gap-2 justify-center ${mine ? '' : 'opacity-40'}`}>
        {me && <Avatar id={me.avatar} size={40} />}<span className="font-bold text-[14px]">나</span>
      </div>
      {mine ? (
        <div className={`rounded-3xl bg-white shadow-card p-4 animate-pop ${locked ? 'animate-shake' : ''}`} key={state.taskSeq}>
          <p className="text-center font-bold text-ink-soft text-[14px]">폭탄이 곧 터져요! 정답을 골라서 넘겨요</p>
          <p className="text-center font-round text-[34px] my-0.5">{state.task.text} = ?</p>
          <div className="grid grid-cols-3 gap-2">
            {state.task.opts.map((o) => (
              <button key={o} disabled={locked} onClick={() => act({ choice: o })} className="h-14 rounded-2xl bg-peach-100 text-[24px] font-extrabold active:scale-95 transition disabled:opacity-40">{o}</button>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-3xl bg-white/70 p-4 text-center">
          <p className="font-round text-[22px]">휴~ 지금은 {opp?.nickname ?? '상대'}님 차례</p>
          <p className="text-ink-soft text-[14px] font-semibold">폭탄이 넘어오면 빨리 문제를 풀어서 넘겨요!</p>
        </div>
      )}
      <style>{'@keyframes bombShake{0%,100%{transform:rotate(0)}25%{transform:rotate(-6deg)}75%{transform:rotate(6deg)}}'}</style>
    </div>
  )
}
