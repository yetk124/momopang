import { useEffect, useRef, useState } from 'react'
import { Avatar } from '../components/Avatar'
import { GameIcon, IcBot, IcNext, IcUsers } from '../components/Icons'
import { Button, Hero, Sheet } from '../components/ui'
import { GAMES, type GameMeta } from '../games/registry'
import { normalizeCode } from '../lib/rng'
import { supabaseConfigured } from '../net/transports'
import { defaultMode, useStore } from '../store'
import { analyticsAvailable } from '../lib/analytics'
import { useSettings } from '../lib/settings'
import { ProfileForm } from './Onboarding'
import WORDMARK_IMG from '../assets/wordmark.webp'
import { sfx } from '../lib/sfx'

export function GameRules({ g }: { g: GameMeta }) {
  return (
    <div className="rounded-3xl p-4" style={{ background: g.tint }}>
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-white/80 grid place-items-center"><GameIcon id={g.id} className="w-10 h-10" /></div>
        <div className="flex-1">
          <div className="flex items-center gap-2"><h3 className="text-[19px] font-extrabold">{g.name}</h3><span className="text-[12px] font-bold text-ink-soft bg-white/70 rounded-full px-2 py-0.5">{g.kind}</span></div>
          <p className="text-[14px] text-ink-soft">{g.tagline} · {g.time}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 text-[14px]">
        <ul className="space-y-1">{g.rules.map((r, i) => <li key={i} className="flex gap-2"><span className="font-extrabold text-lav-500">{i + 1}</span>{r}</li>)}</ul>
        <div className="flex flex-wrap gap-1.5">{g.scoring.map((s) => <span key={s} className="bg-white/80 rounded-full px-2.5 py-1 text-[13px] font-semibold">{s}</span>)}</div>
      </div>
    </div>
  )
}

