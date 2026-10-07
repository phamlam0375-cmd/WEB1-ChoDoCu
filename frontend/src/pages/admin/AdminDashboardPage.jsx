import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Banknote, CircleDollarSign, PackageCheck, RotateCcw, Table2 } from 'lucide-react'
import { ErrorState, Field, Loading, PageHeader, Section, StatCard } from '../../components/admin/AdminUi'
import { btn, input } from '../../components/admin/styles'
import TimeSeriesChart from '../../components/admin/TimeSeriesChart'
import { useApi } from '../../hooks/useApi'
import { formatCompactMoney, formatMoney, formatNumber, toDateInput } from '../../lib/format'

const SERIES_BLUE = '#2a78d6'
const SERIES_ORANGE = '#eb6834'

const PRESETS = [
  { label: '7 ngày', days: 7 },
  { label: '30 ngày', days: 30 },
  { label: '90 ngày', days: 90 },
  { label: '12 tháng', days: 365, groupBy: 'month' },
]

const rangeOf = (days) => ({ from: toDateInput(new Date(Date.now() - (days - 1) * 86400000)), to: toDateInput(new Date()) })

const QUEUES = [
  { key: 'pendingPartnerApplications', label: 'Hồ sơ đối tác chờ duyệt', to: '/admin/partner-applications' },
  { key: 'pendingListings', label: 'Tin đăng chờ duyệt', to: '/admin/listings' },
  { key: 'openReports', label: 'Báo cáo vi phạm đang mở', to: '/admin/reports' },
  { key: 'pendingRefunds', label: 'Yêu cầu hoàn tiền chờ duyệt', to: '/admin/refunds' },
  { key: 'reportedFeePayments', label: 'Khoản phí chờ đối soát', to: '/admin/fee-payments' },
  { key: 'overdueCommissions', label: 'Khoản hoa hồng quá hạn', to: '/admin/commissions' },
]

