import { useEffect, useState } from 'react'
import { AVATARS, Avatar, LIMITED_AVATARS, toAvatarId, type AvatarId } from '../components/Avatar'
import { UNLOCKS, loadProgress } from '../lib/unlocks'
import { Button, TopBar } from '../components/ui'
import { useStore } from '../store'
import { useSettings } from '../lib/settings'
import { currentKakao, kakaoAvailable, signInWithKakao, signOut, type KakaoProfile } from '../lib/auth'
import { onKakaoLogin } from '../lib/account'
import { getSupabase } from '../net/transports'
import { setLoginType } from '../lib/storage'
import { HERO_IMG } from '../components/charData'
import WORDMARK from '../assets/wordmark.webp'
import { filterNickInput, hasBadWord } from '../net/validate'

export function ProfileForm({ submitLabel, onDone, initialName }: { submitLabel: string; onDone?: () => void; initialName?: string }) {
  const profile = useStore((s) => s.profile)
  const setProfile = useStore((s) => s.setProfile)
  const showToast = useStore((s) => s.showToast)
  const [name, setName] = useState(profile?.nickname ?? filterNickInput(initialName ?? ''))
  const [avatar, setAvatar] = useState<AvatarId>(profile?.avatar ?? 'rabbit')
  // 해금 진행도 (계정 동기화로 바뀔 수 있어 열 때마다 읽음)
  const [progress, setProgress] = useState(loadProgress)
  useEffect(() => { const id = setInterval(() => setProgress(loadProgress()), 1500); return () => clearInterval(id) }, [])
  const kidMode = useSettings((s) => s.kid === true)
  const trimmed = name.trim()
  const bad = hasBadWord(trimmed)
  const valid = trimmed.length >= 1 && !bad
  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => { e.preventDefault(); if (!valid) return; setProfile(trimmed, avatar); onDone?.() }}
    >
      <div className="flex justify-center"><Avatar id={avatar} size={112} className="animate-pop" key={avatar} /></div>
      <div>
        <label htmlFor="nick" className="block text-[14px] font-bold text-ink-soft mb-2">닉네임</label>
        <input
          id="nick" value={name} onChange={(e) => setName(filterNickInput(e.target.value))} maxLength={10} spellCheck={false} autoComplete="off" placeholder="친구에게 보일 이름"
          className="w-full h-14 rounded-2xl bg-white border border-lav-100 px-4 text-[17px] font-semibold outline-none focus:border-lav-400 focus:ring-4 focus:ring-lav-100"
        />
        <div className="mt-1.5 flex justify-between text-[13px]"><span className={bad ? 'text-[#C9433A] font-semibold' : 'text-ink-mute'}>{bad ? '사용할 수 없는 단어가 있어요' : kidMode ? '실명 대신 별명을 써요 · 한글·영문·숫자만' : '한글·영문·숫자만 쓸 수 있어요'}</span><span className="text-ink-mute">{name.length}/10</span></div>
      </div>
      <div>
        <p className="text-[14px] font-bold text-ink-soft mb-2">아바타</p>
        <div className="grid grid-cols-6 gap-2">
          {AVATARS.map((a) => (
            <button type="button" key={a.id} onClick={() => setAvatar(a.id)} aria-label={a.name} aria-pressed={avatar === a.id}
              className={`aspect-square rounded-2xl grid place-items-center transition ${avatar === a.id ? 'bg-white ring-[3px] ring-lav-400 scale-105' : 'bg-white/60 hover:bg-white'}`}>
              <Avatar id={a.id} size={46} />
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <p className="text-[14px] font-bold text-ink-soft">한정판</p>
          <span className="text-[11px] font-extrabold bg-butter-300 rounded-full px-2 py-0.5">LIMITED</span>
        </div>
        <div className="grid grid-cols-6 gap-2 mt-2">
          {LIMITED_AVATARS.map((a) => {
            const u = UNLOCKS.find((x) => x.id === a.id)!
            const open = progress.unlocked.includes(a.id)
            const [cur, need] = u.step(progress)
            return (
              <button type="button" key={a.id} data-track={`limited_${a.id}`} aria-label={open ? a.name : `${a.name} (잠김, ${u.how})`} aria-pressed={avatar === a.id}
                onClick={() => (open ? setAvatar(a.id) : showToast(`${a.name}: ${u.how}하면 열려요 (지금 ${cur}/${need})`))}
                className={`relative aspect-square rounded-2xl grid place-items-center transition ${avatar === a.id ? 'bg-white ring-[3px] ring-lav-400 scale-105' : 'bg-white/60 hover:bg-white'}`}>
                <img src={a.img} alt="" className={`w-[46px] h-[46px] rounded-full ${open ? '' : 'grayscale opacity-60'}`} />
                {!open && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-ink/80 grid place-items-center shadow ring-2 ring-white">
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <ul className="mt-2.5 flex flex-col gap-1.5">
          {UNLOCKS.map((u) => {
            const [cur, need] = u.step(progress); const open = progress.unlocked.includes(u.id)
            return (
              <li key={u.id} className="flex items-center gap-2 text-[12.5px]">
                <span className="w-[68px] shrink-0 font-bold text-ink">{u.name}</span>
                <span className="flex-1 h-2 rounded-full bg-lav-100 overflow-hidden"><span className={`block h-full rounded-full ${open ? 'bg-[#40C057]' : 'bg-lav-400'}`} style={{ width: `${(cur / need) * 100}%` }} /></span>
                <span className={`shrink-0 font-bold tabular-nums ${open ? 'text-[#2F9E44]' : 'text-ink-mute'}`}>{open ? '해금 완료' : `${u.how} ${cur}/${need}`}</span>
              </li>
            )
          })}
        </ul>
      </div>
      <Button type="submit" disabled={!valid} className="w-full mt-2">{submitLabel}</Button>
    </form>
  )
}

export function Onboarding() {
  const [step, setStep] = useState<'welcome' | 'profile'>('welcome')
  const [kakao, setKakao] = useState<KakaoProfile | null>(null)
  const [busy, setBusy] = useState(false)
  const showToast = useStore((s) => s.showToast)
  const kid = useSettings((s) => s.kid)
  const setSettings = useSettings((s) => s.set)
  // 카카오 로그인 후 돌아온 경우 → 프로필 단계로
  useEffect(() => {
    let done = false
    const handle = async () => {
      if (done) return
      const k = await currentKakao().catch(() => null)
      if (!k) return
      done = true
      setKakao(k); setLoginType('kakao')
      try {
        const server = await onKakaoLogin(null) // 이미 계정 프로필이 있으면 바로 홈으로
        if (server) { useStore.getState().setProfile(server.nickname, toAvatarId(server.avatar)); return }
      } catch (e) { console.error('[kakao] 계정 동기화 실패', e) }
      setStep('profile') // 오류가 나도 프로필 단계로는 넘어감
    }
    void handle()
    // 카카오에서 돌아온 직후 세션 처리가 늦게 끝나는 경우 대비
    const sub = getSupabase()?.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_IN' || ev === 'INITIAL_SESSION') void handle() })
    return () => sub?.data.subscription.unsubscribe()
  }, [])

  if (step === 'profile') return (
    <div className="flex-1 flex flex-col">
      <TopBar onBack={kakao ? undefined : () => setStep('welcome')} right={kakao ? (
        <button data-track="onboard_logout" className="h-9 px-3 rounded-full bg-white/80 text-[13px] font-bold text-ink-soft"
          onClick={async () => { await signOut(); setLoginType('guest'); setKakao(null); setStep('welcome') }}>로그아웃</button>
      ) : undefined} />
      <div className="px-6 pb-10 flex-1 flex flex-col">
        <h1 className="font-round text-[30px] leading-tight text-ink">{kakao ? '카카오 로그인 완료!' : '반가워요!'}<br />어떻게 불러드릴까요?</h1>
        <p className="mt-2 text-ink-soft">친구에게 보일 이름과 캐릭터를 골라주세요. 언제든 바꿀 수 있어요.</p>
        <div className="mt-6"><ProfileForm submitLabel="시작하기" initialName={kakao?.nickname} /></div>
        {kakao && (
          <button className="mt-4 mx-auto text-[13px] font-semibold text-ink-mute underline underline-offset-2"
            onClick={async () => { await signOut(); try { await signInWithKakao(true) } catch (e) { showToast((e as Error).message) } }}>
            다른 카카오 계정으로 로그인
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex-1 flex flex-col items-center justify-between px-6 text-center" style={{ paddingTop: 'max(2.5rem, env(safe-area-inset-top))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
      <div className="flex flex-col items-center w-full">
        <img src={WORDMARK} alt="모모팡" className="h-16 w-auto animate-pop" />
        <p className="mt-3 text-ink-soft font-semibold text-[15px]">전화하면서, 게임도 하고 더 가까워져요</p>
      </div>
      <img src={HERO_IMG} alt="게임기를 든 곰돌이와 고양이" className="w-full max-w-[340px] h-auto animate-[floaty_4s_ease-in-out_infinite]" />
      {kid === null ? (
        <div className="w-full flex flex-col gap-2.5">
          <p className="font-extrabold text-[17px] text-ink">시작하기 전에, 나이를 알려주세요</p>
          <Button data-track="age_14plus" className="w-full" onClick={() => setSettings({ kid: false })}>만 14세 이상이에요</Button>
          <Button variant="secondary" data-track="age_under14" className="w-full" onClick={() => setSettings({ kid: true })}>만 14세 미만이에요</Button>
          <p className="text-[12px] text-ink-mute mt-1">만 14세 미만은 개인정보를 모으지 않는 어린이 모드로 이용해요</p>
        </div>
      ) : kid ? (
        <div className="w-full flex flex-col gap-2.5">
          <div className="rounded-2xl bg-mint-100/70 px-4 py-3 text-left">
            <p className="font-extrabold text-[15px] text-ink">🧒 어린이 모드로 시작해요</p>
            <p className="text-[13px] text-ink-soft mt-0.5">아는 친구랑, 그리고 말랑봇이랑 놀 수 있어요. 카카오 로그인과 랜덤 매칭은 쓸 수 없어요.</p>
          </div>
          <Button data-track="login_guest_kid" className="w-full" onClick={() => { setLoginType('guest'); setStep('profile') }}>시작하기</Button>
          <button type="button" className="text-[12px] font-semibold text-ink-mute underline underline-offset-2" onClick={() => setSettings({ kid: null })}>나이를 잘못 골랐어요</button>
        </div>
      ) : (
      <div className="w-full flex flex-col gap-2.5">
        <button
          data-track="login_kakao" disabled={busy}
          onClick={async () => {
            if (!kakaoAvailable) { showToast('카카오 로그인은 정식 버전에서 열려요 · 지금은 게스트로 시작해주세요'); return }
            try { setBusy(true); await signInWithKakao() } catch (e) { setBusy(false); showToast((e as Error).message) }
          }}
          className="w-full min-h-[54px] rounded-2xl font-bold text-[16px] flex items-center justify-center gap-2 active:scale-[.98] transition disabled:opacity-60"
          style={{ background: '#FEE500', color: 'rgba(0,0,0,.85)' }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden><path fill="#000" d="M12 3C6.48 3 2 6.48 2 10.78c0 2.78 1.86 5.22 4.66 6.6l-.95 3.48c-.08.3.26.54.52.37l4.13-2.73c.54.07 1.08.11 1.64.11 5.52 0 10-3.48 10-7.83S17.52 3 12 3z" /></svg>
          {busy ? '카카오로 이동 중…' : '카카오로 시작하기'}
        </button>
        <Button variant="secondary" data-track="login_guest" className="w-full" onClick={() => { setLoginType('guest'); setStep('profile') }}>가입 없이 게스트로 시작</Button>
        <p className="text-[12px] text-ink-mute mt-1">카카오로 시작하면 폰을 바꿔도 기록이 남아요{!kakaoAvailable && ' (곧 지원)'}</p>
      </div>
      )}
    </div>
  )
}
