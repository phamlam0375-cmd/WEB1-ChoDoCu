import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { Check, Eye, EyeOff, ImageOff, RotateCcw, Trash2, X } from 'lucide-react'
import { Badge, ConfirmDialog, DataTable, Field, FilterBar, InfoRow, Loading, Modal, PageHeader, Pagination, SearchInput, Section, StatusBadge, StatusTabs } from '../../components/admin/AdminUi'
import { btn, input } from '../../components/admin/styles'
import ReportInfo from '../../components/report/ReportInfo'
import { useApi, useMutation } from '../../hooks/useApi'
import { errorMessage } from '../../lib/api'
import { formatDateTime, formatMoney } from '../../lib/format'
import { CONDITION_LABELS, LISTING_STATUS, REPORT_STATUS } from '../../lib/labels'

const ACTIONS = {
  APPROVE: { label: 'Duyệt tin', icon: Check, style: btn.primary, tone: 'primary', noteRequired: false, from: ['PENDING'] },
  REJECT: { label: 'Từ chối tin', icon: X, style: btn.danger, tone: 'danger', noteRequired: true, empty: 'Vui lòng nhập lý do từ chối', from: ['PENDING'] },
  HIDE: { label: 'Ẩn tin', icon: EyeOff, style: btn.secondary, tone: 'danger', noteRequired: true, from: ['ACTIVE', 'RESERVED'] },
  REMOVE: { label: 'Gỡ tin', icon: Trash2, style: btn.danger, tone: 'danger', noteRequired: true, from: ['ACTIVE', 'RESERVED', 'HIDDEN'] },
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
      const result = await run('patch', `/admin/listings/${id}/review`, { action, note, expectedStatus: listing.Status })
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

          <dl className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200">
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
        reasonEmptyMessage={ACTIONS[action]?.empty}
        busy={busy}
        onConfirm={submit}
        onClose={() => setAction(null)}
      />
    </Modal>
  )
}

// Cách xử lý một báo cáo đang xử lý: Ẩn tin, Gỡ tin (kết luận có vi phạm) hoặc Bác bỏ.
const REPORT_DECISIONS = {
  HIDE: { label: 'Ẩn tin', icon: EyeOff, style: btn.secondary, tone: 'danger', body: { status: 'RESOLVED', listingAction: 'HIDE' } },
  REMOVE: { label: 'Gỡ tin', icon: Trash2, style: btn.danger, tone: 'danger', body: { status: 'RESOLVED', listingAction: 'REMOVE' } },
  RESOLVE: { label: 'Kết luận vi phạm', icon: Check, style: btn.danger, tone: 'danger', body: { status: 'RESOLVED' } },
  DISMISS: { label: 'Bác bỏ báo cáo', icon: X, style: btn.secondary, tone: 'primary', body: { status: 'REJECTED' } },
}

