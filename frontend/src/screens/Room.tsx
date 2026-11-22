import { useState, type ReactNode } from 'react'
import { Avatar } from '../components/Avatar'
import trophyWin from '../assets/trophy-crown.webp'
import trophyDraw from '../assets/trophy-moon.webp'
import trophyLose from '../assets/trophy-bear.webp'
import { GameIcon, IcClose, IcCopy, IcHeart, IcLink } from '../components/Icons'
import { Button, Confetti, ConfirmSheet, Pill, TimerPill, TopBar, useNow } from '../components/ui'
import { AppleGame } from '../games/apple/AppleGame'
import { BlockGame } from '../games/block/BlockGame'
import { DrawGame } from '../games/draw/DrawGame'
import { ROUND_MS } from '../games/draw/engine'
import { HalliGame } from '../games/halli/HalliGame'
import { ENGINES, GAMES, META } from '../games/registry'
import { RushGame } from '../games/rush/RushGame'
import { SpotGame } from '../games/spot/SpotGame'
import { WordGame } from '../games/word/WordGame'
import { QuizGame } from '../games/quiz/QuizGame'
import { BombGame } from '../games/bomb/BombGame'
import { MemoryGame } from '../games/memory/MemoryGame'
import { PairsGame } from '../games/pairs/PairsGame'
import { MergeGame } from '../games/merge/MergeGame'
import { sfx } from '../lib/sfx'
import type { PlayerSlot, RoomState } from '../net/protocol'
import { hostNow, inviteLink, selectGameView, useStore } from '../store'

export function Room() {
  const room = useStore((s) => s.room)
  const busy = useStore((s) => s.busy)
  if (!room) return <div className="flex-1 grid place-items-center text-ink-soft font-semibold">{busy ? '방에 연결하는 중…' : '방 정보를 불러오는 중…'}</div>
  return (
    <>
      {(room.phase === 'lobby' || room.phase === 'countdown') && <Lobby room={room} />}
      {room.phase === 'playing' && <GameScreen room={room} />}
      {room.phase === 'result' && <Result room={room} />}
      {room.phase === 'countdown' && <Countdown room={room} />}
      <Away room={room} />
    </>
  )
}

function usePlayers(room: RoomState) {
  const meId = useStore((s) => s.me.id)
  const me = room.players.find((p) => p.id === meId)
  const opp = room.players.find((p) => p.id !== meId)
  return { meId, me, opp }
}

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); useStore.getState().showToast('복사했어요!') }
  catch { useStore.getState().showToast(`복사가 안 되면 직접 전해주세요: ${text}`) }
}
async function share(code: string) {
  const url = inviteLink(code)
  const text = `모모팡에서 같이 게임하자! 방 코드 ${code}`
  try { if (navigator.share) { await navigator.share({ title: '모모팡', text, url }); return } } catch { /* 취소/미지원 → 복사 */ }
  await copy(`${text}\n${url}`)
}

