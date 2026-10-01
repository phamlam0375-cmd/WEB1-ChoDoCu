import { useState } from 'react'
import { Card, DataTable, PageHeader, Pagination, StatusBadge } from '../../components/admin/AdminUi'
import RefundDetail from '../../components/refund/RefundDetail'
import { useApi } from '../../hooks/useApi'
import { useDevAccount } from '../../hooks/useDevAccount'
import { formatDateTime, formatMoney } from '../../lib/format'
import { REFUND_STATUS } from '../../lib/labels'

// B06/B07: người mua theo dõi yêu cầu của mình; người bán xem yêu cầu cần chuyển trả.
export default function MyRefundsPage() {
  const { me } = useDevAccount()
  const [as, setAs] = useState('buyer')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const { response, loading, error, reload } = useApi('/refund-requests', { as, page })

  const columns = [
    { key: 'RefundRequestId', title: 'Mã', render: (row) => <span className="font-mono text-xs text-slate-500">#{row.RefundRequestId}</span> },
    {
      key: 'order',
      title: 'Đơn hàng',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">#{row.OrderId} · {row.Order?.Listing?.Title}</p>
          <p className="text-xs text-slate-500">{as === 'buyer' ? `Người bán: ${row.Order?.Seller?.FullName}` : `Người mua: ${row.Requester?.FullName}`}</p>
        </div>
      ),
    },
    { key: 'Amount', title: 'Số tiền', render: (row) => formatMoney(row.Amount), className: 'whitespace-nowrap text-right tabular-nums' },
    { key: 'Status', title: 'Trạng thái', render: (row) => <StatusBadge map={REFUND_STATUS} value={row.Status} /> },
    { key: 'RequestedAt', title: 'Ngày gửi', render: (row) => formatDateTime(row.RequestedAt), className: 'whitespace-nowrap' },
  ]

  return (
    <>
      <PageHeader code="B06 · B07" title="Hoàn tiền" description="Theo dõi tiến độ yêu cầu hoàn tiền. Bấm vào một dòng để xem chi tiết và thực hiện bước tiếp theo." />
      <div className="mb-4 flex gap-1 rounded-lg border border-slate-200 bg-white p-1 sm:w-fit">
        {[
          ['buyer', 'Tôi là người mua'],
          ['seller', 'Tôi là người bán'],
        ].map(([value, text]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setAs(value)
              setPage(1)
            }}
            className={`flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${as === value ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            {text}
          </button>
        ))}
      </div>
      <Card>
        <DataTable
          columns={columns}
          rows={response?.data}
          rowKey={(row) => row.RefundRequestId}
          onRowClick={(row) => setSelected(row.RefundRequestId)}
          loading={loading}
          error={error}
          onRetry={reload}
          empty={as === 'buyer' ? 'Bạn chưa gửi yêu cầu hoàn tiền nào' : 'Chưa có yêu cầu hoàn tiền nào cho đơn của bạn'}
        />
        <Pagination pagination={response?.pagination} onPage={setPage} />
      </Card>
      {selected && me && <RefundDetail id={selected} viewer={as} onClose={() => setSelected(null)} onSaved={reload} />}
    </>
  )
}
