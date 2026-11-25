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
import { unblockPlayer, useBlocks } from '../lib/safety'

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
  block: ic('M12 3a9 9 0 100 18 9 9 0 000-18zM5.6 5.6l12.8 12.8'),
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

// ⚠️ 출시 전에 실제 정보로 바꿔주세요 (개인정보 보호법상 필수 항목)
const PRIVACY_OWNER = '모모팡 운영자'
const PRIVACY_EMAIL = '919yeeun@naver.com'
/** 공개하고 싶지 않으면 '' 로 비워두세요 (이메일만 표시돼요) */
const PRIVACY_PHONE = '010-9342-2792'
const PRIVACY_EFFECTIVE = '2026년 11월 24일'

type Doc = 'privacy' | 'terms' | 'refund'
const DOCS: Record<Doc, { title: string; body: [string, string][] }> = {
  privacy: {
    title: '개인정보 처리 방침',
    body: [
      ['1. 처리 목적', '방 만들기·입장, 상대방에게 닉네임과 아바타 보여주기, 게임 진행 상태 동기화, 랜덤 매칭과 신고·차단 처리, 게임 결과·랭킹 표시와 부정 기록 방지, 카카오 계정 로그인과 기록 보관, 서비스 개선을 위한 이용 통계에만 사용해요.'],
      ['2. 처리하는 개인정보 항목', '• 게스트: 닉네임, 아바타, 기기에서 만든 무작위 ID\n• 카카오 로그인: 카카오가 제공하는 닉네임, 프로필 사진, 카카오 회원번호(식별자)\n• 게임 이용: 방 코드, 게임 결과(점수·승패), 누적 승수, 해금한 아바타\n• 랜덤 매칭: 매칭용 무작위 ID, 신고할 때 고른 사유와 직접 쓴 내용, 차단 목록(카카오 로그인 시)\n• 자동 수집: 접속 기록(IP 주소, 접속 시각), 기기·브라우저 정보, 화면 이동·버튼 누름 같은 익명 이용 기록\n전화번호, 이메일, 위치 정보는 받지 않아요.'],
      ['3. 보유 기간과 파기', '• 방·게임 진행 기록: 만든 날부터 30일 뒤 자동 삭제\n• 게스트 랭킹 기록(닉네임·아바타·승수): 마지막 게임 후 1년 동안 이용이 없으면 자동 삭제\n• 카카오 계정 프로필·게임 기록·차단 목록: 회원 탈퇴 시 즉시 삭제\n• 신고 기록: 처리가 끝난 뒤 1년 동안 보관 후 삭제 (반복 신고 확인용)\n• 랭킹 기록 검증용 로그(IP 주소, 게임 종류, 판 번호): 3일 뒤 자동 삭제 (점수 조작 방지용)\n• 기기에 저장된 프로필·설정·최근 기록: 브라우저 데이터를 지우면 삭제\n삭제는 매일 정해진 시간에 서버에서 자동으로 실행되고, 복구할 수 없는 방법으로 지워요.'],
      ['4. 제3자 제공', '법령에 따라 요구되는 경우를 제외하고 개인정보를 다른 곳에 제공하지 않아요. 랭킹(명예의 전당)에서는 다른 이용자에게 닉네임, 아바타, 승수가 보여요.'],
      ['5. 처리 위탁', '서비스 운영을 위해 아래 업체에 처리를 맡기고 있어요.\n• Supabase Inc.: 데이터베이스, 로그인 처리, 실시간 연결\n• Vercel Inc.: 웹사이트 호스팅(접속 기록 처리)\n• Google LLC: 이용 통계(Google Analytics)\n• (주)카카오: 카카오 로그인 인증'],
      ['6. 국외 이전', '위탁 업체의 서버가 해외에 있어 아래와 같이 개인정보가 국외로 전송돼요.\n• Supabase Inc.(미국) · 프로필·게임 기록·접속 정보 · 서비스 이용 시 네트워크로 전송 · 위 3번 보유 기간까지\n• Vercel Inc.(미국) · 접속 기록(IP 주소, 브라우저 정보) · 접속 시 전송 · 업체 정책에 따른 기간\n• Google LLC(미국) · 익명 이용 기록, 기기·브라우저 정보 · 이용 중 전송 · 최대 14개월\n국외 이전을 원하지 않으면 이용을 멈추거나 회원 탈퇴할 수 있어요. 이용 통계는 설정에서 따로 끌 수 있어요.'],
      ['7. 이용 통계 · 자동 수집 장치', '서비스 개선을 위해 Google Analytics로 화면 이동, 머문 시간, 누른 버튼, 게임 시작·종료 같은 익명 이용 기록을 모아요. 닉네임과 플레이어 ID는 보내지 않고 광고에 쓰지 않아요. 이를 위해 브라우저 저장소와 쿠키를 써요. 첫 안내창의 \'보내지 않기\' 또는 설정 > 사용 통계 보내기에서 언제든 거부할 수 있고, 거부해도 이용에 제한이 없어요.'],
      ['8. 이용자의 권리', '언제든 자신의 개인정보를 확인·수정·삭제하거나 처리 정지를 요청할 수 있어요. 프로필은 설정에서 바로 바꿀 수 있고, 카카오 계정은 설정 > 내 계정 > 회원 탈퇴로 즉시 삭제돼요. 그 밖의 요청은 아래 연락처로 보내주시면 지체 없이 처리할게요.'],
      ['9. 만 14세 미만 (어린이 모드)', '만 14세 미만은 처음 시작할 때 고르는 어린이 모드로 이용해요. 어린이 모드에서는 카카오 로그인, 랜덤 매칭, 랭킹 등록, 이용 통계(Google Analytics)를 쓰지 않아 법정대리인 동의가 필요한 개인정보를 모으지 않아요. 친구와 게임할 때 닉네임과 아바타는 상대에게 보이고, 방 기록은 30일 뒤 자동으로 지워져요. 그래서 닉네임은 실명 대신 별명을 쓰도록 안내해요. 보호자는 아래 연락처로 기록 삭제를 요청할 수 있어요.'],
      ['10. 안전성 확보 조치', '모든 데이터는 암호화된 연결(HTTPS)로 주고받고, 데이터베이스는 본인 데이터만 볼 수 있게 접근을 제한해요. 관리용 비밀 키는 앱에 넣지 않고 서버에만 보관해요.'],
      ['11. 개인정보 보호책임자', `개인정보와 관련한 문의, 불만, 피해 구제는 아래로 연락해 주세요.\n• 책임자: ${PRIVACY_OWNER}\n• 이메일: ${PRIVACY_EMAIL}\n${PRIVACY_PHONE ? `• 전화: ${PRIVACY_PHONE}\n` : ''}개인정보 침해 신고·상담은 개인정보침해신고센터(국번 없이 118, privacy.kisa.or.kr)에도 할 수 있어요.`],
      ['12. 변경 안내', `이 방침이 바뀌면 앱 안에서 먼저 알려드려요.\n시행일: ${PRIVACY_EFFECTIVE}`],
    ],
  },
  terms: {
    title: '이용 약관',
    body: [
      ['제1조 (목적)', '이 약관은 모모팡(이하 “서비스”)가 제공하는 2인 실시간 미니게임 이용 조건과 절차를 정해요.'],
      ['제2조 (서비스 내용)', '서비스는 방 코드나 초대 링크로 연결된 두 사람이 함께 미니게임을 할 수 있게 해요. 음성·영상 통화 기능은 제공하지 않아요.'],
      ['제3조 (이용 방법)', '게스트(가입 없음) 또는 카카오 계정으로 이용해요. 한 방에는 최대 2명이 들어갈 수 있고, 친구 초대·랜덤 매칭·봇 연습으로 게임을 할 수 있어요. 만 14세 미만은 어린이 모드로 이용할 수 있어요.'],
      ['제4조 (이용자의 의무)', '다른 사람을 불쾌하게 하는 닉네임 사용, 서비스 부정 이용(조작, 비정상 접속 등), 서비스 운영 방해를 하면 안 돼요. 랜덤 매칭에서 24시간 안에 서로 다른 3명 이상에게 신고받으면 24시간 동안 랜덤 매칭이 제한되고, 심한 경우 이용이 제한될 수 있어요.'],
      ['제5조 (서비스 변경·중단)', '점검, 장애, 운영상 필요에 따라 서비스 일부 또는 전부를 바꾸거나 멈출 수 있어요. 가능한 한 미리 알려드려요.'],
      ['제6조 (책임의 한계)', '이용자 기기·네트워크 상태로 생긴 연결 끊김이나 게임 결과에 대해서는 책임지지 않아요. 무료 서비스 특성상 게임 기록의 영구 보관을 보장하지 않아요.'],
    ],
  },
  refund: {
    title: '환불 정책',
    body: [
      ['현재 유료 상품 없음', '모모팡은 현재 모든 기능을 무료로 제공하고 있어 결제나 환불 대상이 되는 상품이 없어요.'],
      ['향후 유료 상품 도입 시', '유료 아이템이나 구독이 생기면 관련 법령(전자상거래법 등)에 따라 청약철회·환불 기준을 이 페이지에 먼저 안내할게요.'],
      ['문의', `결제 관련 문의는 ${PRIVACY_EMAIL} 로 보내주세요.`],
    ],
  },
}