function Lobby({ room }: { room: RoomState }) {
  const { me, opp } = usePlayers(room)
  const { intent, leaveRoom, mode } = useStore()
  const [leaving, setLeaving] = useState(false)
  const g = room.game ? META[room.game] : null
  const canReady = !!g && !!opp && opp.connected
  const status = !opp ? '친구를 기다리는 중…' : !opp.connected ? `${opp.nickname}님 연결이 불안정해요` : !g ? '어떤 게임을 할까요?' : opp.ready && me?.ready ? '곧 시작해요!' : opp.ready ? `${opp.nickname}님은 준비 완료!` : '상대방이 준비 중이에요'
  const modeLabel = mode === 'bot' ? '봇 연습' : mode === 'local' ? '로컬 데모' : '온라인'

  return (
    <div className="h-[100svh] flex flex-col overflow-hidden">
      <TopBar title="게임 방" onBack={() => setLeaving(true)} right={<Pill className="bg-white/80 text-ink-soft !text-[12px] !px-2.5">{modeLabel}</Pill>} />
      <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="px-4 min-h-full flex flex-col justify-evenly gap-2 py-1">
        <section className="flex items-center justify-center gap-3">
          <PlayerBubble p={me} label="나" />
          <IcHeart className="w-6 h-6 animate-floaty shrink-0" />
          {opp ? <PlayerBubble p={opp} /> : <EmptySlot />}
        </section>
        <div className="flex justify-center -mt-0.5"><Pill className="bg-lav-100 text-lav-600 !py-1 !text-[13px]">{status}</Pill></div>

        {mode !== 'bot' && (
          <section className="rounded-2xl bg-white shadow-soft px-3 py-2 flex items-center gap-2">
            <span className="text-[12px] font-bold text-ink-mute shrink-0">방 코드</span>
            <span className="flex-1 text-[22px] font-extrabold tracking-[.16em] tabular-nums">{room.code}</span>
            <button onClick={() => copy(room.code)} aria-label="방 코드 복사" className="w-10 h-10 rounded-xl bg-lav-50 grid place-items-center text-lav-600"><IcCopy className="w-5 h-5" /></button>
            <button onClick={() => share(room.code)} className="h-10 px-3 rounded-xl bg-lav-400 text-white font-bold text-[14px] flex items-center gap-1"><IcLink className="w-4 h-4" />초대</button>
          </section>
        )}

        <section>
          <div className="flex items-baseline justify-between mb-1.5">
            <h2 className="text-[15px] font-extrabold">게임 선택</h2>
            <span className="text-[11px] text-ink-mute">바꾸면 둘 다 준비가 풀려요</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {GAMES.map((x) => {
              const on = room.game === x.id
              return (
                <button key={x.id} onClick={() => { sfx.tap(); intent({ type: 'select', game: x.id }) }} aria-pressed={on}
                  style={{ background: x.tint, paddingBlock: 'clamp(6px, 1.4svh, 14px)' }} className={`press rounded-xl px-0.5 flex flex-col items-center justify-center gap-1 ${on ? 'ring-[3px] ring-lav-400 shadow-card' : 'opacity-80'}`}>
                  <GameIcon id={x.id} className="w-[clamp(28px,4.6svh,42px)] h-[clamp(28px,4.6svh,42px)]" />
                  <span className="text-[clamp(11px,1.5svh,13px)] font-bold leading-tight whitespace-nowrap">{x.name}</span>
                </button>
              )
            })}
          </div>
        </section>

        {g ? (
          <section className="rounded-2xl p-3 shrink-0" style={{ background: g.tint }}>
            <div className="flex items-center gap-2">
              <GameIcon id={g.id} className="w-8 h-8 shrink-0" />
              <p className="font-extrabold text-[16px]">{g.name}</p>
              <span className="text-[11px] font-bold text-ink-soft bg-white/70 rounded-full px-2 py-0.5">{g.kind}</span>
              <span className="ml-auto text-[12px] font-bold text-ink-soft">{g.time}</span>
            </div>
            <ul className="mt-1.5 space-y-0.5 text-[13px] leading-snug">{g.rules.map((r, i) => <li key={i} className="flex gap-1.5"><b className="text-lav-500">{i + 1}</b><span className="text-ink-soft">{r}</span></li>)}</ul>
            <div className="mt-1.5 flex flex-wrap gap-1">{g.scoring.map((x) => <span key={x} className="bg-white/80 rounded-full px-2 py-0.5 text-[11px] font-semibold">{x}</span>)}</div>
          </section>
        ) : <p className="text-center text-[13px] text-ink-mute py-3">게임을 고르면 규칙이 여기에 보여요</p>}
      </div>
      </div>

      <div className="px-4 pt-2" style={{ paddingBottom: 'max(.75rem, env(safe-area-inset-bottom))' }}>
        <Button className="w-full" variant={me?.ready ? 'secondary' : 'primary'} disabled={!canReady} onClick={() => { sfx.tap(); intent({ type: 'ready', v: !me?.ready }) }}>
          {!opp ? '친구가 들어오면 준비할 수 있어요' : !g ? '게임을 먼저 골라주세요' : me?.ready ? '준비 취소' : '준비 완료'}
        </Button>
        {canReady && <p className="text-center text-[11px] text-ink-mute mt-1">둘 다 준비하면 3초 뒤에 시작해요</p>}
      </div>
      <ConfirmSheet open={leaving} title="방에서 나갈까요?" desc={useStore.getState().isHost ? '방장이 나가면 방이 닫혀요.' : undefined} confirm="나가기" onClose={() => setLeaving(false)} onConfirm={() => leaveRoom()} />
    </div>
  )
}

