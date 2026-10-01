import { useState } from 'react'
import { toast } from 'react-toastify'
import { Lock, Unlock } from 'lucide-react'
import {
  Badge,
  Card,
  ConfirmDialog,
  DataTable,
  Field,
  FilterBar,
  InfoRow,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  StatusBadge,
} from '../../components/admin/AdminUi'
import { btn, input } from '../../components/admin/styles'
import { useApi, useMutation } from '../../hooks/useApi'
import { useDevAccount } from '../../hooks/useDevAccount'
import { errorMessage } from '../../lib/api'
import { formatDateTime, formatMoney } from '../../lib/format'
import { ROLE_LABELS, USER_STATUS } from '../../lib/labels'

const ROLES = ['USER', 'ADMIN', 'SELLER', 'DRIVER']

function RoleBadges({ roles }) {
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((role) => (
        <Badge key={role} tone={role === 'ADMIN' ? 'violet' : role === 'USER' ? 'slate' : 'blue'}>
          {ROLE_LABELS[role] || role}
        </Badge>
      ))}
    </div>
  )
}

function UserDetail({ userId, onClose, onSaved }) {
  const { me } = useDevAccount()
  const { data: user, loading, error, reload } = useApi(`/admin/users/${userId}`)
  const { busy, run } = useMutation()
  const [roleDraft, setRoleDraft] = useState(null)
  const [pending, setPending] = useState(null) // { body, title, tone }

  // Chỉ 4 vai trò chuẩn được sửa ở đây; vai trò khác backend giữ nguyên.
  const standardRoles = ['USER', ...(user?.Roles ?? []).filter((role) => ROLES.includes(role) && role !== 'USER')]
  const roles = roleDraft ?? standardRoles
  const rolesChanged = user && JSON.stringify([...roles].sort()) !== JSON.stringify([...standardRoles].sort())
  const isSelf = me?.UserId === userId

  const toggleRole = (role) => {
    if (role === 'USER') return
    setRoleDraft(roles.includes(role) ? roles.filter((item) => item !== role) : [...roles, role])
  }

  const save = async (reason) => {
    try {
      const result = await run('patch', `/admin/users/${userId}`, { ...pending.body, reason })
      toast.success(result.message)
      setPending(null)
      setRoleDraft(null)
      reload()
      onSaved()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Modal open title={user ? `Tài khoản #${user.UserId} — ${user.FullName}` : 'Chi tiết tài khoản'} onClose={onClose} size="max-w-2xl">
      {loading && !user ? (
        <Loading />
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <div className="space-y-5">
          <dl className="divide-y divide-slate-100">
            <InfoRow label="Email">{user.Email} {user.EmailVerified ? <Badge tone="green">Đã xác thực</Badge> : <Badge tone="amber">Chưa xác thực</Badge>}</InfoRow>
            <InfoRow label="Số điện thoại">{user.Phone || '—'} {user.Phone && (user.PhoneVerified ? <Badge tone="green">OTP</Badge> : <Badge tone="amber">Chưa OTP</Badge>)}</InfoRow>
            <InfoRow label="Trạng thái"><StatusBadge map={USER_STATUS} value={user.Status} /></InfoRow>
            <InfoRow label="Hoạt động">
              {user.stats.listingCount} tin · {user.stats.buyerOrderCount} đơn mua · {user.stats.sellerOrderCount} đơn bán · bị báo cáo {user.stats.reportCount} lần
            </InfoRow>
            <InfoRow label="Phí còn nợ">
              {formatMoney(user.stats.debt.outstanding)} {user.stats.debt.overLimit && <Badge tone="red">Vượt ngưỡng nợ</Badge>}
            </InfoRow>
            <InfoRow label="Ngày tạo">{formatDateTime(user.CreatedAt)}</InfoRow>
          </dl>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-900">Vai trò</p>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((role) => {
                const locked = role === 'USER' || (isSelf && role === 'ADMIN')
                return (
                  <label
                    key={role}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      roles.includes(role) ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'
                    } ${locked ? 'opacity-60' : 'cursor-pointer'}`}
                  >
                    <input type="checkbox" checked={roles.includes(role)} disabled={locked} onChange={() => toggleRole(role)} className="accent-emerald-600" />
                    {ROLE_LABELS[role]}
                  </label>
                )
              })}
            </div>
            <p className="mt-1 text-xs text-slate-500">Vai trò Người dùng luôn được giữ. Không thể tự thu hồi quyền quản trị của chính mình.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btn.primary}
              disabled={!rolesChanged}
              onClick={() => setPending({ body: { roles }, title: 'Cập nhật vai trò', tone: 'primary' })}
            >
              Lưu vai trò
            </button>
            {user.Status === 'ACTIVE' ? (
              <button
                type="button"
                className={btn.danger}
                disabled={isSelf}
                onClick={() => setPending({ body: { status: 'LOCKED' }, title: `Khóa tài khoản ${user.FullName}?`, tone: 'danger' })}
              >
                <Lock size={16} /> Khóa tài khoản
              </button>
            ) : (
              <button
                type="button"
                className={btn.secondary}
                onClick={() => setPending({ body: { status: 'ACTIVE' }, title: `Mở khóa tài khoản ${user.FullName}?`, tone: 'primary' })}
              >
                <Unlock size={16} /> Mở khóa
              </button>
            )}
          </div>

          {user.history.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-900">Lịch sử quản trị gần đây</p>
              <ul className="space-y-2 text-sm">
                {user.history.map((log) => (
                  <li key={log.LogId} className="rounded-lg bg-slate-50 px-3 py-2">
                    <span className="font-medium">{log.ActionLabel}</span> · {log.Admin?.FullName} · {formatDateTime(log.CreatedAt)}
                    {log.Note && <p className="text-xs text-slate-500">{log.Note}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        title={pending?.title}
        tone={pending?.tone}
        message="Thao tác sẽ được ghi vào nhật ký quản trị và gửi thông báo cho người dùng."
        reasonLabel="Lý do"
        reasonRequired
        busy={busy}
        onConfirm={save}
        onClose={() => setPending(null)}
      />
    </Modal>
  )
}

export default function AdminUsersPage() {
  const [filters, setFilters] = useState({ q: '', role: '', status: '', page: 1 })
  const [selected, setSelected] = useState(null)
  const { response, loading, error, reload } = useApi('/admin/users', filters)
  const update = (patch) => setFilters((current) => ({ ...current, page: 1, ...patch }))

  const columns = [
    { key: 'UserId', title: 'Mã', render: (row) => <span className="font-mono text-xs text-slate-500">#{row.UserId}</span> },
    {
      key: 'FullName',
      title: 'Tài khoản',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.FullName}</p>
          <p className="text-xs text-slate-500">{row.Email}</p>
        </div>
      ),
    },
    { key: 'Phone', title: 'Điện thoại', render: (row) => row.Phone || '—' },
    { key: 'Roles', title: 'Vai trò', render: (row) => <RoleBadges roles={row.Roles} /> },
    { key: 'Status', title: 'Trạng thái', render: (row) => <StatusBadge map={USER_STATUS} value={row.Status} /> },
    { key: 'CreatedAt', title: 'Ngày tạo', render: (row) => formatDateTime(row.CreatedAt), className: 'whitespace-nowrap' },
  ]

  return (
    <>
      <PageHeader code="B01" title="Quản lý tài khoản và phân quyền" description="Tra cứu tài khoản, khóa hoặc mở khóa, cấp hoặc thu hồi vai trò. Mọi thay đổi đều cần lý do và được ghi nhật ký." />
      <Card>
        <div className="p-4 pb-0">
          <FilterBar onReset={() => setFilters({ q: '', role: '', status: '', page: 1 })}>
            <SearchInput value={filters.q} onChange={(q) => update({ q })} placeholder="Tên, email, SĐT hoặc mã" />
            <Field className="w-40">
              <select value={filters.role} onChange={(event) => update({ role: event.target.value })} className={input} aria-label="Lọc vai trò">
                <option value="">Mọi vai trò</option>
                {ROLES.map((role) => (
                  <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                ))}
              </select>
            </Field>
            <Field className="w-40">
              <select value={filters.status} onChange={(event) => update({ status: event.target.value })} className={input} aria-label="Lọc trạng thái">
                <option value="">Mọi trạng thái</option>
                <option value="ACTIVE">Hoạt động</option>
                <option value="LOCKED">Đã khóa</option>
              </select>
            </Field>
          </FilterBar>
        </div>
        <DataTable
          columns={columns}
          rows={response?.data}
          rowKey={(row) => row.UserId}
          onRowClick={(row) => setSelected(row.UserId)}
          loading={loading}
          error={error}
          onRetry={reload}
        />
        <Pagination pagination={response?.pagination} onPage={(page) => setFilters((current) => ({ ...current, page }))} />
      </Card>
      {selected && <UserDetail userId={selected} onClose={() => setSelected(null)} onSaved={reload} />}
    </>
  )
}
