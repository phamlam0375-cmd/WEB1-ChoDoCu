import { useState } from 'react'
import { KeyRound, LogOut, UserCircle2 } from 'lucide-react'
import { useDevAccount } from '../hooks/useDevAccount'
import { ROLE_LABELS } from '../lib/labels'
import { btn, input } from './admin/styles'

// Đã đăng nhập thật: hiện người đang đăng nhập và nút Đăng xuất (không còn ô tài khoản thử nghiệm).
// Bộ chọn dev không thay danh tính JWT của phiên thật.
function SessionAccount({ compact, me, error, logout }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? '' : 'rounded-xl border border-emerald-200 bg-emerald-50 p-3'}`}>
      <UserCircle2 size={18} className="shrink-0 text-emerald-600" aria-hidden="true" />
      <span className="text-xs text-slate-600">
        {me ? (
          <>
            <b className="text-slate-900">{me.FullName}</b> · {me.roles.map((role) => ROLE_LABELS[role] || role).join(', ')}
          </>
        ) : error ? (
          <span className="text-red-600">{error}</span>
        ) : (
          'Đang tải tài khoản...'
        )}
      </span>
      <button type="button" className={`${btn.ghost} py-1.5`} onClick={logout}>
        <LogOut size={15} /> Đăng xuất
      </button>
    </div>
  )
}

// Ô chọn tài khoản thử nghiệm (tạm thay đăng nhập). compact = dạng gọn trên thanh tiêu đề.
export default function DevAccountSwitcher({ compact = false }) {
  const { userId, loggedIn, me, error, switchUser, logout } = useDevAccount()
  const [draft, setDraft] = useState(loggedIn ? '' : userId)

  if (loggedIn) return <SessionAccount compact={compact} me={me} error={error} logout={logout} />

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
