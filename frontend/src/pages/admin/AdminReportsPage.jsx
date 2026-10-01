import { useState } from 'react'
import { toast } from 'react-toastify'
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
  StatusTabs,
} from '../../components/admin/AdminUi'
import { btn, input } from '../../components/admin/styles'
import { useApi, useMutation } from '../../hooks/useApi'
import { errorMessage } from '../../lib/api'
import { formatDateTime } from '../../lib/format'
import { LISTING_STATUS, ORDER_STATUS, REPORT_STATUS, REPORT_TARGET, USER_STATUS } from '../../lib/labels'

function ReportDetail({ id, onClose, onSaved }) {
  const { data: report, loading, error, reload } = useApi(`/admin/reports/${id}`)
  const { busy, run } = useMutation()
  const [form, setForm] = useState({ status: 'RESOLVED', resolution: '', hideListing: false, lockUser: false })
  const [formError, setFormError] = useState('')
  const [confirming, setConfirming] = useState(false)

  const open = report && ['PENDING', 'PROCESSING'].includes(report.Status)
  const hideListing = form.status === 'RESOLVED' && form.hideListing
  const lockUser = form.status === 'RESOLVED' && form.lockUser
  const effects = [hideListing && 'ẩn tin đăng', lockUser && 'khóa tài khoản bị báo cáo'].filter(Boolean)

  const send = async () => {
    try {
      const result = await run('patch', `/admin/reports/${id}`, {
        status: form.status,
        resolution: form.resolution.trim() || undefined,
        hideListing,
        lockUser,
      })
      toast.success(result.message)
      setConfirming(false)
      reload()
      onSaved()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const submit = (event) => {
    event.preventDefault()
    if (form.status !== 'PROCESSING' && form.resolution.trim().length < 5) {
      setFormError('Vui lòng nhập kết quả xử lý (ít nhất 5 ký tự)')
      return
    }
    setFormError('')
    // Ẩn tin hoặc khóa tài khoản là thao tác nặng: hỏi lại trước khi gửi.
    if (effects.length) setConfirming(true)
    else send()
  }

  return (
    <Modal open title={`Báo cáo vi phạm #${id}`} onClose={onClose} size="max-w-2xl">
      {loading && !report ? (
        <Loading />
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="blue">{REPORT_TARGET[report.TargetType]}</Badge>
            <StatusBadge map={REPORT_STATUS} value={report.Status} />
            <span className="text-sm font-semibold text-slate-900">{report.Reason}</span>
          </div>
          <dl className="divide-y divide-slate-100">
            <InfoRow label="Người gửi">{report.Reporter?.FullName} (#{report.ReporterId}) · {formatDateTime(report.CreatedAt)}</InfoRow>
            <InfoRow label="Mô tả">{report.Description}</InfoRow>
            <InfoRow label="Bằng chứng">
              {report.EvidenceUrl ? <a href={report.EvidenceUrl} target="_blank" rel="noreferrer" className="text-emerald-700 underline">Mở bằng chứng</a> : '—'}
            </InfoRow>
            {report.Listing && (
              <InfoRow label="Tin đăng">
                #{report.Listing.ListingId} {report.Listing.Title} <StatusBadge map={LISTING_STATUS} value={report.Listing.Status} />
                <span className="block text-xs text-slate-500">Bị báo cáo {report.related.reportsAgainstListing} lần</span>
              </InfoRow>
            )}
            {report.ReportedUser && (
              <InfoRow label="Tài khoản bị báo cáo">
                {report.ReportedUser.FullName} (#{report.ReportedUser.UserId}) <StatusBadge map={USER_STATUS} value={report.ReportedUser.Status} />
                <span className="block text-xs text-slate-500">Bị báo cáo {report.related.reportsAgainstUser} lần</span>
              </InfoRow>
            )}
            {report.Order && <InfoRow label="Đơn hàng">#{report.Order.OrderId} · {ORDER_STATUS[report.Order.Status] || report.Order.Status}</InfoRow>}
            {report.Resolution && <InfoRow label="Kết quả xử lý">{report.Resolution}</InfoRow>}
            {report.Handler && <InfoRow label="Người xử lý">{report.Handler.FullName} · {formatDateTime(report.HandledAt)}</InfoRow>}
          </dl>

          {open && (
            <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">Xử lý báo cáo</p>
              <div className="flex flex-wrap gap-2">
                {[
                  ['PROCESSING', 'Tiếp nhận, đang xem xét'],
                  ['RESOLVED', 'Có vi phạm'],
                  ['REJECTED', 'Bác bỏ'],
                ]
                  .filter(([value]) => value !== 'PROCESSING' || report.Status === 'PENDING')
                  .map(([value, text]) => (
                    <label key={value} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${form.status === value ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}>
                      <input type="radio" name="status" value={value} checked={form.status === value} onChange={() => setForm({ ...form, status: value })} className="accent-emerald-600" />
                      {text}
                    </label>
                  ))}
              </div>
              <Field label={`Kết quả xử lý${form.status === 'PROCESSING' ? ' (không bắt buộc)' : ' *'}`} error={formError}>
                <textarea rows={3} value={form.resolution} onChange={(event) => setForm({ ...form, resolution: event.target.value })} className={input} maxLength={1000} />
              </Field>
              {form.status === 'RESOLVED' && (
                <div className="space-y-2 text-sm">
                  {report.Listing && report.Listing.Status !== 'HIDDEN' && (
                    <label className="flex items-center gap-2">
                      <input type="checkbox" className="accent-red-600" checked={form.hideListing} onChange={(event) => setForm({ ...form, hideListing: event.target.checked })} />
                      Ẩn (gỡ) tin đăng #{report.Listing.ListingId}
                    </label>
                  )}
                  {report.ReportedUser && report.ReportedUser.Status !== 'LOCKED' && (
                    <label className="flex items-center gap-2">
                      <input type="checkbox" className="accent-red-600" checked={form.lockUser} onChange={(event) => setForm({ ...form, lockUser: event.target.checked })} />
                      Khóa tài khoản {report.ReportedUser.FullName}
                    </label>
                  )}
                </div>
              )}
              <div className="flex justify-end">
                <button type="submit" className={btn.primary} disabled={busy}>Lưu kết quả</button>
              </div>
            </form>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirming}
        title="Kết luận có vi phạm"
        message={`Hệ thống sẽ ${effects.join(' và ')}. Người liên quan nhận thông báo và thao tác được ghi nhật ký.`}
        confirmText="Xác nhận"
        tone="danger"
        busy={busy}
        onConfirm={send}
        onClose={() => setConfirming(false)}
      />
    </Modal>
  )
}

export default function AdminReportsPage() {
  const [filters, setFilters] = useState({ status: 'PENDING', targetType: '', reason: '', q: '', from: '', to: '', page: 1 })
  const [selected, setSelected] = useState(null)
  const { response, loading, error, reload } = useApi('/admin/reports', filters)
  const { data: reasons } = useApi('/reports/reasons')
  const update = (patch) => setFilters((current) => ({ ...current, page: 1, ...patch }))

  const columns = [
    { key: 'ReportId', title: 'Mã', render: (row) => <span className="font-mono text-xs text-slate-500">#{row.ReportId}</span> },
    { key: 'TargetType', title: 'Đối tượng', render: (row) => <Badge tone="blue">{REPORT_TARGET[row.TargetType]}</Badge> },
    {
      key: 'target',
      title: 'Nội dung bị báo cáo',
      render: (row) => (
        <div className="max-w-xs">
          <p className="truncate font-medium text-slate-900">
            {row.Order ? `Đơn #${row.Order.OrderId}` : row.Listing ? row.Listing.Title : row.ReportedUser?.FullName}
          </p>
          {row.ReportedUser && <p className="text-xs text-slate-500">Tài khoản: {row.ReportedUser.FullName}</p>}
        </div>
      ),
    },
    { key: 'Reason', title: 'Lý do' },
    { key: 'Reporter', title: 'Người gửi', render: (row) => row.Reporter?.FullName },
    { key: 'Status', title: 'Trạng thái', render: (row) => <StatusBadge map={REPORT_STATUS} value={row.Status} /> },
    { key: 'CreatedAt', title: 'Ngày gửi', render: (row) => formatDateTime(row.CreatedAt), className: 'whitespace-nowrap' },
  ]

  return (
    <>
      <PageHeader code="B04 · B05" title="Báo cáo vi phạm" description="Tiếp nhận báo cáo tin đăng, tài khoản hoặc giao dịch; xem xét, ẩn nội dung hoặc khóa tài khoản vi phạm và thông báo kết quả cho người gửi." />
      <Card>
        <div className="p-4 pb-0">
          <StatusTabs map={REPORT_STATUS} value={filters.status} onChange={(status) => update({ status })} counts={response?.counts} />
          <FilterBar onReset={() => setFilters({ status: '', targetType: '', reason: '', q: '', from: '', to: '', page: 1 })}>
            <SearchInput value={filters.q} onChange={(q) => update({ q })} placeholder="Tiêu đề tin, tên hoặc mã" />
            <Field className="w-36">
              <select value={filters.targetType} onChange={(event) => update({ targetType: event.target.value })} className={input} aria-label="Loại đối tượng">
                <option value="">Mọi đối tượng</option>
                {Object.entries(REPORT_TARGET).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
              </select>
            </Field>
            <Field className="w-48">
              <select value={filters.reason} onChange={(event) => update({ reason: event.target.value })} className={input} aria-label="Lý do">
                <option value="">Mọi lý do</option>
                {reasons?.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
              </select>
            </Field>
            <Field label="Từ ngày" className="w-40">
              <input type="date" value={filters.from} onChange={(event) => update({ from: event.target.value })} className={input} />
            </Field>
            <Field label="Đến ngày" className="w-40">
              <input type="date" value={filters.to} onChange={(event) => update({ to: event.target.value })} className={input} />
            </Field>
          </FilterBar>
        </div>
        <DataTable
          columns={columns}
          rows={response?.data}
          rowKey={(row) => row.ReportId}
          onRowClick={(row) => setSelected(row.ReportId)}
          loading={loading}
          error={error}
          onRetry={reload}
        />
        <Pagination pagination={response?.pagination} onPage={(page) => setFilters((current) => ({ ...current, page }))} />
      </Card>
      {selected && <ReportDetail id={selected} onClose={() => setSelected(null)} onSaved={reload} />}
    </>
  )
}