const AV = 'clamp(52px, 11svh, 96px)' as unknown as number
function PlayerBubble({ p, label }: { p?: PlayerSlot; label?: string }) {
  if (!p) return null
  return (
    <div className="flex flex-col items-center gap-1 w-24">
      <div className="relative">
        <Avatar id={p.avatar} size={AV} ring={p.ready ? '#6CBF5B' : '#fff'} dim={!p.connected} />
        {p.ready && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-mint-500 text-white text-[11px] font-extrabold rounded-full px-2 py-0.5 animate-pop">READY</span>}
      </div>
      <span className="font-bold text-[14px] truncate max-w-full">{p.nickname}{label && <span className="text-ink-mute font-semibold"> ({label})</span>}</span>
    </div>
  )
}
function EmptySlot() {
  return (
    <div className="flex flex-col items-center gap-1 w-24">
      <div style={{ width: AV, height: AV }} className="rounded-full border-[3px] border-dashed border-lav-300 grid place-items-center text-lav-400 text-2xl font-round animate-pulse">?</div>
      <span className="font-semibold text-[14px] text-ink-mute">기다리는 중</span>
    </div>
  )
}

function Countdown({ room }: { room: RoomState }) {
  useNow(100)
  const left = Math.max(0, (room.countdownEnd ?? 0) - hostNow())
  const n = Math.ceil(left / 1000)
  const g = room.game ? META[room.game] : null
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/25 backdrop-blur-[3px]">
      <div className="w-[min(86vw,340px)] rounded-4xl bg-white/95 shadow-card p-7 text-center animate-pop">
        {g && <GameIcon id={g.id} className="w-14 h-14 mx-auto" />}
        <p className="mt-2 text-[22px] font-extrabold">{g?.name}</p>
        <p className="text-ink-soft font-semibold">게임이 곧 시작돼요!</p>
        <p key={n} className="font-round text-[72px] leading-none text-lav-500 mt-3 animate-pop">{n > 0 ? n : 'GO!'}</p>
        <CountSound n={n} />
      </div>
    </div>
  )
}
let lastCount = -1
function CountSound({ n }: { n: number }) {
  if (n !== lastCount) { lastCount = n; setTimeout(() => (n > 0 ? sfx.count() : sfx.go()), 0) }
  return null
}

function Away({ room }: { room: RoomState }) {
  useNow(500)
  const { hostAwaySince, isHost, me } = useStore()
  const pause = room.pause
  const guestWaiting = !isHost && hostAwaySince && (room.phase === 'playing' || room.phase === 'lobby')
  if (!pause && !guestWaiting) return null
  const since = pause ? pause.since : hostAwaySince!
  const left = Math.max(0, 30 - Math.floor(((pause ? hostNow() : Date.now()) - since) / 1000))
  const who = room.players.find((p) => p.id === (pause ? pause.who : room.hostId))
  const iAmAway = pause?.who === me.id
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/30 backdrop-blur-sm">
      <div className="w-[min(86vw,340px)] rounded-4xl bg-white p-7 text-center shadow-card">
        <div className="mx-auto w-14 h-14 rounded-full border-4 border-lav-200 border-t-lav-500 animate-spin" />
        <p className="mt-4 text-[19px] font-extrabold">{iAmAway ? '다시 연결했어요!' : `${who?.nickname ?? '상대'}님 연결이 끊겼어요`}</p>
        <p className="mt-1 text-ink-soft">{room.phase === 'playing' ? '게임을 잠시 멈췄어요. ' : ''}{left}초 안에 돌아오면 이어서 해요</p>
        <Button variant="secondary" className="w-full mt-5" onClick={() => useStore.getState().leaveRoom()}>방 나가기</Button>
      </div>
    </div>
  )
}

