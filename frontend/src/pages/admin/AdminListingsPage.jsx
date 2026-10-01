import { useState } from 'react'
import { toast } from 'react-toastify'
import { Check, EyeOff, ImageOff, RotateCcw, X } from 'lucide-react'
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
import { formatDateTime, formatMoney } from '../../lib/format'
import { CONDITION_LABELS, LISTING_STATUS, REPORT_STATUS } from '../../lib/labels'

const ACTIONS = {
  APPROVE: { label: 'Duyệt tin', icon: Check, style: btn.primary, tone: 'primary', noteRequired: false, from: ['PENDING'] },
  REJECT: { label: 'Từ chối', icon: X, style: btn.danger, tone: 'danger', noteRequired: true, from: ['PENDING'] },
  HIDE: { label: 'Gỡ tin', icon: EyeOff, style: btn.danger, tone: 'danger', noteRequired: true, from: ['ACTIVE', 'RESERVED'] },
  RESTORE: { label: 'Khôi phục', icon: RotateCcw, style: btn.secondary, tone: 'primary', noteRequired: false, from: ['HIDDEN'] },
}

function MediaThumb({ media }) {
  const [broken, setBroken] = useState(false)
  if (broken || media.MediaType !== 'IMAGE') {
    return (
      <a href={media.MediaUrl} target="_blank" rel="noreferrer" className="grid size-24 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-center text-[11px] text-slate-500">
        <span><ImageOff size={16} className="mx-auto mb-1" />{media.MediaType === 'VIDEO' ? 'Video' : 'Không tải được'}</span>
      </a>
    )
  }
  return <img src={media.MediaUrl} alt="" onError={() => setBroken(true)} className="size-24 rounded-lg border border-slate-200 object-cover" />
}

