import { useState, type ReactNode } from 'react'
import { Avatar } from '../components/Avatar'
import { IcNext } from '../components/Icons'
import { ConfirmSheet, Sheet, TopBar } from '../components/ui'
import { useSettings, type Settings as S } from '../lib/settings'
import { sfx } from '../lib/sfx'
import { supabaseConfigured } from '../net/transports'
import { useStore } from '../store'
import { ProfileForm } from './Onboarding'
import { kakaoAvailable, signInWithKakao, signOut } from '../lib/auth'
import { deleteAccount } from '../lib/account'
import { getLoginType, setLoginType } from '../lib/storage'

const ic = (d: string) => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 text-lav-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
)
const ICONS = {
  bgm: ic('M9 18V6l10-2v12M9 18a3 3 0 11-6 0 3 3 0 016 0zM19 16a3 3 0 11-6 0 3 3 0 016 0z'),
  sfx: ic('M4 10v4h4l5 4V6L8 10zM16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11'),
  vibe: ic('M8 4h8v16H8zM4 8v8M20 8v8M2 10v4M22 10v4'),
  bell: ic('M6 16V11a6 6 0 0112 0v5l2 2H4zM10 20a2 2 0 004 0'),
  lang: ic('M4 5h9M8.5 3v2M6 5c0 4 3 7 6 8M11 5c0 4-3 7-6 8M13 21l4-9 4 9M14.5 18h5'),
  chart: ic('M4 20V10M10 20V4M16 20v-7M22 20H2'),
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`w-12 h-7 rounded-full p-[3px] transition shrink-0 ${on ? 'bg-lav-400' : 'bg-[#E3DDEE]'}`}>
      <span className={`block w-[22px] h-[22px] rounded-full bg-white shadow transition ${on ? 'translate-x-5' : ''}`} />
    </button>
  )
}
function Slider({ value, onChange, disabled, label }: { value: number; onChange: (v: number) => void; disabled?: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-3 px-4 pb-3 -mt-1 ${disabled ? 'opacity-40' : ''}`}>
      <span className="w-5" />
      <input type="range" min={0} max={100} step={5} value={value} disabled={disabled} aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="vol flex-1 cursor-pointer disabled:cursor-default" style={{ ['--p' as string]: `${value}%` }} />
      <span className="w-9 text-right text-[13px] font-bold text-ink-soft tabular-nums">{value}%</span>
    </div>
  )
}
function Row({ icon, label, right, onClick }: { icon?: ReactNode; label: string; right?: ReactNode; onClick?: () => void }) {
  const inner = (
    <>
      {icon}
      <span className="flex-1 text-left text-[15px] font-semibold">{label}</span>
      {right ?? <IcNext className="w-5 h-5 text-ink-mute" />}
    </>
  )
  return onClick
    ? <button onClick={onClick} className="w-full min-h-[52px] flex items-center gap-3 px-4 active:bg-lav-50">{inner}</button>
    : <div className="min-h-[52px] flex items-center gap-3 px-4">{inner}</div>
}
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-[13px] font-extrabold text-ink-soft px-1 mb-1.5">{title}</h2>
      <div className="rounded-3xl bg-white/85 shadow-soft divide-y divide-lav-50 overflow-hidden">{children}</div>
    </section>
  )
}

type Doc = 'privacy' | 'terms' | 'refund'
const DOCS: Record<Doc, { title: string; body: [string, string][] }> = {
  privacy: {
    title: '개인정보 처리 방침',
    body: [
      ['1. 수집하는 정보', '모모팡은 게스트로 바로 쓰거나 카카오 계정으로 로그인해 쓸 수 있어요. 게스트는 닉네임·아바타·기기에서 만든 임시 ID만 사용해요. 카카오 로그인 시에는 카카오가 제공하는 닉네임·프로필 사진·카카오 회원번호(식별자)와, 동의한 경우 카카오계정 이메일을 받아요. 이메일은 계정 식별에만 쓰고 앱 화면이나 연락 목적으로 쓰지 않아요. 전화번호, 위치 정보는 수집하지 않아요.'],
      ['2. 이용 목적', '방 만들기와 입장, 상대방에게 닉네임·아바타 표시, 게임 진행 상태 동기화, 게임 결과 표시에만 사용해요.'],
      ['3. 보관 위치와 기간', '프로필, 설정, 최근 기록은 이용자의 기기(브라우저 저장소)에 저장돼요. 온라인 모드에서는 방 코드, 닉네임, 게임 결과가 서버(Supabase)에 기록되며 방 만료 후 30일 이내 삭제를 원칙으로 해요. 카카오 계정으로 이용하면 프로필과 최근 게임 기록이 계정에 저장되어 다른 기기에서도 이어서 볼 수 있어요. 명예의 전당(랭킹)을 위해 닉네임·아바타·누적 승수가 기기 단위 무작위 ID와 함께 저장되고, 다른 이용자에게 닉네임과 승수가 공개돼요.'],
      ['4. 제3자 제공·처리 위탁', '법령에 따른 경우를 제외하고 개인정보를 외부에 제공하지 않아요. 실시간 연결을 위해 Supabase를, 이용 통계 분석을 위해 Google Analytics를 이용해요.'],
      ['5. 이용 통계(Google Analytics) · 자동 수집 장치', '서비스 개선을 위해 화면 이동, 화면별 머문 시간, 누른 버튼, 게임 시작·종료 같은 익명 이용 기록과 기기·브라우저 정보를 수집해요. 닉네임, 플레이어 ID는 보내지 않고 광고 목적으로 쓰지 않아요. 이를 위해 브라우저 저장소·쿠키 같은 자동 수집 장치를 사용해요. 원하지 않으면 첫 안내창의 \'보내지 않기\' 또는 설정 > 사용 통계 보내기에서 언제든 거부할 수 있고, 거부해도 앱 이용에는 제한이 없어요.'],
      ['6. 이용자의 권리', '설정에서 프로필을 언제든 바꿀 수 있고, 브라우저 데이터를 지우면 기기에 저장된 정보가 모두 삭제돼요. 서버 기록 삭제는 고객 문의로 요청할 수 있어요.'],
      ['7. 회원 탈퇴', '카카오 계정으로 이용하면 설정 > 계정 > 회원 탈퇴에서 언제든 탈퇴할 수 있어요. 탈퇴하면 프로필, 게임 기록, 랭킹 정보가 즉시 삭제돼요. 카카오 쪽 연결 해제는 카카오 계정 설정에서도 할 수 있어요.'],
      ['8. 문의', '개인정보 관련 문의는 앱 내 고객 지원 채널로 보내주세요.'],
    ],
  },
  terms: {
    title: '이용 약관',
    body: [
      ['제1조 (목적)', '이 약관은 모모팡(이하 “서비스”)가 제공하는 2인 실시간 미니게임 이용 조건과 절차를 정해요.'],
      ['제2조 (서비스 내용)', '서비스는 방 코드나 초대 링크로 연결된 두 사람이 함께 미니게임을 할 수 있게 해요. 음성·영상 통화 기능은 제공하지 않아요.'],
      ['제3조 (이용 방법)', '회원가입 없이 닉네임과 아바타를 정해 게스트로 이용해요. 한 방에는 최대 2명이 들어갈 수 있어요.'],
      ['제4조 (이용자의 의무)', '다른 사람을 불쾌하게 하는 닉네임 사용, 서비스 부정 이용(조작, 비정상 접속 등), 서비스 운영 방해를 하면 안 돼요.'],
      ['제5조 (서비스 변경·중단)', '점검, 장애, 운영상 필요에 따라 서비스 일부 또는 전부를 바꾸거나 멈출 수 있어요. 가능한 한 미리 알려드려요.'],
      ['제6조 (책임의 한계)', '이용자 기기·네트워크 상태로 생긴 연결 끊김이나 게임 결과에 대해서는 책임지지 않아요. 무료 서비스 특성상 게임 기록의 영구 보관을 보장하지 않아요.'],
    ],
  },
  refund: {
    title: '환불 정책',
    body: [
      ['현재 유료 상품 없음', '모모팡은 현재 모든 기능을 무료로 제공하고 있어 결제나 환불 대상이 되는 상품이 없어요.'],
      ['향후 유료 상품 도입 시', '유료 아이템이나 구독이 생기면 관련 법령(전자상거래법 등)에 따라 청약철회·환불 기준을 이 페이지에 먼저 안내할게요.'],
      ['문의', '결제 관련 문의가 생기면 앱 내 고객 지원 채널로 보내주세요.'],
    ],
  },
}

export function Settings() {
  const st = useSettings()
  const profile = useStore((s) => s.profile)
  const [sheet, setSheet] = useState<'profile' | 'notify' | 'lang' | 'withdraw' | Doc | null>(null)
  const [loginType, setLoginTypeState] = useState(getLoginType())
  const set = (p: Partial<S>) => { st.set(p); if (p.sfx || p.vibe) sfx.tap() }
  const doc = sheet && sheet in DOCS ? DOCS[sheet as Doc] : null

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="설정" />
      <div className="px-5 pb-8 flex flex-col gap-5">
        <button onClick={() => setSheet('profile')} className="rounded-3xl bg-white/85 shadow-soft p-4 flex items-center gap-3 text-left active:bg-lav-50">
          {profile && <Avatar id={profile.avatar} size={52} />}
          <div className="flex-1"><p className="font-extrabold text-[17px]">{profile?.nickname}</p><p className="text-[13px] text-ink-mute">닉네임 · 아바타 바꾸기</p></div>
          <IcNext className="w-5 h-5 text-ink-mute" />
        </button>

        <Group title="계정">
          {loginType === 'kakao' ? (
            <>
              <Row label="카카오 계정 연결됨" right={<span className="text-[12px] font-bold rounded-full px-2 py-0.5" style={{ background: '#FEE500' }}>kakao</span>} />
              <Row label="회원 탈퇴" onClick={() => setSheet('withdraw')} right={<span className="text-[13px] text-[#C9433A] font-semibold">탈퇴</span>} />
              <Row label="로그아웃" onClick={async () => { await signOut(); setLoginType('guest'); setLoginTypeState('guest'); useStore.getState().showToast('로그아웃했어요 · 게스트로 계속 이용해요') }} />
            </>
          ) : (
            <Row label="카카오로 기록 저장하기" onClick={async () => {
              if (!kakaoAvailable) { useStore.getState().showToast('카카오 로그인은 정식 버전에서 열려요'); return }
              try { await signInWithKakao() } catch (e) { useStore.getState().showToast((e as Error).message) }
            }} right={<span className="flex items-center gap-1 text-[13px] text-ink-mute">게스트<IcNext className="w-5 h-5" /></span>} />
          )}
        </Group>

        <Group title="환경 설정">
          <div>
            <Row icon={ICONS.bgm} label="배경음 설정" right={<Toggle label="배경음" on={st.bgm} onChange={(v) => set({ bgm: v })} />} />
            {st.bgm && <Slider label="배경음 크기" value={st.bgmVol} onChange={(v) => st.set({ bgmVol: v })} />}
          </div>
          <div>
            <Row icon={ICONS.sfx} label="효과음 설정" right={<Toggle label="효과음" on={st.sfx} onChange={(v) => set({ sfx: v })} />} />
            {st.sfx && <Slider label="효과음 크기" value={st.sfxVol} onChange={(v) => { st.set({ sfxVol: v }); sfx.tap() }} />}
          </div>
          <Row icon={ICONS.vibe} label="진동 설정" right={<Toggle label="진동" on={st.vibe} onChange={(v) => set({ vibe: v })} />} />
          <Row icon={ICONS.bell} label="알림 설정" onClick={() => setSheet('notify')} />
          <Row icon={ICONS.chart} label="사용 통계 보내기" right={<Toggle label="사용 통계" on={st.analytics !== 'denied'} onChange={(v) => set({ analytics: v ? 'granted' : 'denied' })} />} />
          <Row icon={ICONS.lang} label="언어 설정" onClick={() => setSheet('lang')} right={<span className="flex items-center gap-1 text-[14px] text-ink-mute">한국어<IcNext className="w-5 h-5" /></span>} />
        </Group>

        <Group title="고객 지원">
          <Row label="개인정보 처리 방침" onClick={() => setSheet('privacy')} />
          <Row label="이용 약관" onClick={() => setSheet('terms')} />
          <Row label="환불 정책" onClick={() => setSheet('refund')} />
        </Group>

        <Group title="앱 정보">
          <Row label="연결 방식" right={<span className="text-[14px] text-ink-mute">{supabaseConfigured ? '온라인' : '데모 (같은 브라우저)'}</span>} />
          <Row label="버전" right={<span className="text-[14px] text-ink-mute tabular-nums">0.1.0</span>} />
        </Group>
        <p className="text-center text-[12px] text-ink-mute">통화는 카카오톡·전화·디스코드로, 게임은 모모팡에서!</p>
      </div>

      <Sheet open={sheet === 'profile'} onClose={() => setSheet(null)} title="프로필">
        <ProfileForm submitLabel="저장" onDone={() => setSheet(null)} />
      </Sheet>
      <ConfirmSheet open={sheet === 'withdraw'} title="정말 탈퇴할까요?" desc="카카오 계정 연결과 저장된 프로필·게임 기록·랭킹이 모두 삭제되고 되돌릴 수 없어요." confirm="탈퇴하기"
        onClose={() => setSheet(null)}
        onConfirm={async () => {
          setSheet(null)
          try {
            await deleteAccount()
            useStore.setState({ profile: null, screen: 'onboard' })
            useStore.getState().showToast('탈퇴했어요 · 그동안 고마웠어요')
          } catch (e) { useStore.getState().showToast((e as Error).message) }
        }} />
      <Sheet open={sheet === 'notify'} onClose={() => setSheet(null)} title="알림 설정">
        <p className="text-[13px] text-ink-mute mb-3">앱을 보고 있을 때 화면 위에 짧게 알려드려요.</p>
        <div className="rounded-3xl bg-white divide-y divide-lav-50">
          <Row label="친구 입장·퇴장 알림" right={<Toggle label="입장 알림" on={st.notifyJoin} onChange={(v) => set({ notifyJoin: v })} />} />
          <Row label="상대 준비 완료 알림" right={<Toggle label="준비 알림" on={st.notifyReady} onChange={(v) => set({ notifyReady: v })} />} />
          <Row label="재경기 요청 알림" right={<Toggle label="재경기 알림" on={st.notifyRematch} onChange={(v) => set({ notifyRematch: v })} />} />
        </div>
      </Sheet>
      <Sheet open={sheet === 'lang'} onClose={() => setSheet(null)} title="언어 설정">
        <div className="rounded-3xl bg-white divide-y divide-lav-50">
          {([['ko', '한국어', true], ['en', 'English', false], ['ja', '日本語', false]] as const).map(([k, label, ok]) => (
            <button key={k} disabled={!ok} onClick={() => { set({ lang: k }); setSheet(null) }} className="w-full min-h-[52px] flex items-center px-4 gap-3 disabled:opacity-50">
              <span className="flex-1 text-left font-semibold">{label}</span>
              {!ok ? <span className="text-[12px] font-bold bg-butter-100 rounded-full px-2 py-0.5">준비중</span> : st.lang === k ? <span className="text-lav-500 font-extrabold">✓</span> : null}
            </button>
          ))}
        </div>
      </Sheet>
      <Sheet open={!!doc} onClose={() => setSheet(null)} title={doc?.title}>
        <div className="max-h-[62vh] overflow-y-auto -mx-1 px-1 space-y-4 text-[14px] leading-relaxed">
          {doc?.body.map(([h, p]) => <div key={h}><h3 className="font-extrabold mb-1">{h}</h3><p className="text-ink-soft">{p}</p></div>)}
          <p className="text-[12px] text-ink-mute pt-2 border-t border-lav-50">시행일: 2026년 12월 1일 (초안 · 정식 출시 전 법률 검토가 필요해요)</p>
        </div>
      </Sheet>
    </div>
  )
}
