import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { useDevAccount } from '../hooks/useDevAccount'
import { ROLE_LABELS } from '../lib/labels'
import { btn, input } from './admin/styles'

// Ô chọn tài khoản thử nghiệm (tạm thay đăng nhập). compact = dạng gọn trên thanh tiêu đề.
export default function DevAccountSwitcher({ compact = false }) {
  const { userId, me, error, switchUser } = useDevAccount()
  const [draft, setDraft] = useState(userId)

  const submit = (event) => {
    event.preventDefault()
    const id = Number(draft)
    if (Number.isInteger(id) && id > 0) switchUser(id)
  }

  return (
    <form onSubmit={submit} className={`flex flex-wrap items-center gap-2 ${compact ? '' : 'rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3'}`}>
      <KeyRound size={16} className="shrink-0 text-amber-600" aria-hidden="true" />
      <span className="text-xs text-slate-600">
        {me ? (
          <>
            <b className="text-slate-900">{me.FullName}</b> (#{me.UserId}) · {me.roles.map((role) => ROLE_LABELS[role] || role).join(', ')}
          </>
        ) : error ? (
          <span className="text-red-600">{error}</span>
        ) : (
          'Tài khoản thử nghiệm'
        )}
      </span>
      <input
        type="number"
        min="1"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        className={`${input.replace('w-full', 'w-24')} py-1.5`}
        placeholder="Mã TK"
        aria-label="Mã tài khoản thử nghiệm"
      />
      <button type="submit" className={`${btn.secondary} py-1.5`}>
        Đổi
      </button>
      {userId && (
        <button type="button" className={`${btn.ghost} py-1.5`} onClick={() => switchUser('')}>
          Thoát
        </button>
      )}
    </form>
  )
}