// ───────── 게임 화면 ─────────
function GameScreen({ room }: { room: RoomState }) {
  const now = useNow(100)
  const st = useStore()
  const view = selectGameView(st, now)
  const { meId, me, opp } = usePlayers(room)
  const [leaving, setLeaving] = useState(false)
  if (!view || !me) return null
  const scores = ENGINES[view.game].result(view.state).scores
  const eng = ENGINES[view.game]
  let remain: number | null = view.meta.durationMs - view.t
  if (view.game === 'draw') remain = view.state.phase === 'draw' ? ROUND_MS - (view.t - view.state.roundStart) : 0
  else if (eng.timer) remain = eng.timer(view.state, view.t)
  const props = { state: view.state, t: view.t, meId, oppId: opp?.id ?? '' }
  return (
    <div className="h-[100svh] overflow-hidden flex flex-col no-select">
      <div className="flex items-center justify-between px-3 pt-2" style={{ paddingTop: 'max(.5rem, env(safe-area-inset-top))' }}>
        <div className="w-11" />
        {remain === null ? <div className="h-9" /> : <TimerPill ms={remain} warn={view.game === 'word' || view.game === 'quiz' ? 3000 : 10_000} />}
        <button onClick={() => setLeaving(true)} aria-label="게임 나가기" className="w-11 h-11 grid place-items-center rounded-full text-ink-soft hover:bg-white"><IcClose className="w-6 h-6" /></button>
      </div>
      <div className="flex items-center justify-center gap-3 px-4 py-2">
        <ScoreSide p={me} score={scores[meId] ?? 0} />
        <span className="font-round text-ink-mute text-[18px]">VS</span>
        {opp && <ScoreSide p={opp} score={scores[opp.id] ?? 0} right />}
      </div>
      <div className="flex-1 flex flex-col px-4 pb-4 min-h-0" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        {view.game === 'rush' && <RushGame {...props} />}
        {view.game === 'halli' && <HalliGame {...props} />}
        {view.game === 'apple' && <AppleGame {...props} />}
        {view.game === 'block' && <BlockGame {...props} />}
        {view.game === 'draw' && <DrawGame {...props} />}
        {view.game === 'spot' && <SpotGame {...props} />}
        {view.game === 'word' && <WordGame {...props} />}
        {view.game === 'quiz' && <QuizGame {...props} />}
        {view.game === 'bomb' && <BombGame {...props} />}
        {view.game === 'memory' && <MemoryGame {...props} />}
        {view.game === 'pairs' && <PairsGame {...props} />}
        {view.game === 'merge' && <MergeGame {...props} />}
      </div>
      <ConfirmSheet open={leaving} title="게임을 그만둘까요?" desc="지금 나가면 상대방의 승리로 처리돼요." confirm="나가기" onClose={() => setLeaving(false)} onConfirm={() => st.leaveRoom()} />
    </div>
  )
}

function ScoreSide({ p, score, right }: { p: PlayerSlot; score: number; right?: boolean }) {
  return (
    <div className={`flex-1 flex items-center gap-2.5 bg-white/80 rounded-full p-1.5 shadow-soft ${right ? 'flex-row-reverse' : ''}`}>
      <Avatar id={p.avatar} size={40} dim={!p.connected} />
      <div className={`flex-1 ${right ? 'text-right' : ''}`}>
        <p className="text-[11px] font-bold text-ink-mute truncate leading-none">{p.nickname}</p>
        <p key={score} className="text-[22px] font-extrabold tabular-nums leading-tight animate-pop">{score}</p>
      </div>
    </div>
  )
}

