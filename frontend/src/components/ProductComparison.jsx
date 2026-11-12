
import { X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const formatPrice = (value) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(Number(value) || 0)

const getImage = (media = []) => {
  const image = media.find((item) => item.MediaType === 'IMAGE')
  const url = image?.MediaUrl

  if (!url) return '/product-placeholder.svg'

  if (url.startsWith('/demo/listings/')) {
    return `/api/v1/uploads/listings/${url.slice('/demo/listings/'.length)}`
  }

  if (url.startsWith('/listings/')) {
    return `/api/v1/uploads${url}`
  }

  return url
}

const conditionLabels = {
  NEW: 'Mới',
  LIKE_NEW: 'Như mới',
  GOOD: 'Đã sử dụng - tốt',
  FAIR: 'Đã sử dụng',
  POOR: 'Cần sửa chữa',
}

function ProductComparison({ products, onClose }) {
  const navigate = useNavigate()

  if (products.length < 2) return null

  const rows = [
    ['Giá bán', (p) => formatPrice(p.Price)],
    ['Tình trạng', (p) => conditionLabels[p.ConditionLevel] || p.ConditionLevel || 'Chưa cập nhật'],
    ['Danh mục', (p) => p.Category?.CategoryName || 'Chưa cập nhật'],
    ['Địa điểm', (p) => p.Location || 'Chưa cập nhật'],
    ['Người bán', (p) => p.Seller?.FullName || 'Chưa cập nhật'],
    ['Khuyết điểm', (p) => p.KnownDefects || 'Không có'],
    ['Mô tả', (p) => p.Description || 'Chưa có mô tả'],
  ]

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-950/70 p-3 sm:p-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="So sánh sản phẩm"
        className="mx-auto max-w-6xl rounded-2xl bg-white p-4 shadow-2xl sm:p-7"
      >
        <div className="mb-6 flex items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold sm:text-2xl">
            So sánh sản phẩm
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng bảng so sánh"
            className="rounded-full p-2 hover:bg-slate-100"
          >
            <X size={22} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] border-collapse text-left text-sm">
            <thead>
              <tr>
                <th className="w-36 border border-slate-200 bg-slate-50 p-4">
                  Tiêu chí
                </th>

                {products.map((product) => (
                  <th
                    key={product.ListingId}
                    className="min-w-48 border border-slate-200 p-4 text-center"
                  >
                    <img
                      src={getImage(product.Media)}
                      alt={product.Title}
                      className="mx-auto mb-3 h-36 w-36 object-contain"
                    />

                    <p className="font-bold">{product.Title}</p>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map(([label, getValue]) => (
                <tr key={label}>
                  <th className="border border-slate-200 bg-slate-50 p-4 font-semibold">
                    {label}
                  </th>

                  {products.map((product) => (
                    <td
                      key={product.ListingId}
                      className="border border-slate-200 p-4 align-top"
                    >
                      {getValue(product)}
                    </td>
                  ))}
                </tr>
              ))}

              <tr>
                <th className="border border-slate-200 bg-slate-50 p-4">
                  Thao tác
                </th>

                {products.map((product) => (
                  <td
                    key={product.ListingId}
                    className="border border-slate-200 p-4 text-center"
                  >
                    <button
                      type="button"
                      onClick={() => navigate(`/orders/create/${product.ListingId}`)}
                      className="rounded-lg bg-yellow-400 px-5 py-3 font-bold text-slate-900 hover:bg-yellow-500"
                    >
                      Mua ngay
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default ProductComparison
