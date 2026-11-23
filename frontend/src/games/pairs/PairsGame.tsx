import { useEffect, useRef } from 'react'
import { CARD_BACK, CARD_FACES } from './cards'
import { sfx } from '../../lib/sfx'
import { useStore } from '../../store'
import { Fit } from '../../components/ui'
import type { GameProps } from '../rush/RushGame'
import { PAIRS, TURN_MS, type PairsState } from './engine'

export function PairsGame({ state, t, meId, oppId }: GameProps<PairsState>) {
  const act = useStore((s) => s.act)
  const players = useStore((s) => s.room?.players ?? [])
  const oppName = players.find((p) => p.id === oppId)?.nickname ?? '상대'
  const myTurn = state.turn === meId
  const waiting = state.open.length === 2
  const left = Math.max(0, TURN_MS - (t - state.turnStart))
  const found = Object.keys(state.owner).length / 2

  const lastT = useRef(state.last?.t)
  useEffect(() => { const l = state.last; if (l && l.t !== lastT.current) { lastT.current = l.t; if (l.ok) sfx.pop(); else sfx.error() } }, [state.last])
  const turnRef = useRef(state.turn)
  useEffect(() => { if (state.turn !== turnRef.current) { turnRef.current = state.turn; if (state.turn === meId) sfx.count() } }, [state.turn, meId])

  const status = waiting
    ? (state.last && !state.last.ok ? '아쉽! 차례가 넘어가요' : '…')
    : myTurn ? (state.streak > 0 ? `연속 ${state.streak}번째! 한 번 더` : '내 차례! 두 장을 뒤집어요') : `${oppName}님 차례 · 잘 봐두세요`

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2">
      <div className="flex items-center justify-between px-1 text-[13px] font-bold">
        <span className="text-ink-mute">남은 짝 <b className="text-ink tabular-nums">{PAIRS - found}</b></span>
        <span className="text-ink-mute">시도 · 나 {state.p[meId]?.attempts ?? 0} / 상대 {state.p[oppId]?.attempts ?? 0}</span>
      </div>
      <div className={`rounded-2xl px-4 py-2.5 text-center font-extrabold text-[15px] transition ${myTurn && !waiting ? 'bg-lav-400 text-white shadow-pop' : 'bg-peach-100 text-ink'}`}>
        {status}
      </div>
      <div className="h-1.5 rounded-full bg-white overflow-hidden"><div className={`h-full transition-all duration-100 ${myTurn ? 'bg-lav-400' : 'bg-peach-400'}`} style={{ width: waiting ? '0%' : `${(left / TURN_MS) * 100}%` }} /></div>
      <Fit aspect={0.62} max={320}>
        <div className="grid grid-cols-4 gap-2 w-full h-full content-center">
          {state.board.map((face, i) => {
            const own = state.owner[i]
            const isOpen = state.open.includes(i)
            const up = !!own || isOpen
            const wrong = isOpen && waiting && !own
                        return (
              <button key={i} disabled={!myTurn || waiting || up} onPointerDown={(e) => { e.preventDefault(); if (myTurn && !waiting && !up) { sfx.flip(); act({ cell: i }) } }}
                className="relative aspect-[3/4] transition active:scale-95 disabled:active:scale-100" aria-label={up ? `카드 ${i + 1} 공개됨` : `카드 ${i + 1}`}>
                <div key={up ? 'f' : 'b'} className="absolute inset-0" style={{ animation: 'pairFlip .3s ease-out both' }}>
                  <img src={up ? CARD_FACES[state.faces[face]] : CARD_BACK} alt="" draggable={false} className={`w-full h-full object-contain select-none pointer-events-none drop-shadow-[0_3px_4px_rgba(120,90,160,.25)] ${!up && !myTurn ? 'opacity-85' : ''}`} />
                  {up && (own || wrong || isOpen) && <span className={`absolute inset-0 rounded-[14px] pointer-events-none ${own ? (own === meId ? 'ring-[3px] ring-lav-500' : 'ring-[3px] ring-peach-400') : wrong ? 'ring-[3px] ring-[#E5483D]' : 'ring-[3px] ring-butter-400'}`} />}
                  {own && <span className={`absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full grid place-items-center text-white text-[13px] font-extrabold shadow ${own === meId ? 'bg-lav-500' : 'bg-peach-400'}`}>✓</span>}
                </div>
              </button>
            )
          })}
        </div>
      </Fit>
      <p className="mx-auto rounded-2xl bg-lav-50 text-lav-600 font-bold px-4 py-2.5 text-[13px] text-center">짝 +10 · 연속으로 맞히면 +5씩 더 · 틀리면 상대 차례</p>
      <style>{'@keyframes pairFlip{0%{transform:perspective(500px) rotateY(90deg)}100%{transform:perspective(500px) rotateY(0)}}'}</style>
    </div>
  )
}