export function Home() {
  const { profile, createRoom, joinRoom, busy, error, setError } = useStore()
  const [joinOpen, setJoinOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [info, setInfo] = useState<GameMeta | null>(null)
  const [code, setCode] = useState('')
  const consent = useSettings((s) => s.analytics)
  // 메인 버튼이 화면 밖으로 나가면 아래에 고정 버튼 표시
  const ctaRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const [stickyCta, setStickyCta] = useState(false)
  useEffect(() => {
    const el = ctaRef.current; if (!el || typeof IntersectionObserver === 'undefined') return
    let ctaOut = false, atEnd = false
    const upd = () => setStickyCta(ctaOut && !atEnd)
    const io = new IntersectionObserver(([e]) => { ctaOut = !e.isIntersecting && e.boundingClientRect.top < 0; upd() }, { threshold: 0 })
    io.observe(el)
    // 목록 끝까지 내리면 고정 버튼 숨김 (마지막 카드를 가리지 않게)
    const io2 = endRef.current ? new IntersectionObserver(([e]) => { atEnd = e.isIntersecting; upd() }, { threshold: 0 }) : null
    if (endRef.current) io2?.observe(endRef.current)
    return () => { io.disconnect(); io2?.disconnect() }
  }, [])
  const setSettings = useSettings((s) => s.set)

  return (
    <div className="flex-1 flex flex-col pb-4">
      <header className="flex items-center justify-between px-5 pt-4" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <span />
        <button onClick={() => setProfileOpen(true)} className="flex items-center gap-2 bg-white/80 rounded-full pl-1 pr-3 py-1 shadow-soft">
          {profile && <Avatar id={profile.avatar} size={32} />}<span className="text-[14px] font-bold">{profile?.nickname}</span>
        </button>
      </header>

      <section className="px-5 pt-2 text-center">
        <img src={WORDMARK_IMG} alt="모모팡" className="mx-auto h-9 w-auto mb-1.5 select-none" draggable={false} />
        <h1 className="font-round text-[38px] leading-none text-ink">함께놀자!</h1>
        <p className="mt-2 text-ink-soft font-semibold text-[15px]">전화하면서, 게임도 하고 더 가까워져요 💜</p>
        <div className="mx-auto mt-2 mb-1 w-full" style={{ maxWidth: 'min(320px, calc(24dvh * 1.9))' }}><Hero className="w-full h-auto" /></div>
        <div className="mt-2 flex flex-col gap-2">
          <div ref={ctaRef}>
            <Button data-track="cta_hero" onClick={() => createRoom(defaultMode())} disabled={busy} className="w-full text-[17px] min-h-[58px]">
              {busy ? '연결 중…' : <>친구와 게임하기 <IcNext className="w-5 h-5" /></>}
            </Button>
          </div>
          <p className="text-[12px] text-ink-mute -mt-0.5">가입 없이 무료 · 방 만들고 링크 보내면 끝</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" data-track="cta_join_code" className="min-h-[44px] text-[14px]" onClick={() => { setError(null); setJoinOpen(true) }}><IcUsers className="w-4 h-4" />코드로 참여</Button>
            <Button variant="secondary" data-track="cta_bot" className="min-h-[44px] text-[14px]" onClick={() => createRoom('bot')} disabled={busy}><IcBot className="w-4 h-4" />봇이랑 연습</Button>
          </div>
          {!supabaseConfigured && <p className="text-[11px] text-ink-mute">데모 모드 · 같은 브라우저의 다른 탭과 연결돼요</p>}
          {error && !joinOpen && <p role="alert" className="text-[14px] font-semibold text-[#C9433A]">{error}</p>}
        </div>
      </section>

      {stickyCta && (
        <div className="fixed inset-x-0 z-30 flex justify-center px-4 pointer-events-none" style={{ bottom: 'calc(72px + env(safe-area-inset-bottom))' }}>
          <Button data-track="cta_sticky" onClick={() => createRoom(defaultMode())} disabled={busy} className="w-full max-w-[408px] pointer-events-auto animate-fadeup shadow-[0_10px_30px_-8px_rgba(143,123,234,.7)]">
            친구와 게임하기 <IcNext className="w-5 h-5" />
          </Button>
        </div>
      )}

      <section className="px-5 mt-6">
        <div className="flex items-end justify-between mb-2.5">
          <h2 className="text-[17px] font-extrabold">게임 목록</h2>
          <span className="text-[13px] text-ink-mute">탭하면 규칙을 볼 수 있어요</span>
        </div>
        <div className="flex flex-wrap justify-center gap-2.5">
          {GAMES.map((g) => (
            <button key={g.id} onClick={() => setInfo(g)} className="press w-[calc((100%-1.25rem)/3)] rounded-2xl py-3 px-2 flex flex-col items-center justify-center gap-1 shadow-soft" onClickCapture={() => sfx.tap()} style={{ background: g.tint }}>
              <GameIcon id={g.id} className="w-10 h-10" />
              <span className="text-[14px] font-bold">{g.name}</span>
              <span className="text-[11px] font-semibold text-ink-soft -mt-1">{g.kind}</span>
            </button>
          ))}
        </div>
        <div ref={endRef} className="h-1" />
      </section>

      {analyticsAvailable && consent === null && !stickyCta && (
        <div className="fixed bottom-20 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
          <div className="w-full max-w-[408px] rounded-3xl bg-white shadow-card p-4 pointer-events-auto animate-fadeup" role="dialog" aria-label="사용 통계 수집 안내">
            <p className="font-extrabold text-[15px]">더 좋은 앱을 위해 사용 통계를 모아요</p>
            <p className="text-[13px] text-ink-soft mt-1">어떤 화면에 머물고 어떤 버튼을 누르는지 <b>익명 통계</b>(Google Analytics)로 확인해요. 닉네임 같은 개인정보는 보내지 않고, 원하지 않으면 지금 또는 설정에서 끌 수 있어요.</p>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Button variant="secondary" className="min-h-[44px] text-[15px]" data-track="ga_optout" onClick={() => setSettings({ analytics: 'denied' })}>보내지 않기</Button>
              <Button className="min-h-[44px] text-[15px]" onClick={() => setSettings({ analytics: 'granted' })}>확인</Button>
            </div>
          </div>
        </div>
      )}

      <Sheet open={joinOpen} onClose={() => setJoinOpen(false)} title="방 코드로 참여">
        <form onSubmit={(e) => { e.preventDefault(); if (code.length === 6) void joinRoom(code).then(() => { if (!useStore.getState().error) setJoinOpen(false) }) }}>
          <input
            value={code} onChange={(e) => setCode(normalizeCode(e.target.value))} inputMode="text" autoCapitalize="characters" autoComplete="off" autoFocus
            placeholder="A7K3P9" aria-label="방 코드 6자리"
            className="w-full h-16 rounded-2xl bg-white border border-lav-100 text-center text-[28px] font-extrabold tracking-[.3em] uppercase outline-none focus:border-lav-400 focus:ring-4 focus:ring-lav-100"
          />
          {error && <p role="alert" className="mt-2 text-[14px] font-semibold text-[#C9433A] text-center">{error}</p>}
          <Button type="submit" className="w-full mt-4" disabled={code.length !== 6 || busy}>{busy ? '확인 중…' : '입장하기'}</Button>
        </form>
      </Sheet>

      <Sheet open={!!info} onClose={() => setInfo(null)}>
        {info && (
          <>
            <GameRules g={info} />
            <div className="grid grid-cols-2 gap-2.5 mt-4">
              <Button variant="secondary" onClick={() => { const g = info.id; setInfo(null); void createRoom('bot', g) }}><IcBot className="w-5 h-5" />봇이랑</Button>
              <Button onClick={() => { const g = info.id; setInfo(null); void createRoom(defaultMode(), g) }}>친구랑 하기</Button>
            </div>
          </>
        )}
      </Sheet>

      <Sheet open={profileOpen} onClose={() => setProfileOpen(false)} title="프로필">
        <ProfileForm submitLabel="저장" onDone={() => setProfileOpen(false)} />
      </Sheet>
    </div>
  )
}

