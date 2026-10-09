import { Badge, InfoRow, StatusBadge } from '../admin/AdminUi'
import { formatDateTime } from '../../lib/format'
import { LISTING_STATUS, ORDER_STATUS, REPORT_STATUS, REPORT_TARGET, USER_STATUS } from '../../lib/labels'

// Thông tin một báo cáo vi phạm: lý do, mô tả, ảnh bằng chứng, đối tượng bị báo cáo.
export default function ReportInfo({ report, onOpenListing }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="blue">{REPORT_TARGET[report.TargetType]}</Badge>
        <StatusBadge map={REPORT_STATUS} value={report.Status} />
        <span className="text-sm font-semibold text-slate-900">{report.Reason}</span>
      </div>
      <dl className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200">
        <InfoRow label="Người gửi">{report.Reporter?.FullName} (#{report.ReporterId}) · {formatDateTime(report.CreatedAt)}</InfoRow>
        <InfoRow label="Mô tả">{report.Description}</InfoRow>
        <InfoRow label="Ảnh bằng chứng">
          {report.EvidenceUrl ? (
            <a href={report.EvidenceUrl} target="_blank" rel="noreferrer">
              <img src={report.EvidenceUrl} alt="Ảnh bằng chứng" className="max-h-48 rounded-lg border border-slate-200 object-contain" />
            </a>
          ) : (
            '—'
          )}
        </InfoRow>
        {report.Listing && (
          <InfoRow label="Tin bị báo cáo">
            {onOpenListing ? (
              <button type="button" onClick={onOpenListing} className="text-left font-medium text-emerald-700 hover:underline">
                #{report.Listing.ListingId} {report.Listing.Title}
              </button>
            ) : (
              <span>#{report.Listing.ListingId} {report.Listing.Title}</span>
            )}{' '}
            <StatusBadge map={LISTING_STATUS} value={report.Listing.Status} />
            {report.related && <span className="block text-xs text-slate-500">Bị báo cáo {report.related.reportsAgainstListing} lần</span>}
          </InfoRow>
        )}
        {report.ReportedUser && (
          <InfoRow label="Tài khoản bị báo cáo">
            {report.ReportedUser.FullName} (#{report.ReportedUser.UserId}) <StatusBadge map={USER_STATUS} value={report.ReportedUser.Status} />
          </InfoRow>
        )}
        {report.Order && <InfoRow label="Đơn hàng">#{report.Order.OrderId} · {ORDER_STATUS[report.Order.Status] || report.Order.Status}</InfoRow>}
        {report.Resolution && <InfoRow label="Kết quả xử lý">{report.Resolution}</InfoRow>}
        {report.Handler && <InfoRow label="Người xử lý">{report.Handler.FullName}{report.HandledAt ? ` · ${formatDateTime(report.HandledAt)}` : ''}</InfoRow>}
      </dl>
    </div>
  )
}