function ReportHandleDetail({ id, onClose, onSaved }) {
  const { data: report, loading, error, reload } = useApi(`/admin/reports/${id}`)
  const listingId = report?.ListingId
  const { data: listing } = useApi(listingId ? `/admin/listings/${listingId}` : null)
  const { busy, run } = useMutation()
  const [decision, setDecision] = useState(null)
  const [lockUser, setLockUser] = useState(false)

  const open = report && ['PENDING', 'PROCESSING'].includes(report.Status)
  const choices = !report
    ? []
    : report.Listing && report.Listing.Status !== 'REMOVED'
      ? ['HIDE', 'REMOVE', 'DISMISS'].filter((key) => key !== 'HIDE' || report.Listing.Status !== 'HIDDEN')
      : ['RESOLVE', 'DISMISS']
  const rule = REPORT_DECISIONS[decision]
  const resolving = rule?.body.status === 'RESOLVED'

  const submit = async (note) => {
    try {
      const result = await run('patch', `/admin/reports/${id}`, {
        ...rule.body,
        resolution: note || undefined,
        lockUser: resolving && lockUser,
        expectedStatus: report.Status,
      })
      toast.success(result.message)
      setDecision(null)
      reload()
      onSaved()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Modal
      open
      title={`Xử lý báo cáo #${id}`}
      onClose={onClose}
      size="max-w-5xl"
      footer={
        open && (
          <>
            {choices.map((key) => {
              const item = REPORT_DECISIONS[key]
              const Icon = item.icon
              return (
                <button
                  key={key}
                  type="button"
                  className={item.style}
                  onClick={() => {
                    setLockUser(false)
                    setDecision(key)
                  }}
                >
                  <Icon size={16} /> {item.label}
                </button>
              )
            })}
          </>
        )
      }
    >
      {loading && !report ? (
        <Loading />
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Báo cáo</p>
            <ReportInfo report={report} />
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Tin bị báo cáo</p>
            {!listingId ? (
              <p className="text-sm text-slate-500">Báo cáo này không gắn với tin đăng.</p>
            ) : !listing ? (
              <Loading />
            ) : (
              <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge map={LISTING_STATUS} value={listing.Status} />
                  <Badge>{listing.Category?.CategoryName}</Badge>
                </div>
                <p className="font-semibold text-slate-900">{listing.Title}</p>
                <p className="text-lg font-bold text-emerald-700">{formatMoney(listing.Price)}</p>
                {listing.Media?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {listing.Media.map((media) => <MediaThumb key={media.MediaId} media={media} />)}
                  </div>
                )}
                <p className="whitespace-pre-line text-sm text-slate-600">{listing.Description}</p>
                <p className="text-xs text-slate-500">Người đăng: {listing.Seller?.FullName} · {listing.Seller?.Email}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(decision)}
        title={rule?.label}
        message={
          resolving
            ? 'Người đăng và người báo cáo đều nhận thông báo kết quả.'
            : 'Báo cáo chuyển sang "Không vi phạm", người báo cáo nhận thông báo.'
        }
        confirmText={rule?.label}
        tone={rule?.tone}
        reasonLabel={resolving ? 'Lý do' : 'Ghi chú (không bắt buộc)'}
        reasonRequired={resolving}
        busy={busy}
        onConfirm={submit}
        onClose={() => setDecision(null)}
      >
        {resolving && report?.ReportedUser && report.ReportedUser.Status !== 'LOCKED' && (
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="accent-red-600" checked={lockUser} onChange={(event) => setLockUser(event.target.checked)} />
            Khóa luôn tài khoản {report.ReportedUser.FullName}
          </label>
        )}
      </ConfirmDialog>
    </Modal>
  )
}

function ProcessingReports({ initialReportId }) {
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(initialReportId)
  const { response, loading, error, reload } = useApi('/admin/reports', { status: 'PROCESSING', page })

  const columns = [
    { key: 'ReportId', title: 'Mã', render: (row) => <span className="font-mono text-xs text-slate-500">#{row.ReportId}</span> },
    {
      key: 'target',
      title: 'Tin / đối tượng bị báo cáo',
      render: (row) => (
        <p className="max-w-xs truncate font-medium text-slate-900">
          {row.Listing ? row.Listing.Title : row.Order ? `Đơn #${row.Order.OrderId}` : row.ReportedUser?.FullName}
        </p>
      ),
    },
    { key: 'Reason', title: 'Lý do' },
    { key: 'Reporter', title: 'Người gửi', render: (row) => row.Reporter?.FullName },
    { key: 'CreatedAt', title: 'Thời gian', render: (row) => formatDateTime(row.CreatedAt), className: 'whitespace-nowrap' },
    {
      key: 'actions',
      title: '',
      render: (row) => (
        <button type="button" className={btn.ghost} onClick={(event) => { event.stopPropagation(); setSelected(row.ReportId) }}>
          <Eye size={15} /> Xem
        </button>
      ),
    },
  ]

  return (
    <>
      <Section title="Báo cáo đang xử lý" meta={response?.pagination ? `${response.pagination.total} kết quả` : null} flush>
      <DataTable
        columns={columns}
        rows={response?.data}
        rowKey={(row) => row.ReportId}
        onRowClick={(row) => setSelected(row.ReportId)}
        loading={loading}
        error={error}
        onRetry={reload}
        empty="Không có báo cáo nào đang xử lý"
      />
      <Pagination pagination={response?.pagination} onPage={setPage} />
      </Section>
      {selected && <ReportHandleDetail id={selected} onClose={() => setSelected(null)} onSaved={reload} />}
    </>
  )
}

function ListingQueue() {
  const [filters, setFilters] = useState({ status: 'PENDING', q: '', categoryId: '', page: 1 })
  const [selected, setSelected] = useState(null)
  const { response, loading, error, reload } = useApi('/admin/listings', filters)
  const { data: categories } = useApi('/categories')
  const { data: conditions } = useApi('/categories/conditions')
  const update = (patch) => setFilters((current) => ({ ...current, page: 1, ...patch }))
  const conditionLabel = (code) => conditions?.find((item) => item.value === code)?.label || CONDITION_LABELS[code] || code

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
    { key: 'ConditionLevel', title: 'Tình trạng', render: (row) => conditionLabel(row.ConditionLevel) },
    { key: 'Status', title: 'Trạng thái', render: (row) => <StatusBadge map={LISTING_STATUS} value={row.Status} /> },
    {
      key: 'OpenReportCount',
      title: 'Báo cáo mở',
      render: (row) => (Number(row.OpenReportCount) > 0 ? <Badge tone="red">{row.OpenReportCount}</Badge> : <span className="text-slate-400">0</span>),
    },
    { key: 'CreatedAt', title: 'Đăng lúc', render: (row) => formatDateTime(row.CreatedAt), className: 'whitespace-nowrap' },
    {
      key: 'actions',
      title: '',
      render: (row) => (
        <button type="button" className={btn.ghost} onClick={(event) => { event.stopPropagation(); setSelected(row.ListingId) }}>
          <Eye size={15} /> Xem tin
        </button>
      ),
    },
  ]

  return (
    <>
      <Section title="Tìm kiếm và lọc" bodyClassName="px-4 pt-4">
        <StatusTabs map={LISTING_STATUS} value={filters.status} onChange={(status) => update({ status })} counts={response?.counts} />
        <FilterBar onReset={() => setFilters({ status: 'PENDING', q: '', categoryId: '', page: 1 })}>
          <SearchInput value={filters.q} onChange={(q) => update({ q })} placeholder="Tiêu đề, người bán hoặc mã tin" />
          <Field className="w-52">
            <select value={filters.categoryId} onChange={(event) => update({ categoryId: event.target.value })} className={input} aria-label="Danh mục">
              <option value="">Mọi danh mục</option>
              {categories?.map((category) => (
                <option key={category.CategoryId} value={category.CategoryId}>{category.CategoryName}</option>
              ))}
            </select>
          </Field>
        </FilterBar>
      </Section>
      <Section title="Danh sách tin" meta={response?.pagination ? `${response.pagination.total} kết quả` : null} flush>
      <DataTable
        columns={columns}
        rows={response?.data}
        rowKey={(row) => row.ListingId}
        onRowClick={(row) => setSelected(row.ListingId)}
        loading={loading}
        error={error}
        onRetry={reload}
        empty={filters.status === 'PENDING' ? 'Không có tin nào chờ duyệt' : undefined}
      />
      <Pagination pagination={response?.pagination} onPage={(page) => setFilters((current) => ({ ...current, page }))} />
      </Section>
      {selected && <ListingDetail id={selected} onClose={() => setSelected(null)} onSaved={reload} />}
    </>
  )
}

export default function AdminListingsPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'reports' ? 'reports' : 'listings'
  const reportId = Number(params.get('report')) || null

  return (
    <>
      <PageHeader title="Kiểm duyệt tin và xử lý báo cáo" description="Duyệt tin mới hoặc từ chối kèm lý do; xem báo cáo đang xử lý cạnh tin bị báo cáo, ẩn hoặc gỡ nội dung vi phạm. Người liên quan được thông báo kết quả." />
      <Section title="Mục kiểm duyệt" flush>
        <div className="flex gap-1 px-4 pt-2" role="tablist">
          {[
            ['listings', 'Tin chờ duyệt'],
            ['reports', 'Báo cáo đang xử lý'],
          ].map(([key, text]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setParams(key === 'reports' ? { tab: 'reports' } : {})}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${tab === key ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              {text}
            </button>
          ))}
        </div>
      </Section>
      {tab === 'reports' ? <ProcessingReports key={reportId || 'all'} initialReportId={reportId} /> : <ListingQueue />}
    </>
  )
}
