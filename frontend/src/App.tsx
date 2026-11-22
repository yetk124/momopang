import { useEffect, useRef, useState } from 'react'
import { IcGear, IcHome, IcTrophy } from './components/Icons'
import { Toast } from './components/ui'
import { History } from './screens/History'
import { Home } from './screens/Home'
import { Onboarding } from './screens/Onboarding'
import { Room } from './screens/Room'
import { Settings } from './screens/Settings'
import { InviteError, NotFound } from './screens/NotFound'
import { Splash } from './screens/Splash'
import { checkLoginOnBoot } from './lib/account'
import { toAvatarId } from './components/Avatar'
import { restoreSession, useStore, type Screen } from './store'
import { armBgm, setMusicMode } from './lib/bgm'
import { initAnalytics, trackScreen } from './lib/analytics'

export default function App() {
  const screen = useStore((s) => s.screen)
  const profile = useStore((s) => s.profile)
  const booted = useRef(false)
  const [splash, setSplash] = useState(true)
  useEffect(() => { armBgm(); initAnalytics() }, [])
  const phase = useStore((s) => s.room?.phase)
  const game = useStore((s) => s.room?.session?.game ?? s.room?.result?.game ?? s.room?.game)
  useEffect(() => { setMusicMode(phase === 'playing' || phase === 'countdown' ? 'game' : 'menu') }, [phase])
  // GA 화면 이름: home, history, settings, onboard, lobby, game_apple, result_apple …
  useEffect(() => {
    const name = screen !== 'room' ? screen : phase === 'playing' ? `game_${game}` : phase === 'result' ? `result_${game}` : 'lobby'
    trackScreen(name)
  }, [screen, phase, game])
  useEffect(() => { window.scrollTo(0, 0) }, [screen, phase])

  useEffect(() => {
    if (!profile || booted.current) return
    booted.current = true
    const st = useStore.getState()
    if (st.screen === 'notfound') return
    // 카카오 로그인하고 돌아온 경우: 게스트 기록 합치고 계정 프로필 적용
    void checkLoginOnBoot(st.profile).then((p) => {
      if (!p) return
      const s2 = useStore.getState()
      if (p.nickname !== s2.profile?.nickname || p.avatar !== s2.profile?.avatar) s2.setProfile(p.nickname, toAvatarId(p.avatar))
      s2.showToast('카카오 계정으로 기록을 저장했어요')
    })
    if (st.joinPrefill) { void st.joinRoom(st.joinPrefill).then(() => { const s2 = useStore.getState(); if (!s2.room && s2.error) s2.go('invite') }); try { history.replaceState(null, '', location.pathname.replace(/\/join$/, '/')) } catch { /* noop */ } }
    else restoreSession()
  }, [profile])

  return (
    <div className="min-h-[100dvh] flex justify-center">
      <div className="app-bg relative w-full max-w-[440px] min-h-[100dvh] flex flex-col shadow-[0_0_60px_-20px_rgba(120,90,160,.25)]">
        {screen === 'onboard' && <Onboarding />}
        {screen === 'home' && <Home />}
        {screen === 'room' && <Room />}
        {screen === 'history' && <History />}
        {screen === 'settings' && <Settings />}
        {screen === 'notfound' && <NotFound />}
        {screen === 'invite' && <InviteError />}
        {(screen === 'home' || screen === 'history' || screen === 'settings') && <BottomNav current={screen} />}
        <Toast />
        {splash && <Splash onDone={() => setSplash(false)} />}
      </div>
    </div>
  )
}

function BottomNav({ current }: { current: Screen }) {
  const go = useStore((s) => s.go)
  const items: { id: Screen; label: string; Icon: typeof IcHome }[] = [
    { id: 'home', label: '홈', Icon: IcHome },
    { id: 'history', label: '기록', Icon: IcTrophy },
    { id: 'settings', label: '설정', Icon: IcGear },
  ]
  return (
    <nav className="sticky bottom-0 z-30 mt-auto bg-white/90 backdrop-blur border-t border-lav-100 grid grid-cols-3" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {items.map(({ id, label, Icon }) => (
        <button key={id} onClick={() => go(id)} className={`h-16 flex flex-col items-center justify-center gap-1 text-[12px] font-bold ${current === id ? 'text-lav-500' : 'text-ink-mute'}`} aria-current={current === id ? 'page' : undefined}>
          <Icon className="w-6 h-6" />{label}
        </button>
      ))}
    </nav>
  )
}