function ListingDetail({ id, onClose, onSaved }) {
  const { data: listing, loading, error, reload } = useApi(`/admin/listings/${id}`)
  const { busy, run } = useMutation()
  const [action, setAction] = useState(null)

  const submit = async (note) => {
    try {
      const result = await run('patch', `/admin/listings/${id}/review`, { action, note })
      toast.success(result.message)
      setAction(null)
      reload()
      onSaved()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const available = listing ? Object.entries(ACTIONS).filter(([, rule]) => rule.from.includes(listing.Status)) : []

  return (
    <Modal open title={`Tin đăng #${id}`} onClose={onClose} size="max-w-3xl">
      {loading && !listing ? (
        <Loading />
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <div className="space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge map={LISTING_STATUS} value={listing.Status} />
              <Badge>{listing.Category?.CategoryName}</Badge>
              <Badge tone="blue">{CONDITION_LABELS[listing.ConditionLevel] || listing.ConditionLevel}</Badge>
            </div>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">{listing.Title}</h3>
            <p className="text-xl font-bold text-emerald-700">{formatMoney(listing.Price)}</p>
          </div>

          {listing.Media?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {listing.Media.map((media) => <MediaThumb key={media.MediaId} media={media} />)}
            </div>
          )}

          <dl className="divide-y divide-slate-100">
            <InfoRow label="Người bán">{listing.Seller?.FullName} (#{listing.SellerId}) · {listing.Seller?.Email}</InfoRow>
            <InfoRow label="Mô tả"><span className="whitespace-pre-line">{listing.Description}</span></InfoRow>
            <InfoRow label="Lỗi đã biết">{listing.KnownDefects}</InfoRow>
            <InfoRow label="Khu vực">{listing.Location}</InfoRow>
            <InfoRow label="Đăng lúc">{formatDateTime(listing.CreatedAt)}</InfoRow>
            {listing.ModerationNote && <InfoRow label="Ghi chú kiểm duyệt">{listing.ModerationNote}</InfoRow>}
          </dl>

          {listing.reports.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold">Báo cáo về tin này ({listing.reports.length})</p>
              <ul className="space-y-2">
                {listing.reports.map((report) => (
                  <li key={report.ReportId} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">#{report.ReportId} · {report.Reason}</span>
                      <StatusBadge map={REPORT_STATUS} value={report.Status} />
                      <span className="text-xs text-slate-500">{report.Reporter?.FullName} · {formatDateTime(report.CreatedAt)}</span>
                    </div>
                    {report.Description && <p className="mt-1 text-xs text-slate-600">{report.Description}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {available.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              {available.map(([key, rule]) => {
                const Icon = rule.icon
                return (
                  <button key={key} type="button" className={rule.style} onClick={() => setAction(key)}>
                    <Icon size={16} /> {rule.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(action)}
        title={`${ACTIONS[action]?.label}: ${listing?.Title || ''}`}
        message="Người bán sẽ nhận thông báo kèm ghi chú. Thao tác được ghi vào nhật ký quản trị."
        confirmText={ACTIONS[action]?.label}
        tone={ACTIONS[action]?.tone}
        reasonLabel={ACTIONS[action]?.noteRequired ? 'Lý do' : 'Ghi chú (không bắt buộc)'}
        reasonRequired={ACTIONS[action]?.noteRequired}
        busy={busy}
        onConfirm={submit}
        onClose={() => setAction(null)}
      />
    </Modal>
  )
}

export default function AdminListingsPage() {
  const [filters, setFilters] = useState({ status: 'PENDING', q: '', categoryId: '', reported: '', page: 1 })
  const [selected, setSelected] = useState(null)
  const { response, loading, error, reload } = useApi('/admin/listings', filters)
  const { data: categories } = useApi('/categories')
  const update = (patch) => setFilters((current) => ({ ...current, page: 1, ...patch }))

  const columns = [
    { key: 'ListingId', title: 'Mã', render: (row) => <span className="font-mono text-xs text-slate-500">#{row.ListingId}</span> },
    {
      key: 'Title',
      title: 'Tin đăng',
      render: (row) => (
        <div className="max-w-xs">
          <p className="truncate font-medium text-slate-900">{row.Title}</p>
          <p className="text-xs text-slate-500">{row.Seller?.FullName} · {row.Category?.CategoryName}</p>
        </div>
      ),
    },
    { key: 'Price', title: 'Giá', render: (row) => formatMoney(row.Price), className: 'whitespace-nowrap text-right tabular-nums' },
    { key: 'ConditionLevel', title: 'Tình trạng', render: (row) => CONDITION_LABELS[row.ConditionLevel] || row.ConditionLevel },
    { key: 'Status', title: 'Trạng thái', render: (row) => <StatusBadge map={LISTING_STATUS} value={row.Status} /> },
    {
      key: 'OpenReportCount',
      title: 'Báo cáo mở',
      render: (row) => (Number(row.OpenReportCount) > 0 ? <Badge tone="red">{row.OpenReportCount}</Badge> : <span className="text-slate-400">0</span>),
    },
    { key: 'CreatedAt', title: 'Đăng lúc', render: (row) => formatDateTime(row.CreatedAt), className: 'whitespace-nowrap' },
  ]

  return (
    <>
      <PageHeader code="B05" title="Kiểm duyệt tin đăng" description="Duyệt tin mới, từ chối hoặc gỡ nội dung vi phạm kèm lý do; người bán được thông báo kết quả." />
      <Card>
        <div className="p-4 pb-0">
          <StatusTabs map={LISTING_STATUS} value={filters.status} onChange={(status) => update({ status })} counts={response?.counts} />
          <FilterBar onReset={() => setFilters({ status: '', q: '', categoryId: '', reported: '', page: 1 })}>
            <SearchInput value={filters.q} onChange={(q) => update({ q })} placeholder="Tiêu đề, người bán hoặc mã tin" />
            <Field className="w-52">
              <select value={filters.categoryId} onChange={(event) => update({ categoryId: event.target.value })} className={input} aria-label="Danh mục">
                <option value="">Mọi danh mục</option>
                {categories?.map((category) => (
                  <option key={category.CategoryId} value={category.CategoryId}>{category.CategoryName}</option>
                ))}
              </select>
            </Field>
            <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="accent-emerald-600"
                checked={filters.reported === 'true'}
                onChange={(event) => update({ reported: event.target.checked ? 'true' : '' })}
              />
              Chỉ tin đang bị báo cáo
            </label>
          </FilterBar>
        </div>
        <DataTable
          columns={columns}
          rows={response?.data}
          rowKey={(row) => row.ListingId}
          onRowClick={(row) => setSelected(row.ListingId)}
          loading={loading}
          error={error}
          onRetry={reload}
        />
        <Pagination pagination={response?.pagination} onPage={(page) => setFilters((current) => ({ ...current, page }))} />
      </Card>
      {selected && <ListingDetail id={selected} onClose={() => setSelected(null)} onSaved={reload} />}
    </>
  )
}