export function Settings() {
  const st = useSettings()
  const profile = useStore((s) => s.profile)
  const [sheet, setSheet] = useState<'profile' | 'notify' | 'lang' | 'withdraw' | 'blocks' | Doc | null>(null)
  const blocks = useBlocks()
  const [loginType, setLoginTypeState] = useState(getLoginType())
  const set = (p: Partial<S>) => { st.set(p); if (p.sfx || p.vibe) sfx.tap() }
  const doc = sheet && sheet in DOCS ? DOCS[sheet as Doc] : null

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="설정" />
      <div className="px-5 pb-8 flex flex-col gap-5">
        <Group title="내 계정">
          <button onClick={() => setSheet('profile')} className="w-full p-4 flex items-center gap-3 text-left active:bg-lav-50">
            {profile && <Avatar id={profile.avatar} size={52} />}
            <div className="flex-1 min-w-0">
              <p className="flex items-center gap-1.5 font-extrabold text-[17px]">
                <span className="truncate">{profile?.nickname}</span>
                {loginType === 'kakao'
                  ? <span className="shrink-0 text-[11px] font-bold rounded-full px-2 py-0.5" style={{ background: '#FEE500' }}>kakao</span>
                  : <span className="shrink-0 text-[11px] font-bold rounded-full px-2 py-0.5 bg-lav-50 text-ink-soft">게스트</span>}
              </p>
              <p className="text-[13px] text-ink-mute">닉네임 · 아바타 바꾸기</p>
            </div>
            <IcNext className="w-5 h-5 text-ink-mute" />
          </button>
          {loginType === 'kakao' ? (
            <>
              <Row label="로그아웃" onClick={async () => { await signOut(); setLoginType('guest'); setLoginTypeState('guest'); useStore.getState().showToast('로그아웃했어요 · 게스트로 계속 이용해요') }} />
              <Row label="회원 탈퇴" onClick={() => setSheet('withdraw')} right={<span className="text-[13px] text-[#C9433A] font-semibold">탈퇴</span>} />
            </>
          ) : st.kid ? null : (
            <Row label="카카오로 기록 저장하기" onClick={async () => {
              if (!kakaoAvailable) { useStore.getState().showToast('카카오 로그인은 정식 버전에서 열려요'); return }
              try { await signInWithKakao() } catch (e) { useStore.getState().showToast((e as Error).message) }
            }} />
          )}
          {loginType !== 'kakao' && (
            <Row label="어린이 모드 (만 14세 미만)" right={<Toggle label="어린이 모드" on={st.kid === true} onChange={(v) => { set({ kid: v }); useStore.getState().showToast(v ? '어린이 모드를 켰어요 · 카카오 로그인·랜덤 매칭·이용 통계가 꺼져요' : '어린이 모드를 껐어요') }} />} />
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
          {(!st.kid || blocks.length > 0) && <Row icon={ICONS.block} label="차단 목록" onClick={() => setSheet('blocks')} right={<span className="flex items-center gap-1 text-[14px] text-ink-mute tabular-nums">{blocks.length}명<IcNext className="w-5 h-5" /></span>} />}
          {st.kid
            ? <Row icon={ICONS.chart} label="사용 통계 보내기" right={<span className="text-[13px] text-ink-mute">어린이 모드라 꺼져 있어요</span>} />
            : <Row icon={ICONS.chart} label="사용 통계 보내기" right={<Toggle label="사용 통계" on={st.analytics !== 'denied'} onChange={(v) => set({ analytics: v ? 'granted' : 'denied' })} />} />}
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
      <Sheet open={sheet === 'blocks'} onClose={() => setSheet(null)} title="차단 목록">
        <p className="text-[13.5px] text-ink-soft -mt-1 mb-3">차단한 사람은 랜덤 매칭에서 다시 만나지 않아요.{loginType === 'kakao' ? ' 카카오 계정에 저장돼요.' : ' 이 기기에만 저장돼요.'}</p>
        {blocks.length === 0
          ? <p className="py-8 text-center text-[14px] text-ink-mute">차단한 사람이 없어요</p>
          : <div className="rounded-3xl bg-white/85 divide-y divide-lav-50 overflow-hidden">
              {blocks.map((b) => (
                <div key={b.mid} className="min-h-[52px] flex items-center gap-3 px-4">
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-semibold truncate">{b.name || '알 수 없음'}</span>
                    <span className="block text-[12px] text-ink-mute">{new Date(b.at).toLocaleDateString('ko-KR')} 차단</span>
                  </span>
                  <button className="h-8 px-3 rounded-full bg-lav-50 text-[13px] font-bold text-ink-soft active:scale-95" onClick={() => { void unblockPlayer(b.mid); useStore.getState().showToast(`${b.name || '상대'}님 차단을 풀었어요`) }}>차단 해제</button>
                </div>
              ))}
            </div>}
      </Sheet>
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
          {doc?.body.map(([h, p]) => <div key={h}><h3 className="font-extrabold mb-1">{h}</h3><p className="text-ink-soft whitespace-pre-line">{p}</p></div>)}
          <p className="text-[12px] text-ink-mute pt-2 border-t border-lav-50">시행일: 2026년 12월 1일 (초안 · 정식 출시 전 법률 검토가 필요해요)</p>
        </div>
      </Sheet>
    </div>
  )
}
