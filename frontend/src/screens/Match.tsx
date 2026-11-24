import { useEffect, useRef, useState } from 'react'
import { GameIcon, IcBot } from '../components/Icons'
import { Button, Sheet } from '../components/ui'
import { META } from '../games/registry'
import { track } from '../lib/analytics'
import { MATCH_GAMES, randomMatchGame, startMatch, type MatchGame } from '../lib/matchmaking'
import { sfx } from '../lib/sfx'
import { useStore } from '../store'

const BOT_OFFER_SEC = 20

/** 랜덤 매칭 시트: 게임 고르기 → 상대 찾는 중 → 매칭되면 방으로 */
export function MatchSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me, enterMatch, createRoom } = useStore()
  const [game, setGame] = useState<MatchGame>('any')
  const [phase, setPhase] = useState<'pick' | 'wait' | 'found'>('pick')
  const [sec, setSec] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const cancelRef = useRef<(() => void) | null>(null)
  const startedAt = useRef(0)

  const stop = () => { cancelRef.current?.(); cancelRef.current = null }
  useEffect(() => () => stop(), [])
  useEffect(() => { if (!open) { stop(); setPhase('pick'); setErr(null) } }, [open])
  useEffect(() => {
    if (phase !== 'wait') return
    const id = setInterval(() => setSec(Math.floor((Date.now() - startedAt.current) / 1000)), 250)
    return () => clearInterval(id)
  }, [phase])

  const begin = () => {
    stop(); setErr(null); setSec(0); startedAt.current = Date.now(); setPhase('wait')
    track('match_start', { game })
    cancelRef.current = startMatch(me.id, game, (r) => {
      cancelRef.current = null
      setPhase('found'); sfx.pop()
      setTimeout(() => { onClose(); void enterMatch(r) }, 700)
    }, (msg) => { cancelRef.current = null; setErr(msg); setPhase('pick') })
  }
  const cancel = () => { stop(); track('match_cancel', { game, wait_sec: sec }); setPhase('pick') }
  const playBot = () => {
    stop(); track('match_to_bot', { game, wait_sec: sec }); onClose()
    void createRoom('bot', game === 'any' ? randomMatchGame() : game)
  }
  const close = () => { if (phase === 'wait') track('match_cancel', { game, wait_sec: sec }); stop(); onClose() }

  return (
    <Sheet open={open} onClose={close} title={phase === 'pick' ? '랜덤 매칭' : undefined}>
      {phase === 'pick' && (
        <>
          <p className="text-[13px] text-ink-mute -mt-1 mb-3">지금 접속한 사람과 바로 한 판! 하고 싶은 게임을 골라요.</p>
          <div className="grid grid-cols-4 gap-2 max-h-[46vh] overflow-y-auto">
            <button onClick={() => setGame('any')} aria-pressed={game === 'any'}
              className={`press rounded-2xl py-2.5 flex flex-col items-center gap-1 border-2 ${game === 'any' ? 'border-lav-400 bg-lav-50' : 'border-transparent bg-white'}`}>
              <GameIcon id="any" className="w-10 h-10" /><span className="text-[12px] font-bold">아무거나</span>
            </button>
            {MATCH_GAMES.map((g) => (
              <button key={g.id} onClick={() => setGame(g.id)} aria-pressed={game === g.id}
                className={`press rounded-2xl py-2.5 flex flex-col items-center gap-1 border-2 ${game === g.id ? 'border-lav-400' : 'border-transparent'}`} style={{ background: g.tint }}>
                <GameIcon id={g.id} className="w-10 h-10" /><span className="text-[11.5px] font-bold whitespace-nowrap tracking-tight">{g.name}</span>
              </button>
            ))}
          </div>
          {err && <p role="alert" className="mt-2 text-[14px] font-semibold text-[#C9433A] text-center">{err}</p>}
          <Button data-track="match_begin" className="w-full mt-3" onClick={begin}>매칭 시작</Button>
        </>
      )}

      {phase !== 'pick' && (
        <div className="flex flex-col items-center text-center py-2">
          <div className="relative w-28 h-28 grid place-items-center">
            {phase === 'wait' && <span className="absolute inset-0 rounded-full border-4 border-lav-200 border-t-lav-500 animate-spin" />}
            <div className="w-20 h-20 rounded-full grid place-items-center" style={{ background: game === 'any' ? '#F1ECFF' : META[game].tint }}>
              <GameIcon id={game === 'any' ? 'any' : game} className="w-12 h-12" />
            </div>
          </div>
          {phase === 'found' ? (
            <p className="mt-3 font-round text-[24px] text-lav-500">상대를 찾았어요!</p>
          ) : (
            <>
              <p className="mt-3 font-extrabold text-[18px]">상대를 찾는 중…</p>
              <p className="text-[13px] text-ink-mute mt-0.5">{game === 'any' ? '아무 게임' : META[game].name} · <span className="tabular-nums">{sec}초</span></p>
              {sec >= BOT_OFFER_SEC && (
                <div className="mt-4 w-full rounded-2xl bg-butter-100/70 p-3">
                  <p className="text-[14px] font-bold">지금은 접속한 사람이 적어요</p>
                  <p className="text-[12px] text-ink-soft">말랑봇이랑 먼저 할래요? 계속 기다려도 돼요.</p>
                  <Button variant="secondary" className="w-full mt-2 min-h-[44px] text-[14px]" onClick={playBot}><IcBot className="w-4 h-4" />말랑봇이랑 하기</Button>
                </div>
              )}
              <Button variant="secondary" className="w-full mt-3" onClick={cancel}>취소</Button>
            </>
          )}
        </div>
      )}
    </Sheet>
  )
}
