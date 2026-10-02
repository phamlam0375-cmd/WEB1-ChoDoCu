import { useState } from 'react'
import { toast } from 'react-toastify'
import { AlertTriangle, Check, Eye, FileQuestion, X, ZoomIn } from 'lucide-react'
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
import { demoIdentityImage } from '../../lib/demoIdentity'
import { formatDateTime } from '../../lib/format'
import { PARTNER_STATUS, PARTNER_TYPE, ROLE_LABELS } from '../../lib/labels'

const DECISIONS = {
  APPROVED: { title: 'Duyệt hồ sơ đối tác này?', confirm: 'Xác nhận duyệt', tone: 'primary', reasonRequired: false, message: 'Tài khoản sẽ được cấp vai trò tương ứng và nhận thông báo.' },
  NEED_INFO: { title: 'Yêu cầu bổ sung hồ sơ', confirm: 'Yêu cầu bổ sung', tone: 'primary', reasonRequired: true, empty: 'Vui lòng nhập nội dung cần bổ sung', message: 'Người đăng ký sẽ nhận thông báo kèm nội dung cần bổ sung.' },
  REJECTED: { title: 'Từ chối hồ sơ', confirm: 'Từ chối', tone: 'danger', reasonRequired: true, empty: 'Vui lòng nhập lý do từ chối', message: 'Người đăng ký sẽ nhận thông báo kèm lý do từ chối.' },
}

// Ảnh giấy tờ: bấm để phóng to. Ảnh gốc không tải được (dữ liệu mẫu) thì hiện ảnh minh họa.
function IdentityImage({ app }) {
  const [broken, setBroken] = useState(false)
  const [zoom, setZoom] = useState(false)
  const demo = !app.IdentityImageUrl || broken
  const src = demo
    ? demoIdentityImage({
        id: app.ApplicationId,
        fullName: app.Applicant?.FullName,
        partnerType: app.PartnerType,
        maskedNumber: app.IdentityNumberMasked || '***',
      })
    : app.IdentityImageUrl

  return (
    <>
      <button type="button" onClick={() => setZoom(true)} className="group relative block" aria-label="Phóng to ảnh giấy tờ">
        <img
          src={src}
          alt="Ảnh giấy tờ tùy thân"
          onError={() => setBroken(true)}
          className="max-h-48 rounded-lg border border-slate-200 object-contain transition group-hover:opacity-90"
        />
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-slate-900/70 px-2 py-1 text-xs text-white">
          <ZoomIn size={13} /> Xem ảnh
        </span>
      </button>
      {demo && <span className="mt-1 block text-xs text-slate-500">Ảnh minh họa — hồ sơ mẫu chưa có ảnh giấy tờ thật.</span>}
      {zoom && (
        <Modal open title={`Ảnh giấy tờ — ${app.Applicant?.FullName || ''}`} onClose={() => setZoom(false)} size="max-w-4xl">
          <img src={src} alt="Ảnh giấy tờ tùy thân phóng to" className="mx-auto w-full rounded-lg object-contain" />
          {!demo && (
            <a href={src} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-emerald-700 underline">
              Mở ảnh gốc trong tab mới
            </a>
          )}
        </Modal>
      )}
    </>
  )
}

