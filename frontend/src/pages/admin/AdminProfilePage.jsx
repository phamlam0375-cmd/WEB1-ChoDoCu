import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, CalendarClock, FileClock, KeyRound } from 'lucide-react'
import { Badge, DataTable, ErrorState, InfoRow, Loading, PageHeader, Pagination, Section, StatCard, StatusBadge } from '../../components/admin/AdminUi'
import { btn } from '../../components/admin/styles'
import { useApi } from '../../hooks/useApi'
import { useDevAccount } from '../../hooks/useDevAccount'
import { formatDateTime, formatNumber } from '../../lib/format'
import { ROLE_LABELS, USER_STATUS } from '../../lib/labels'

// Hồ sơ của quản trị viên đang đăng nhập: thông tin tài khoản, tóm tắt và lịch sử thao tác của chính mình (B11).
export default function AdminProfilePage() {
  const { me } = useDevAccount()
  const userId = me?.UserId
  const [page, setPage] = useState(1)
  const { data: user, error: userError } = useApi(userId ? `/admin/users/${userId}` : null)
  const { data: activity } = useApi(userId ? '/admin/my-activity' : null, { u: userId })
  const logs = useApi(userId ? '/admin/audit-logs' : null, { adminId: userId, page })

  if (!me) return <Loading />
  if (userError) return <ErrorState message={userError} />

  const columns = [
    { key: 'CreatedAt', title: 'Thời gian', sortable: true, render: (row) => formatDateTime(row.CreatedAt), className: 'whitespace-nowrap' },
    { key: 'ActionLabel', title: 'Thao tác', sortable: true, render: (row) => <span className="font-medium text-slate-900">{row.ActionLabel}</span> },
    { key: 'Target', title: 'Đối tượng', render: (row) => `${row.TargetTypeLabel}${row.TargetId ? ` #${row.TargetId}` : ''}` },
    { key: 'Note', title: 'Ghi chú', render: (row) => <p className="max-w-xs text-xs text-slate-600">{row.Note || '—'}</p> },
  ]

  return (
    <>
      <PageHeader
        title="Hồ sơ của tôi"
        description="Thông tin tài khoản quản trị đang đăng nhập và các thao tác bạn đã thực hiện trên trang quản trị."
        actions={
          <Link to="/forgot-password" className={btn.secondary}>
            <KeyRound size={16} /> Đổi mật khẩu
          </Link>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
        <Section title="Thông tin tài khoản" className="!mb-0" flush>
          {!user ? (
            <Loading />
          ) : (
            <dl className="divide-y divide-slate-200">
              <InfoRow label="Họ và tên">{user.FullName}</InfoRow>
              <InfoRow label="Mã tài khoản">#{user.UserId}</InfoRow>
              <InfoRow label="Email">{user.Email}</InfoRow>
              <InfoRow label="Điện thoại">{user.Phone}</InfoRow>
              <InfoRow label="Vai trò">
                <span className="flex flex-wrap gap-1">
                  {me.roles.map((role) => <Badge key={role} tone={role === 'ADMIN' ? 'red' : 'slate'}>{ROLE_LABELS[role] || role}</Badge>)}
                </span>
              </InfoRow>
              <InfoRow label="Trạng thái"><StatusBadge map={USER_STATUS} value={user.Status} /></InfoRow>
              <InfoRow label="Ngày tạo">{formatDateTime(user.CreatedAt)}</InfoRow>
            </dl>
          )}
        </Section>

        <Section title="Hoạt động của tôi" className="!mb-0">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Tổng thao tác" value={formatNumber(activity?.total)} icon={FileClock} tone="blue" />
            <StatCard label="30 ngày qua" value={formatNumber(activity?.last30Days)} icon={Activity} tone="green" />
            <StatCard
              label="Lần gần nhất"
              value={activity?.lastActionAt ? formatDateTime(activity.lastActionAt) : '—'}
              icon={CalendarClock}
            />
          </div>
          {activity?.byAction?.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold text-slate-700">Thao tác làm nhiều nhất</p>
              <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 text-sm">
                {activity.byAction.map((item) => (
                  <li key={item.action} className="flex items-center justify-between px-3 py-2">
                    <span>{item.label}</span>
                    <span className="font-semibold tabular-nums">{formatNumber(item.count)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      </div>

      <Section
        title="Lịch sử thao tác của tôi"
        meta={logs.response?.pagination ? `${logs.response.pagination.total} thao tác` : null}
        className="mt-5"
        actions={
          <Link to={`/admin/audit-logs`} className={`${btn.ghost} py-1`}>
            Xem toàn bộ nhật ký
          </Link>
        }
        flush
      >
        <DataTable
          columns={columns}
          rows={logs.response?.data}
          rowKey={(row) => row.LogId}
          loading={logs.loading}
          error={logs.error}
          onRetry={logs.reload}
          empty="Bạn chưa có thao tác nào"
        />
        <Pagination pagination={logs.response?.pagination} onPage={setPage} />
      </Section>
    </>
  )
}
