// 랜덤 매칭 상대 신고 · 차단 (결과 화면, 대기실에서 사용)
import { useState, type ReactNode } from 'react'
import icReport from '../assets/icons/report.webp'
import icBlock from '../assets/icons/user-block.webp'
import { track } from '../lib/analytics'
import { blockPlayer, isBlocked, REPORT_REASONS, reportPlayer, type ReportReason } from '../lib/safety'
import { useStore } from '../store'
import { Button, ConfirmSheet, Sheet } from './ui'

/** variant 'row': 결과 화면 버튼 두 개 / 'wrap': children(상대 프로필)을 누르면 메뉴 */
interface Props { oppName: string; game: string; room: string; compact?: boolean; variant?: 'row' | 'wrap'; children?: ReactNode; className?: string }

export function SafetyActions({ oppName, game, room, compact = false, variant = 'row', children, className = '' }: Props) {
  const oppMid = useStore((s) => s.matchOpp)
  const { leaveRoom, showToast } = useStore()
  const [sheet, setSheet] = useState<'menu' | 'report' | 'block' | null>(null)
  if (!oppMid) return variant === 'wrap' ? <div className={className}>{children}</div> : null

  const doBlock = async (andLeave: boolean, msg = `${oppName}님을 차단했어요. 다시 매칭되지 않아요`) => {
    await blockPlayer(oppMid, oppName)
    track('player_block', { game })
    if (andLeave) leaveRoom(msg); else showToast(msg)
  }

  const btn = 'flex items-center justify-center gap-1.5 rounded-full font-bold text-ink-soft active:scale-95 transition'
  const menuRow = 'w-full flex items-center gap-3 rounded-2xl bg-white px-4 h-14 text-left text-[15.5px] font-bold text-ink active:scale-[.98] transition'
  return (
    <>
      {variant === 'wrap' ? (
        <button type="button" aria-label={`${oppName}님 신고 · 차단`} aria-haspopup="dialog" onClick={() => setSheet('menu')} className={`${className} text-left active:scale-[.97] transition`}>
          {children}
        </button>
      ) : (
      <div className={`flex justify-center ${compact ? 'gap-1' : 'gap-2'}`}>
        <button type="button" className={`${btn} ${compact ? 'h-9 px-2.5 text-[12.5px]' : 'h-10 px-3.5 text-[13.5px]'} hover:bg-white/70`} onClick={() => setSheet('report')}>
          <img src={icReport} alt="" className={compact ? 'w-5 h-5' : 'w-6 h-6'} />신고하기
        </button>
        <button type="button" className={`${btn} ${compact ? 'h-9 px-2.5 text-[12.5px]' : 'h-10 px-3.5 text-[13.5px]'} hover:bg-white/70`} onClick={() => setSheet('block')}>
          <img src={icBlock} alt="" className={compact ? 'w-5 h-5' : 'w-6 h-6'} />차단하기
        </button>
      </div>
      )}
      <Sheet open={sheet === 'menu'} onClose={() => setSheet(null)} title={`${oppName}님에게 문제가 있나요?`}>
        <p className="text-[13.5px] text-ink-soft -mt-1 mb-3">게임은 계속 진행 중이에요. 상대에게는 알려지지 않아요.</p>
        <div className="flex flex-col gap-2">
          <button type="button" className={menuRow} onClick={() => setSheet('report')}><img src={icReport} alt="" className="w-7 h-7" />신고하기</button>
          <button type="button" className={menuRow} onClick={() => setSheet('block')}><img src={icBlock} alt="" className="w-7 h-7" />차단하고 나가기</button>
        </div>
      </Sheet>
      <ReportSheet open={sheet === 'report'} onClose={() => setSheet(null)} oppName={oppName}
        onSubmit={async (reason, detail, alsoBlock) => {
          const ok = await reportPlayer({ target: oppMid, name: oppName, reason, detail, game, room })
          track('player_report', { game, reason })
          setSheet(null)
          if (!ok) { showToast('신고를 보내지 못했어요. 잠시 후 다시 시도해 주세요'); return }
          if (alsoBlock && !isBlocked(oppMid)) await doBlock(true, '신고가 접수됐고, 차단했어요')
          else showToast('신고가 접수됐어요. 확인 후 조치할게요')
        }} />
      <ConfirmSheet open={sheet === 'block'} onClose={() => setSheet(null)}
        title={`${oppName}님을 차단할까요?`}
        desc={'차단하면 이 방에서 나가고, 앞으로 랜덤 매칭에서 다시 만나지 않아요.\n설정 > 차단 목록에서 풀 수 있어요.'}
        confirm="차단하고 나가기" onConfirm={() => { setSheet(null); void doBlock(true) }} />
    </>
  )
}

function ReportSheet({ open, onClose, oppName, onSubmit }: { open: boolean; onClose: () => void; oppName: string; onSubmit: (r: ReportReason, detail: string, alsoBlock: boolean) => Promise<void> }) {
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [detail, setDetail] = useState('')
  const [alsoBlock, setAlsoBlock] = useState(true)
  const [busy, setBusy] = useState(false)
  const close = () => { if (busy) return; onClose(); setReason(null); setDetail(''); setAlsoBlock(true) }
  return (
    <Sheet open={open} onClose={close} title={`${oppName}님 신고하기`}>
      <p className="text-[13.5px] text-ink-soft -mt-1 mb-3">어떤 문제가 있었나요? 신고한 사실은 상대에게 알려지지 않아요.</p>
      <div className="flex flex-col gap-2" role="radiogroup">
        {REPORT_REASONS.map((r) => (
          <button key={r.id} type="button" role="radio" aria-checked={reason === r.id} onClick={() => setReason(r.id)}
            className={`flex items-center gap-3 rounded-2xl px-4 h-12 text-left text-[15px] font-bold transition ${reason === r.id ? 'bg-lav-100 ring-2 ring-lav-400 text-ink' : 'bg-white text-ink-soft'}`}>
            <span className={`w-5 h-5 rounded-full border-2 grid place-items-center ${reason === r.id ? 'border-lav-500' : 'border-lav-200'}`}>
              {reason === r.id && <span className="w-2.5 h-2.5 rounded-full bg-lav-500" />}
            </span>
            {r.label}
          </button>
        ))}
      </div>
      <textarea value={detail} onChange={(e) => setDetail(e.target.value.slice(0, 200))} rows={3} placeholder="자세한 내용 (선택)"
        className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-lav-300 resize-none" />
      <div className="flex justify-between items-center mt-1">
        <label className="flex items-center gap-2 text-[14px] font-bold text-ink-soft cursor-pointer select-none">
          <input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} className="w-4 h-4 accent-[#8B6FE8]" />
          차단하고 방에서 나가기
        </label>
        <span className="text-[12px] text-ink-mute tabular-nums">{detail.length}/200</span>
      </div>
      <Button className="w-full mt-4" disabled={!reason || busy} onClick={async () => { if (!reason) return; setBusy(true); try { await onSubmit(reason, detail.trim(), alsoBlock) } finally { setBusy(false); setReason(null); setDetail(''); setAlsoBlock(true) } }}>
        {busy ? '보내는 중…' : '신고하기'}
      </Button>
    </Sheet>
  )
}