function ApplicationDetail({ id, onClose, onSaved }) {
  const { data: app, loading, error, reload } = useApi(`/admin/partner-applications/${id}`)
  const { busy, run } = useMutation()
  const [decision, setDecision] = useState(null)

  const submit = async (note) => {
    try {
      const result = await run('patch', `/admin/partner-applications/${id}`, { status: decision, note, expectedStatus: app.Status })
      toast.success(result.message)
      setDecision(null)
      reload()
      onSaved()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const applicant = app?.Applicant
  const reviewable = app && ['PENDING', 'NEED_INFO'].includes(app.Status)
  const unverified = applicant && (!applicant.EmailVerified || !applicant.PhoneVerified)

  return (
    <Modal open title={`Hồ sơ đối tác #${id}`} onClose={onClose} size="max-w-2xl">
      {loading && !app ? (
        <Loading />
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="blue">{PARTNER_TYPE[app.PartnerType]}</Badge>
            <StatusBadge map={PARTNER_STATUS} value={app.Status} />
            <span className="text-xs text-slate-500">Gửi lúc {formatDateTime(app.SubmittedAt)}</span>
          </div>

          {unverified && reviewable && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              Hồ sơ chưa xác thực email hoặc số điện thoại, không thể duyệt.
            </p>
          )}

          <dl className="divide-y divide-slate-100">
            <InfoRow label="Người đăng ký">{applicant.FullName} (#{applicant.UserId})</InfoRow>
            <InfoRow label="Email">
              {applicant.Email} {applicant.EmailVerified ? <Badge tone="green">Đã xác thực</Badge> : <Badge tone="amber">Chưa xác thực</Badge>}
            </InfoRow>
            <InfoRow label="Số điện thoại">
              {applicant.Phone || '—'} {applicant.PhoneVerified ? <Badge tone="green">Đã OTP</Badge> : <Badge tone="amber">Chưa OTP</Badge>}
            </InfoRow>
            <InfoRow label="Vai trò hiện có">{app.currentRoles.map((role) => ROLE_LABELS[role] || role).join(', ') || '—'}</InfoRow>
            <InfoRow label="Số giấy tờ (che)">{app.IdentityNumberMasked}</InfoRow>
            <InfoRow label="Ảnh giấy tờ">
              <IdentityImage app={app} />
            </InfoRow>
            {app.ReviewNote && <InfoRow label="Ghi chú xét duyệt">{app.ReviewNote}</InfoRow>}
            {app.Reviewer && <InfoRow label="Người duyệt">{app.Reviewer.FullName} · {formatDateTime(app.ReviewedAt)}</InfoRow>}
          </dl>

          {app.history.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold">Hồ sơ trước đây của tài khoản</p>
              <ul className="space-y-1 text-sm">
                {app.history.map((item) => (
                  <li key={item.ApplicationId} className="flex flex-wrap items-center gap-2">
                    #{item.ApplicationId} · {PARTNER_TYPE[item.PartnerType]} <StatusBadge map={PARTNER_STATUS} value={item.Status} />
                    <span className="text-xs text-slate-500">{formatDateTime(item.SubmittedAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {reviewable && (
            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <button type="button" className={btn.primary} onClick={() => setDecision('APPROVED')}>
                <Check size={16} /> Duyệt
              </button>
              {app.Status !== 'NEED_INFO' && (
                <button type="button" className={btn.secondary} onClick={() => setDecision('NEED_INFO')}>
                  <FileQuestion size={16} /> Yêu cầu bổ sung
                </button>
              )}
              <button type="button" className={btn.danger} onClick={() => setDecision('REJECTED')}>
                <X size={16} /> Từ chối
              </button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(decision)}
        title={DECISIONS[decision]?.title}
        message={DECISIONS[decision]?.message}
        confirmText={DECISIONS[decision]?.confirm}
        tone={DECISIONS[decision]?.tone}
        reasonLabel={decision === 'APPROVED' ? 'Ghi chú (không bắt buộc)' : decision === 'NEED_INFO' ? 'Nội dung cần bổ sung' : 'Lý do từ chối'}
        reasonRequired={DECISIONS[decision]?.reasonRequired}
        reasonEmptyMessage={DECISIONS[decision]?.empty}
        busy={busy}
        onConfirm={submit}
        onClose={() => setDecision(null)}
      />
    </Modal>
  )
}

export default function AdminPartnerApplicationsPage() {
  const [filters, setFilters] = useState({ status: 'PENDING', type: '', q: '', page: 1 })
  const [selected, setSelected] = useState(null)
  const { response, loading, error, reload } = useApi('/admin/partner-applications', filters)
  const update = (patch) => setFilters((current) => ({ ...current, page: 1, ...patch }))

  const columns = [
    { key: 'ApplicationId', title: 'Mã', render: (row) => <span className="font-mono text-xs text-slate-500">#{row.ApplicationId}</span> },
    {
      key: 'Applicant',
      title: 'Người đăng ký',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.Applicant?.FullName}</p>
          <p className="text-xs text-slate-500">{row.Applicant?.Email}</p>
        </div>
      ),
    },
    { key: 'PartnerType', title: 'Loại', render: (row) => PARTNER_TYPE[row.PartnerType] },
    {
      key: 'verify',
      title: 'Xác thực',
      render: (row) => (
        <div className="flex gap-1">
          <Badge tone={row.Applicant?.EmailVerified ? 'green' : 'amber'}>Email</Badge>
          <Badge tone={row.Applicant?.PhoneVerified ? 'green' : 'amber'}>SĐT</Badge>
          <Badge tone={row.IdentityImageUrl ? 'green' : 'slate'}>Giấy tờ</Badge>
        </div>
      ),
    },
    { key: 'Status', title: 'Trạng thái', render: (row) => <StatusBadge map={PARTNER_STATUS} value={row.Status} /> },
    { key: 'SubmittedAt', title: 'Ngày gửi', render: (row) => formatDateTime(row.SubmittedAt), className: 'whitespace-nowrap' },
    {
      key: 'actions',
      title: '',
      render: (row) => (
        <button type="button" className={btn.ghost} onClick={(event) => { event.stopPropagation(); setSelected(row.ApplicationId) }}>
          <Eye size={15} /> Xem hồ sơ
        </button>
      ),
    },
  ]

  return (
    <>
      <PageHeader title="Duyệt đăng ký đối tác" description="Kiểm tra email, số điện thoại (OTP) và ảnh giấy tờ nếu có; duyệt, từ chối hoặc yêu cầu bổ sung. Xét duyệt thủ công, không dùng OCR/eKYC." />
      <Card>
        <div className="p-4 pb-0">
          <StatusTabs map={PARTNER_STATUS} value={filters.status} onChange={(status) => update({ status })} counts={response?.counts} />
          <FilterBar onReset={() => setFilters({ status: '', type: '', q: '', page: 1 })}>
            <SearchInput value={filters.q} onChange={(q) => update({ q })} placeholder="Email hoặc số điện thoại" />
            <Field className="w-40">
              <select value={filters.type} onChange={(event) => update({ type: event.target.value })} className={input} aria-label="Loại đối tác">
                <option value="">Mọi loại</option>
                <option value="SELLER">Người bán</option>
                <option value="DRIVER">Tài xế</option>
              </select>
            </Field>
          </FilterBar>
        </div>
        <DataTable
          columns={columns}
          rows={response?.data}
          rowKey={(row) => row.ApplicationId}
          onRowClick={(row) => setSelected(row.ApplicationId)}
          loading={loading}
          error={error}
          onRetry={reload}
          empty="Không có hồ sơ nào ở trạng thái này"
        />
        <Pagination pagination={response?.pagination} onPage={(page) => setFilters((current) => ({ ...current, page }))} />
      </Card>
      {selected && <ApplicationDetail id={selected} onClose={() => setSelected(null)} onSaved={reload} />}
    </>
  )
}