export default function AdminDashboardPage() {
  const [range, setRange] = useState({ ...rangeOf(30), groupBy: '' })
  const [showTable, setShowTable] = useState(false)
  const { data, loading, error, reload } = useApi('/admin/statistics', range)

  const summary = data?.summary
  const period = data?.range.groupBy === 'month' ? 'Tháng' : 'Ngày'

  return (
    <>
      <PageHeader title="Thống kê hoạt động và doanh thu" description="Đơn hoàn tất và hủy, giá trị giao dịch, hoa hồng phải thu và đã thu, phí tin VIP theo thời gian." />

      <Section title="Khoảng thời gian">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {PRESETS.map((preset) => {
            const next = rangeOf(preset.days)
            const active = range.from === next.from && range.to === next.to
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => setRange({ ...next, groupBy: preset.groupBy || '' })}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${active ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
        <Field label="Từ ngày" className="w-40">
          <input type="date" value={range.from} max={range.to} onChange={(event) => setRange({ ...range, from: event.target.value })} className={input} />
        </Field>
        <Field label="Đến ngày" className="w-40">
          <input type="date" value={range.to} min={range.from} onChange={(event) => setRange({ ...range, to: event.target.value })} className={input} />
        </Field>
        <Field label="Gộp theo" className="w-32">
          <select value={range.groupBy} onChange={(event) => setRange({ ...range, groupBy: event.target.value })} className={input}>
            <option value="">Tự động</option>
            <option value="day">Ngày</option>
            <option value="month">Tháng</option>
          </select>
        </Field>
      </div>
      </Section>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : (
        <div className={`space-y-6 ${loading ? 'opacity-60' : ''}`}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Doanh thu website"
              value={formatMoney(summary.revenue)}
              hint={`Hoa hồng đã thu ${formatMoney(summary.commissionCollected)} + phí VIP ${formatMoney(summary.vipFees)}`}
              tone="green"
              icon={CircleDollarSign}
            />
            <StatCard
              label="Giá trị giao dịch"
              value={formatMoney(summary.gmv)}
              hint={`${formatNumber(summary.completedOrders)} đơn hoàn tất · ${formatNumber(summary.cancelledOrders)} đơn hủy`}
              tone="blue"
              icon={PackageCheck}
            />
            <StatCard
              label="Hoa hồng phải thu"
              value={formatMoney(summary.commissionDue)}
              hint={`Tổng còn nợ hiện tại ${formatMoney(data.snapshot.outstandingCommission)}`}
              tone="amber"
              icon={Banknote}
            />
            <StatCard
              label="Hoàn tiền"
              value={formatMoney(summary.refundAmount)}
              hint={`${formatNumber(summary.refundCount)} yêu cầu hoàn tất`}
              tone="red"
              icon={RotateCcw}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Section title="Doanh thu website" className="!mb-0" bodyClassName="p-5">
              <p className="mb-3 text-xs text-slate-500">Hoa hồng đã xác nhận thu và phí tin VIP, theo {period.toLowerCase()}</p>
              <TimeSeriesChart
                type="bar"
                title="Doanh thu website theo thời gian"
                rows={data.series}
                series={[
                  { key: 'commissionCollected', label: 'Hoa hồng đã thu', color: SERIES_BLUE },
                  { key: 'vipFees', label: 'Phí tin VIP', color: SERIES_ORANGE },
                ]}
                formatValue={formatMoney}
                formatAxis={formatCompactMoney}
              />
            </Section>
            <Section title="Đơn hàng" className="!mb-0" bodyClassName="p-5">
              <p className="mb-3 text-xs text-slate-500">Số đơn hoàn tất và đơn hủy, theo {period.toLowerCase()}</p>
              <TimeSeriesChart
                type="line"
                title="Số đơn hoàn tất và đơn hủy theo thời gian"
                rows={data.series}
                series={[
                  { key: 'completedOrders', label: 'Hoàn tất', color: SERIES_BLUE },
                  { key: 'cancelledOrders', label: 'Đã hủy', color: SERIES_ORANGE },
                ]}
                formatValue={formatNumber}
                integer
              />
            </Section>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
            <Section
              title={`Số liệu theo ${period.toLowerCase()}`}
              className="!mb-0"
              flush
              actions={
                <button type="button" className={btn.ghost} onClick={() => setShowTable((value) => !value)}>
                  <Table2 size={15} /> {showTable ? 'Ẩn bảng' : 'Xem bảng'}
                </button>
              }
            >
              {showTable ? (
                <div className="max-h-96 overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-emerald-50 text-xs uppercase text-emerald-900">
                      <tr>
                        {[period, 'Đơn HT', 'Đơn hủy', 'Giá trị GD', 'HH phải thu', 'HH đã thu', 'Phí VIP', 'Hoàn tiền'].map((head) => (
                          <th key={head} className="whitespace-nowrap border-b-2 border-r border-emerald-100 px-3 py-2 text-right first:text-left last:border-r-0">{head}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="tabular-nums [&_td]:border-b [&_td]:border-r [&_td]:border-slate-200 [&_td:last-child]:border-r-0 [&_tr:nth-child(even)]:bg-slate-50/70">
                      {data.series.map((row) => (
                        <tr key={row.period}>
                          <td className="px-3 py-1.5">{row.period}</td>
                          <td className="px-3 py-1.5 text-right">{row.completedOrders}</td>
                          <td className="px-3 py-1.5 text-right">{row.cancelledOrders}</td>
                          <td className="px-3 py-1.5 text-right">{formatMoney(row.gmv)}</td>
                          <td className="px-3 py-1.5 text-right">{formatMoney(row.commissionDue)}</td>
                          <td className="px-3 py-1.5 text-right">{formatMoney(row.commissionCollected)}</td>
                          <td className="px-3 py-1.5 text-right">{formatMoney(row.vipFees)}</td>
                          <td className="px-3 py-1.5 text-right">{formatMoney(row.refundAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-5 py-4">
                  <p className="mb-3 text-sm font-medium text-slate-700">Người bán có giá trị giao dịch cao nhất</p>
                  {data.topSellers.length ? (
                    <ol className="space-y-2 text-sm">
                      {data.topSellers.map((seller, index) => (
                        <li key={seller.SellerId} className="flex items-center justify-between gap-3">
                          <span>
                            <span className="mr-2 text-slate-400">{index + 1}.</span>
                            {seller.FullName} <span className="text-xs text-slate-400">· {seller.orders} đơn</span>
                          </span>
                          <span className="font-medium tabular-nums">{formatMoney(seller.gmv)}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-slate-500">Chưa có đơn hoàn tất trong khoảng thời gian này.</p>
                  )}
                  <p className="mt-4 text-xs text-slate-500">
                    Trong kỳ: {formatNumber(summary.newUsers)} tài khoản mới · {formatNumber(summary.newListings)} tin đăng mới · {formatNumber(summary.vipCount)} lượt VIP.
                  </p>
                </div>
              )}
            </Section>

            <Section title="Việc cần xử lý" className="!mb-0" bodyClassName="px-5 py-2">
              <ul className="divide-y divide-slate-100">
                {QUEUES.map((queue) => (
                  <li key={queue.key}>
                    <Link to={queue.to} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-emerald-700">
                      {queue.label}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${data.snapshot[queue.key] ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>
                        {formatNumber(data.snapshot[queue.key])}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          </div>
        </div>
      )}
    </>
  )
}
