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
import TROPHY_IMG from '../assets/trophy-crown.webp'
import { sfx } from '../lib/sfx'
import { MatchSheet } from './Match'

/** 게임 목록에서 누르면 나오는 짧은 소개 */
export function GameRules({ g }: { g: GameMeta }) {
  return (
    <div className="rounded-3xl p-4" style={{ background: g.tint }}>
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-white/80 grid place-items-center shrink-0"><GameIcon id={g.id} className="w-10 h-10" /></div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[19px] font-extrabold">{g.name}</h3>
          <div className="flex flex-wrap gap-1 mt-0.5">
            <span className="text-[12px] font-bold text-ink-soft bg-white/70 rounded-full px-2 py-0.5">{g.kind}</span>
            <span className="text-[12px] font-bold text-ink-soft bg-white/70 rounded-full px-2 py-0.5">⏱ {g.time}</span>
          </div>
        </div>
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-ink">{g.desc}</p>
    </div>
  )
}

const GUIDE_IMG = import.meta.glob('../assets/guide/*.webp', { eager: true, import: 'default' }) as Record<string, string>
const guideImg = (id: string, n: number) => GUIDE_IMG[`../assets/guide/${id}-${n}.webp`]

/** 실제 게임 화면을 폰 모양 틀에 담아서 보여줌 */
function PhoneShot({ src, alt }: { src?: string; alt: string }) {
  return (
    <div className="h-[300px] aspect-[360/779] rounded-[22px] bg-white p-[5px] shadow-[0_10px_30px_rgba(117,98,214,.22)]">
      {src ? <img src={src} alt={alt} draggable={false} className="w-full h-full object-cover rounded-[17px] select-none" /> : <div className="w-full h-full rounded-[17px] bg-lav-50" />}
    </div>
  )
}