// ───────── 결과 화면 ─────────
function Result({ room }: { room: RoomState }) {
  const { meId, opp } = usePlayers(room)
  const { intent, leaveRoom, me } = useStore()
  const r = room.result!
  const meta = META[r.game]
  const oppId = opp?.id ?? Object.keys(r.scores).find((k) => k !== meId) ?? ''
  const oppSlot = opp ?? null
  const win = r.winnerId === meId, draw = r.winnerId === null
  const title = draw ? '무승부!' : win ? `${me.nickname}님 승리!` : `${oppSlot?.nickname ?? '상대'}님 승리!`
  const reasonNote = r.endReason === 'left' || r.endReason === 'disconnect' ? (win ? '상대가 나가서 승리로 처리됐어요' : '연결이 끊겨 게임이 끝났어요') : null
  const labels = ENGINES[r.game].statLabels
  const rm = room.rematch
  const sec = Math.round(r.durationMs / 1000)

  return (
    <div className="relative flex-1 flex flex-col px-5 pb-6 overflow-hidden" style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))' }}>
      {win && <Confetti />}
      <div className="text-center mt-1">
        <Trophy kind={win ? 'win' : draw ? 'draw' : 'lose'} />
        <p className="text-[14px] font-bold text-ink-soft mt-2">{meta.name} 종료</p>
        <h1 className="font-round text-[30px] leading-tight">{title}{win && ' 🎉'}</h1>
        {reasonNote && <p className="text-[13px] text-ink-mute mt-1">{reasonNote}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <ScoreCard name={me.nickname} avatar={me.avatar} score={r.scores[meId] ?? 0} best={r.winnerId === meId} />
        <ScoreCard name={oppSlot?.nickname ?? '상대'} avatar={oppSlot?.avatar ?? 'tiger'} score={r.scores[oppId] ?? 0} best={r.winnerId === oppId} />
      </div>
      <div className="mt-3 rounded-3xl bg-white/80 px-4 py-3 shadow-soft">
        <table className="w-full text-[14px]">
          <thead><tr className="text-ink-mute text-[12px]"><th className="text-left font-bold pb-1">기록</th><th className="text-right font-bold">나</th><th className="text-right font-bold">상대</th></tr></thead>
          <tbody>
            {Object.entries(labels).map(([k, label]) => (
              <tr key={k} className="border-t border-lav-50"><td className="py-1 font-semibold">{label}</td><td className="text-right tabular-nums font-bold">{r.stats[meId]?.[k] ?? 0}</td><td className="text-right tabular-nums font-bold">{r.stats[oppId]?.[k] ?? 0}</td></tr>
            ))}
            <tr className="border-t border-lav-50"><td className="py-1 font-semibold">플레이 시간</td><td colSpan={2} className="text-right tabular-nums font-bold">{Math.floor(sec / 60)}분 {sec % 60}초</td></tr>
          </tbody>
        </table>
      </div>

      <div className="mt-auto pt-3 flex flex-col gap-2 relative">
        {rm && rm.from !== meId ? (
          <div className="rounded-3xl bg-lav-100 p-4 animate-pop">
            <p className="font-bold text-center">{oppSlot?.nickname}님이 한 판 더 하고 싶대요!</p>
            <div className="grid grid-cols-2 gap-2.5 mt-3">
              <Button variant="secondary" onClick={() => intent({ type: 'rematchDecline' })}>거절</Button>
              <Button onClick={() => intent({ type: 'rematchAccept' })}>수락</Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => intent({ type: 'rematch' })} disabled={!opp || rm?.from === meId}>
            {!opp ? '상대가 방을 나갔어요' : rm?.from === meId ? '상대의 수락을 기다리는 중…' : '다시하기'}
          </Button>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="secondary" onClick={() => intent({ type: 'toLobby' })}>다른 게임</Button>
          <Button variant="ghost" onClick={() => leaveRoom()}>홈으로 가기</Button>
        </div>
      </div>
    </div>
  )
}

function ScoreCard({ name, avatar, score, best }: { name: string; avatar: PlayerSlot['avatar']; score: number; best: boolean }) {
  return (
    <div className={`rounded-3xl p-3 flex flex-col items-center gap-0.5 ${best ? 'bg-white ring-[3px] ring-butter-400 shadow-card' : 'bg-white/70'}`}>
      <Avatar id={avatar} size={44} />
      <p className="text-[13px] font-bold text-ink-soft truncate max-w-full">{name}</p>
      <p className="text-[28px] font-extrabold tabular-nums leading-none">{score}</p>
    </div>
  )
}

function Trophy({ kind }: { kind: 'win' | 'lose' | 'draw' }): ReactNode {
  const src = kind === 'win' ? trophyWin : kind === 'draw' ? trophyDraw : trophyLose
  return <img src={src} alt="" className="w-24 h-24 mx-auto object-contain" style={{ animation: kind === 'win' ? 'boomIn .5s cubic-bezier(.2,1.6,.4,1) both' : 'fadeup .4s ease-out both' }} />
}
