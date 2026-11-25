import { useEffect, useRef, useState } from 'react'
import { sfx } from '../../lib/sfx'
import { checkWord } from '../../lib/dict'
import { useStore } from '../../store'
import { filterWordInput, filterWordTyping } from '../../net/validate'
import type { GameProps } from '../rush/RushGame'
import { TURN_MS, allowedStarts, type WordState } from './engine'

export function WordGame({ state, t, meId }: GameProps<WordState>) {
  const act = useStore((s) => s.act)
  const players = useStore((s) => s.room?.players ?? [])
  const oppName = players.find((p) => p.id !== meId)?.nickname ?? '상대'
  const [text, setText] = useState('')
  const list = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const myTurn = state.turn === meId
  const left = Math.max(0, TURN_MS - (t - state.turnStart))
  const starts = allowedStarts(state)
  // 사전 검사 중 / 사전에 없을 때 내 화면에만 띄우는 안내
  const [checking, setChecking] = useState(false)
  const [local, setLocal] = useState<{ text: string; at: number } | null>(null)
  const submit = async () => {
    const w = filterWordInput(text)
    if (!w || !myTurn || checking) return
    // 글자 수·시작 글자·중복은 게임 규칙에서 안내하니까 사전 검사 없이 바로 보냄
    if (!/^[가-힣]{2,8}$/.test(w) || !starts.includes(w[0]) || state.used.includes(w)) { act({ word: w }); setText(''); return }
    setChecking(true)
    const ok = await checkWord(w)
    setChecking(false)
    if (ok === false) { setLocal({ text: `'${w}'은(는) 사전에 없는 단어예요`, at: Date.now() }); sfx.error(); return }
    act({ word: w }); setText(''); setLocal(null)
  }
  useEffect(() => { if (!local) return; const id = setTimeout(() => setLocal(null), 2200); return () => clearTimeout(id) }, [local])
  useEffect(() => { setLocal(null) }, [state.turn])

  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' }) }, [state.chain.length])
  const lastLen = useRef(state.chain.length)
  useEffect(() => { if (state.chain.length !== lastLen.current) { lastLen.current = state.chain.length; sfx.pop() } }, [state.chain.length])
  useEffect(() => { if (myTurn) input.current?.focus({ preventScroll: true }) }, [myTurn])
  const fl0 = state.flash && t - state.flash.t < 2200 && (!state.flash.bad || state.flash.pid === meId) ? state.flash : null
  const fl = local ? { pid: meId, text: local.text, t: 0, bad: true } : fl0
  const flKey = useRef(state.flash?.t)
  useEffect(() => { if (state.flash && state.flash.t !== flKey.current) { flKey.current = state.flash.t; if (state.flash.pid === meId) sfx.error() } }, [state.flash, meId])

  return (
    <div className="flex-1 flex flex-col gap-2 min-h-0">
      <div ref={list} className="flex-1 min-h-0 overflow-y-auto rounded-3xl bg-white/60 p-3 flex flex-col gap-2">
        {state.chain.map((c, i) => c.start ? (
          <div key={i} className="self-center my-1 rounded-full bg-butter-100 text-ink-soft text-[13px] font-bold px-3 py-1">{i === 0 ? '시작 단어' : '새 출발'} · <b className="text-ink">{c.word}</b></div>
        ) : (
          <div key={i} className={`flex items-end gap-1.5 animate-pop ${c.pid === meId ? 'self-end flex-row-reverse' : 'self-start'}`}>
            <div className={`max-w-[220px] rounded-2xl px-4 py-2 text-[18px] font-extrabold ${c.pid === meId ? 'bg-lav-200 rounded-br-md' : 'bg-peach-200 rounded-bl-md'}`}>{c.word}</div>
            {c.pts !== undefined && (
              <div className={`flex flex-col gap-0.5 text-[11px] font-extrabold leading-none ${c.pid === meId ? 'items-end' : 'items-start'}`}>
                {!!c.speed && <span className="rounded-full bg-butter-300 px-1.5 py-0.5">{c.speed === 2 ? '번개' : '빠름'} +{c.speed}</span>}
                {!!c.len && <span className="rounded-full bg-mint-300 px-1.5 py-0.5">{c.word.length}글자 +{c.len}</span>}
                <span className="text-ink-soft text-[13px]">+{c.pts}</span>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="h-7 flex items-center justify-center">
        {fl ? <span className={`rounded-full px-3 py-1 text-[13px] font-bold animate-pop ${fl.bad ? 'bg-[#FFE4E1] text-[#C9433A]' : 'bg-butter-100 text-ink'}`}>{fl.bad ? fl.text : `${fl.pid === meId ? '내가' : oppName + '님이'} 못 이었어요! 상대 +2`}</span>
          : <span className="text-[14px] font-bold text-ink-soft">{myTurn ? <>내 차례 · <b className="text-lav-500 text-[17px]">{starts.join(' / ')}</b>(으)로 시작{left > 7000 ? <span className="ml-1.5 rounded-full bg-butter-300 text-ink px-2 py-0.5 text-[12px]">번개 +2</span> : left > 5000 ? <span className="ml-1.5 rounded-full bg-mint-300 text-ink px-2 py-0.5 text-[12px]">빠름 +1</span> : null}</> : `${oppName}님 차례…`}</span>}
      </div>
      <div className="h-1.5 rounded-full bg-white overflow-hidden"><div className={`h-full transition-all duration-100 ${left > 7000 ? 'bg-butter-400' : left > 5000 ? 'bg-mint-500' : left < 3000 ? 'bg-apple' : 'bg-lav-300'}`} style={{ width: `${(left / TURN_MS) * 100}%` }} /></div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void submit() }}>
        <input ref={input} value={text} onChange={(e) => setText(filterWordTyping(e.target.value))} disabled={!myTurn} maxLength={8} spellCheck={false} enterKeyHint="send" autoComplete="off" placeholder={myTurn ? `${starts[0]}…` : '상대 차례예요'} aria-busy={checking}
          className="flex-1 h-12 rounded-2xl bg-white border border-lav-100 px-4 text-[17px] font-bold outline-none focus:border-lav-400 disabled:bg-white/60" />
        <button disabled={!myTurn || !text.trim() || checking} className="h-12 w-12 rounded-full bg-lav-400 text-white grid place-items-center disabled:bg-lav-200" aria-label={checking ? '사전 확인 중' : '보내기'}>
          {checking ? <span className="w-5 h-5 rounded-full border-[2.6px] border-white/40 border-t-white animate-spin" /> : <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>}
        </button>
      </form>
    </div>
  )
}