/** 자세히 보기: 넘겨보는 4페이지 가이드 (실제 게임 화면 3장 + 점수) */
function GameGuide({ g, onDone }: { g: GameMeta; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(0)
  const pages = [
    { key: 'intro', img: guideImg(g.id, 1), title: g.tagline, body: g.desc as string | null },
    ...g.guide.map((p, i) => ({ key: 'how' + i, img: guideImg(g.id, i + 2), title: p.t, body: p.d as string | null })),
    { key: 'score', img: undefined as string | undefined, title: '점수는 이렇게!', body: null },
  ]
  const go = (i: number) => { const el = ref.current; if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' }) }
  const onScroll = () => { const el = ref.current; if (el) setPage(Math.round(el.scrollLeft / el.clientWidth)) }
  const last = page === pages.length - 1
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <GameIcon id={g.id} className="w-6 h-6" />
        <p className="flex-1 text-[15px] font-extrabold">{g.name}</p>
        <p className="text-[12px] font-bold text-ink-mute tabular-nums">{page + 1} / {pages.length}</p>
      </div>
      <div ref={ref} onScroll={onScroll} className="flex overflow-x-auto snap-x snap-mandatory -mx-1" style={{ scrollbarWidth: 'none' }}>
        {pages.map((p, i) => (
          <section key={p.key} className="snap-center shrink-0 w-full px-1" aria-label={`${i + 1}페이지`}>
            <div className="rounded-3xl pt-4 pb-4 px-4 flex flex-col items-center text-center" style={{ background: g.tint }}>
              {p.key === 'score' ? (
                <div className="h-[371px] w-full flex flex-col items-center justify-center">
                  <img src={TROPHY_IMG} alt="" className="w-24 h-24 object-contain" />
                  <h4 className="mt-2 text-[18px] font-extrabold">{p.title}</h4>
                  <ul className="mt-3 w-full max-w-[260px] space-y-2">
                    {g.scoring.map((sc) => <li key={sc} className="rounded-2xl bg-white/85 px-3 py-2 text-[14px] font-bold text-ink">{sc}</li>)}
                  </ul>
                </div>
              ) : <PhoneShot src={p.img} alt={`${g.name} 실제 게임 화면 ${i + 1}`} />}
              {p.key !== 'score' && <h4 className="mt-3 text-[18px] font-extrabold">{p.title}</h4>}
              {p.body && <p className="mt-1 text-[14px] leading-relaxed text-ink-soft min-h-[42px]">{p.body}</p>}
            </div>
          </section>
        ))}
      </div>
      <div className="flex justify-center gap-1.5 mt-3" role="tablist">
        {pages.map((p, i) => (
          <button key={p.key} type="button" role="tab" aria-selected={i === page} aria-label={`${i + 1}페이지로`} onClick={() => go(i)}
            className={`h-2 rounded-full transition-all ${i === page ? 'w-5 bg-lav-500' : 'w-2 bg-lav-200'}`} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2.5 mt-3">
        <Button variant="secondary" onClick={() => (page === 0 ? onDone() : go(page - 1))}>{page === 0 ? '닫기' : '이전'}</Button>
        <Button onClick={() => (last ? onDone() : go(page + 1))}>{last ? '알겠어요!' : '다음'}</Button>
      </div>
    </div>
  )
}

function IcDice({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" /><circle cx="15.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="15.5" r="1.1" fill="currentColor" stroke="none" /><circle cx="15.5" cy="15.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function Home() {
  const { profile, createRoom, joinRoom, busy, error, setError } = useStore()
  const [joinOpen, setJoinOpen] = useState(false)
  const [matchOpen, setMatchOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
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
          <div className="grid grid-cols-3 gap-2">
            {([
              { key: 'cta_join_code', label: '코드로 참여', bg: '#ECE7FF', fg: '#7562D6', icon: <IcUsers className="w-[22px] h-[22px]" />, onClick: () => { setError(null); setJoinOpen(true) }, off: false },
              { key: 'cta_random_match', label: '랜덤 매칭', bg: '#FFF0C7', fg: '#C98A00', icon: <IcDice className="w-[22px] h-[22px]" />, onClick: () => { setError(null); setMatchOpen(true) }, off: busy },
              { key: 'cta_bot', label: '봇이랑 연습', bg: '#E2F4DC', fg: '#4E9A3F', icon: <IcBot className="w-[22px] h-[22px]" />, onClick: () => createRoom('bot'), off: busy },
            ]).map((b) => (
              <button key={b.key} type="button" data-track={b.key} onClick={b.onClick} disabled={b.off}
                className="press rounded-2xl bg-white/90 shadow-soft py-2.5 flex flex-col items-center gap-1.5 disabled:opacity-50 transition">
                <span className="w-10 h-10 rounded-full grid place-items-center" style={{ background: b.bg, color: b.fg }}>{b.icon}</span>
                <span className="text-[13px] font-bold text-ink whitespace-nowrap">{b.label}</span>
              </button>
            ))}
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
            <button key={g.id} onClick={() => { setGuideOpen(false); setInfo(g) }} className="press w-[calc((100%-1.25rem)/3)] rounded-2xl py-3 px-2 flex flex-col items-center justify-center gap-1 shadow-soft" onClickCapture={() => sfx.tap()} style={{ background: g.tint }}>
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
            {guideOpen ? <GameGuide g={info} onDone={() => setInfo(null)} /> : (
              <>
                <GameRules g={info} />
                <Button data-track="game_guide_open" className="w-full mt-4" onClick={() => setGuideOpen(true)}>자세히 보기<IcNext className="w-5 h-5" /></Button>
              </>
            )}
          </>
        )}
      </Sheet>

      <MatchSheet open={matchOpen} onClose={() => setMatchOpen(false)} />

      <Sheet open={profileOpen} onClose={() => setProfileOpen(false)} title="프로필">
        <ProfileForm submitLabel="저장" onDone={() => setProfileOpen(false)} />
      </Sheet>
    </div>
  )
}

