import { useState } from 'react'
import { toast } from 'react-toastify'
import { Download, Lock } from 'lucide-react'
import { Badge, ConfirmDialog, DataTable, Field, FilterBar, PageHeader, Pagination, Section } from '../../components/admin/AdminUi'
import { btn, input } from '../../components/admin/styles'
import { useApi } from '../../hooks/useApi'
import { downloadFile, errorMessage } from '../../lib/api'
import { cleanParams, formatDateTime, formatNumber } from '../../lib/format'

const EMPTY_FILTERS = { adminId: '', action: '', targetType: '', targetId: '', from: '', to: '' }

const show = (value) => {
  if (value === null || value === undefined || value === '') return '∅'
  if (Array.isArray(value)) return value.join(', ') || '∅'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

// Hiển thị "giá trị cũ → giá trị mới"; với object chỉ liệt kê các trường có mặt.
function ChangeView({ oldValue, newValue }) {
  if (oldValue === null && newValue === null) return <span className="text-slate-400">—</span>
  const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value)
  if (isObject(oldValue) || isObject(newValue)) {
    const keys = [...new Set([...Object.keys(oldValue || {}), ...Object.keys(newValue || {})])]
    return (
      <ul className="space-y-0.5 text-xs">
        {keys.map((key) => {
          const before = oldValue?.[key]
          const after = newValue?.[key]
          const changed = show(before) !== show(after)
          return (
            <li key={key} className="break-all">
              <span className="text-slate-500">{key}:</span>{' '}
              {oldValue && before !== undefined && changed && <><span className="text-red-700 line-through decoration-red-300">{show(before)}</span> → </>}
              <span className={changed ? 'font-medium text-emerald-800' : 'text-slate-600'}>{show(after)}</span>
            </li>
          )
        })}
      </ul>
    )
  }
  return (
    <span className="break-all text-xs">
      {oldValue !== null && <><span className="text-red-700 line-through decoration-red-300">{show(oldValue)}</span> → </>}
      <span className="font-medium text-emerald-800">{show(newValue)}</span>
    </span>
  )
}

export default function AdminAuditLogsPage() {
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  const [confirmExport, setConfirmExport] = useState(false)
  const { response, loading, error, reload } = useApi('/admin/audit-logs', { ...filters, page })
  const { data: meta } = useApi('/admin/audit-logs/meta')

  const update = (patch) => {
    setFilters((current) => ({ ...current, ...patch }))
    setPage(1)
  }
  const total = response?.pagination?.total || 0
  const exportLimit = meta?.exportLimit || 5000

  const doExport = async () => {
    setExporting(true)
    try {
      const result = await downloadFile('/admin/audit-logs/export', cleanParams(filters))
      toast.success(`Đã xuất ${formatNumber(result.exported)}/${formatNumber(result.total)} dòng nhật ký`)
      setConfirmExport(false)
    } catch (err) {
      toast.error(errorMessage(err, 'Không xuất được file'))
    } finally {
      setExporting(false)
    }
  }

  const columns = [
    { key: 'CreatedAt', title: 'Thời gian', render: (row) => formatDateTime(row.CreatedAt), className: 'whitespace-nowrap' },
    { key: 'Admin', title: 'Quản trị viên', render: (row) => row.Admin?.FullName || `#${row.AdminId}` },
    { key: 'Action', title: 'Hành động', render: (row) => <span className="font-medium text-slate-900">{row.ActionLabel}</span> },
    {
      key: 'Target',
      title: 'Đối tượng',
      render: (row) => (
        <button
          type="button"
          className="text-left hover:underline"
          title="Lọc theo đối tượng này"
          onClick={() => update({ targetType: row.TargetType, targetId: row.TargetId || '' })}
        >
          <Badge>{row.TargetTypeLabel}</Badge> <span className="font-mono text-xs">{row.TargetId || ''}</span>
        </button>
      ),
    },
    { key: 'Change', title: 'Cũ → Mới', render: (row) => <div className="max-w-xs"><ChangeView oldValue={row.OldValue} newValue={row.NewValue} /></div> },
    { key: 'Note', title: 'Ghi chú / lý do', render: (row) => <p className="max-w-xs text-xs text-slate-600">{row.Note || '—'}</p> },
  ]

  return (
    <>
      <PageHeader
        title="Nhật ký thao tác quản trị"
        description="Ai đã làm gì, khi nào: khóa tài khoản, duyệt hoàn tiền, xác nhận thu phí, gỡ tin, đổi cấu hình... Nhật ký chỉ đọc, không ai sửa hoặc xóa được."
        actions={
          <button
            type="button"
            className={btn.secondary}
            disabled={exporting || !total}
            onClick={() => (total > exportLimit ? setConfirmExport(true) : doExport())}
          >
            <Download size={16} /> {exporting ? 'Đang xuất...' : 'Xuất CSV'}
          </button>
        }
      />
      <Section title="Tìm kiếm và lọc" bodyClassName="px-4 pt-4">
          <FilterBar onReset={() => update(EMPTY_FILTERS)}>
            <Field label="Quản trị viên" className="w-48">
              <select value={filters.adminId} onChange={(event) => update({ adminId: event.target.value })} className={input}>
                <option value="">Tất cả</option>
                {meta?.admins.map((admin) => <option key={admin.UserId} value={admin.UserId}>{admin.FullName}</option>)}
              </select>
            </Field>
            <Field label="Hành động" className="w-56">
              <select value={filters.action} onChange={(event) => update({ action: event.target.value })} className={input}>
                <option value="">Tất cả</option>
                {meta?.actions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </Field>
            <Field label="Loại đối tượng" className="w-44">
              <select value={filters.targetType} onChange={(event) => update({ targetType: event.target.value })} className={input}>
                <option value="">Tất cả</option>
                {meta?.targetTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </Field>
            <Field label="Mã đối tượng" className="w-36">
              <input value={filters.targetId} onChange={(event) => update({ targetId: event.target.value.trim() })} className={input} placeholder="VD: 12" />
            </Field>
            <Field label="Từ ngày" className="w-40">
              <input type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => update({ from: event.target.value })} className={input} />
            </Field>
            <Field label="Đến ngày" className="w-40">
              <input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => update({ to: event.target.value })} className={input} />
            </Field>
          </FilterBar>
          <p className="mb-3 flex items-center gap-1.5 text-xs text-slate-500">
            <Lock size={12} /> {formatNumber(total)} dòng khớp bộ lọc · file CSV tối đa {formatNumber(exportLimit)} dòng mới nhất, mã hóa UTF-8 để Excel đọc đúng tiếng Việt.
          </p>
      </Section>
      <Section title="Nhật ký thao tác" meta={response?.pagination ? `${response.pagination.total} kết quả` : null} flush>
        <DataTable columns={columns} rows={response?.data} rowKey={(row) => row.LogId} loading={loading} error={error} onRetry={reload} empty="Chưa có thao tác nào khớp bộ lọc" />
        <Pagination pagination={response?.pagination} onPage={setPage} />
      </Section>
      <ConfirmDialog
        open={confirmExport}
        title="Xuất một phần nhật ký?"
        message={`Có ${formatNumber(total)} dòng khớp bộ lọc nhưng file chỉ chứa ${formatNumber(exportLimit)} dòng mới nhất. Thu hẹp khoảng ngày để xuất đủ.`}
        confirmText={`Xuất ${formatNumber(exportLimit)} dòng`}
        busy={exporting}
        onConfirm={doExport}
        onClose={() => setConfirmExport(false)}
      />
    </>
  )
}
