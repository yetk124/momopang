import { useEffect, useRef, useState } from 'react'
import { Bell } from '../../components/Icons'
import { HALLI_CARDS } from './cards'
import { sfx } from '../../lib/sfx'
import { useStore } from '../../store'
import type { GameProps } from '../rush/RushGame'
import { AUTO_FLIP_MS, FRUITS, type Card, type HalliState } from './engine'

const CARD_H = 'min(25dvh, 200px)'
function FruitCard({ card, k, fresh }: { card: Card | null; k: number; fresh?: boolean }) {
  if (!card) return <div style={{ height: CARD_H }} className="mx-auto aspect-[3/4] rounded-2xl border-2 border-dashed border-white/80 grid place-items-center text-[13px] font-bold text-ink-mute">빈 자리</div>
  return (
    <div key={k} style={{ height: CARD_H, animation: 'cardFlip .45s ease-out both' }} className={`relative mx-auto aspect-[3/4] rounded-[14px] ${fresh ? 'ring-4 ring-butter-400' : ''}`} aria-label={`${FRUITS[card.f]} ${card.n}개`}>
      <img src={HALLI_CARDS[card.f][card.n - 1]} alt="" draggable={false} className="w-full h-full object-contain select-none pointer-events-none drop-shadow-[0_4px_6px_rgba(120,90,160,.25)]" />
    </div>
  )
}

export function HalliGame({ state, t, meId, oppId }: GameProps<HalliState>) {
  const act = useStore((s) => s.act)
  const players = useStore((s) => s.room?.players ?? [])
  const [ring, setRing] = useState(0)
  const name = (id: string) => (id === meId ? '내가' : `${players.find((p) => p.id === id)?.nickname ?? '상대'}님이`)
  const bellKey = useRef(state.bell?.t ?? -1)
  const [banner, setBanner] = useState<{ text: string; ok: boolean; id: number } | null>(null)
  useEffect(() => {
    const b = state.bell
    if (b && b.t !== bellKey.current) {
      bellKey.current = b.t
      if (b.ok) sfx.pop(); else sfx.error()
      setBanner({ id: b.t, ok: b.ok, text: b.ok ? `${name(b.pid)} 먼저 쳤어요! ${FRUITS[b.fruit]} 5개 +1` : `${name(b.pid)} 잘못 쳤어요 −1` })
      const id = b.t; setTimeout(() => setBanner((x) => (x?.id === id ? null : x)), 1400)
    }
  }, [state.bell]) // eslint-disable-line react-hooks/exhaustive-deps
  const deckLen = useRef<Record<string, number>>(Object.fromEntries(Object.entries(state.decks).map(([k, v]) => [k, v.length])))
  const [fresh, setFresh] = useState<string | null>(null)
  useEffect(() => {
    for (const [id, d] of Object.entries(state.decks)) {
      if (deckLen.current[id] !== d.length) { setFresh(id); const fid = id; setTimeout(() => setFresh((f) => (f === fid ? null : f)), 900) }
      deckLen.current[id] = d.length
    }
  }, [state.decks])
  const flips = useRef(state.flips)
  useEffect(() => { if (state.flips !== flips.current) { flips.current = state.flips; sfx.flip() } }, [state.flips])

  const myTurn = state.turn === meId && t >= state.pauseUntil && state.decks[meId]?.length > 0
  const autoPct = Math.min(100, ((t - state.lastFlip) / AUTO_FLIP_MS) * 100)
  const me = state.p[meId]
  const locked = t < (me?.lockUntil ?? 0)

  const side = (id: string, mine?: boolean) => (
    <div className={`flex-1 rounded-3xl p-3 flex flex-col gap-2 ${mine ? 'bg-peach-100' : 'bg-lav-100'} ${state.turn === id ? 'ring-[3px] ring-offset-2 ring-offset-cream ' + (mine ? 'ring-peach-400' : 'ring-lav-300') : ''}`}>
      <div className="flex items-center justify-between text-[13px] font-extrabold"><span>{mine ? '내 카드' : '상대방 카드'}</span><span className="tabular-nums text-ink-soft">덱 {state.decks[id]?.length ?? 0}</span></div>
      <FruitCard card={state.top[id]} k={state.decks[id]?.length ?? 0} fresh={fresh === id} />
    </div>
  )

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2">
      <div className="flex gap-3">{side(meId, true)}{side(oppId)}</div>
      <div className="h-9 flex items-center justify-center">
        {banner ? <div className={`rounded-full px-4 py-1.5 text-[14px] font-extrabold animate-pop ${banner.ok ? 'bg-mint-100 text-[#3E8A32]' : 'bg-[#FFE4E1] text-[#C9433A]'}`}>{banner.text}</div>
          : state.flips === 0 && t < state.pauseUntil ? <span className="text-ink-soft font-bold">준비…</span>
          : <div className="w-40 h-1.5 rounded-full bg-white overflow-hidden"><div className="h-full bg-lav-300" style={{ width: `${autoPct}%` }} /></div>}
      </div>
      <button
        onPointerDown={(e) => { e.preventDefault(); if (locked) return; setRing((x) => x + 1); sfx.bell(); act({ type: 'bell' }) }}
        style={{ height: 'min(19dvh, 160px)', width: 'min(19dvh, 160px)' }} className={`relative mx-auto grid place-items-center rounded-full active:scale-95 transition ${locked ? 'opacity-50' : ''}`} aria-label="종 치기">
        <span className="absolute inset-3 rounded-full bg-butter-100" />
        <Bell key={ring} className={`relative w-[82%] h-auto ${ring ? 'animate-ring' : ''}`} />
      </button>
      <p className="text-center font-bold text-[15px]">같은 과일이 <b className="text-apple">5개</b>가 되면 종을 눌러요!</p>
      <style>{'@keyframes cardFlip{0%{transform:perspective(600px) rotateY(90deg) scale(.9);opacity:.3}100%{transform:perspective(600px) rotateY(0) scale(1);opacity:1}}'}</style>
      <button
        disabled={!myTurn} onClick={() => act({ type: 'flip' })}
        className={`mt-auto h-14 rounded-2xl font-extrabold text-[16px] transition ${myTurn ? 'bg-peach-400 text-white shadow-pop animate-pop' : 'bg-white/70 text-ink-mute'}`}>
        {myTurn ? '내 차례! 카드 뒤집기' : state.decks[meId]?.length ? '상대 차례예요' : '내 카드를 다 썼어요'}
      </button>
    </div>
  )
}
