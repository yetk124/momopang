import { useEffect } from 'react'
import { BOT_IMG } from '../components/charData'
import { Button } from '../components/ui'
import { track } from '../lib/analytics'
import { defaultMode, useStore } from '../store'

function Shell({ code, title, desc, children }: { code?: string; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-2" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="relative">
        <img src={BOT_IMG} alt="" className="w-36 h-36 animate-floaty" />
        {code && <span className="absolute -top-2 -right-6 font-round text-[34px] text-lav-500 rotate-12">{code}</span>}
      </div>
      <h1 className="font-round text-[28px] mt-3 leading-tight">{title}</h1>
      <p className="text-ink-soft text-[15px] max-w-[280px]">{desc}</p>
      <div className="w-full max-w-[300px] flex flex-col gap-2 mt-5">{children}</div>
    </div>
  )
}

const goHome = () => {
  try { history.replaceState(null, '', '/') } catch { /* noop */ }
  const st = useStore.getState()
  st.setError(null)
  st.go(st.profile ? 'home' : 'onboard')
}

/** 없는 주소로 들어왔을 때 */
export function NotFound() {
  useEffect(() => { track('not_found', { path: location.pathname.slice(0, 80) }) }, [])
  return (
    <Shell code="404" title="길을 잃었어요" desc="찾으시는 페이지가 없어요. 주소가 바뀌었거나 잘못 입력됐을 수 있어요.">
      <Button data-track="404_home" onClick={goHome}>홈으로 가기</Button>
    </Shell>
  )
}

/** 초대 링크로 들어왔는데 방에 들어갈 수 없을 때 */
export function InviteError() {
  const error = useStore((s) => s.error)
  useEffect(() => { track('invite_error', { reason: (error ?? '').slice(0, 40) }) }, [error])
  return (
    <Shell title="초대 링크를 열 수 없어요" desc={`${error ?? '방을 찾지 못했어요'}. 친구에게 새 링크를 받거나 직접 방을 만들어 보세요.`}>
      <Button data-track="invite_new_room" onClick={() => { goHome(); void useStore.getState().createRoom(defaultMode()) }}>새 방 만들기</Button>
      <Button variant="secondary" data-track="invite_home" onClick={goHome}>홈으로 가기</Button>
    </Shell>
  )
}
