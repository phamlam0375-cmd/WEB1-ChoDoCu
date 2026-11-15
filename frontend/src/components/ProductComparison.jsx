
import { ArrowLeft, Eye, X } from 'lucide-react'
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

function ProductComparison({ products, onClose }) {
  const navigate = useNavigate()

  if (products.length < 2) return null

  const prices = products.map((product) => Number(product.Price))
  const lowestPrice = Math.min(...prices.filter(Number.isFinite))
  const rows = [
    ['Ảnh', (product) => (
      <img
        src={getImage(product.Media)}
        alt={product.Title || 'Ảnh sản phẩm'}
        className="mx-auto h-28 w-28 rounded-lg object-contain"
      />
    )],
    ['Tên sản phẩm', (product) => product.Title || 'Chưa cập nhật'],
    ['Giá bán', (product) => {
      const price = Number(product.Price)
      return (
        <span className="inline-flex flex-wrap items-center gap-2">
          <span>{formatPrice(product.Price)}</span>
          {Number.isFinite(price) && price === lowestPrice && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
              Rẻ nhất
            </span>
          )}
        </span>
      )
    }],
    ['Danh mục', (p) => p.Category?.CategoryName || 'Chưa cập nhật'],
    ['Trạng thái', (product) => {
      if (product.Status === 'ACTIVE') return 'Đang bán'
      if (product.Status === 'RESERVED') return 'Đã có người đặt'
      if (product.Status === 'SOLD') return 'Đã bán'
      return product.Status || 'Chưa cập nhật'
    }],
    ['Khu vực', (p) => p.Location || 'Chưa cập nhật'],
    ['Mô tả', (p) => p.Description || 'Chưa có mô tả'],
    ['Người bán', (p) => p.Seller?.FullName || 'Chưa cập nhật'],
  ]

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-950/70 p-3 sm:p-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="So sánh sản phẩm"
        className="mx-auto max-w-6xl rounded-2xl bg-white p-4 shadow-2xl sm:p-7"
      >
        <div className="mb-6 grid grid-cols-[1fr_auto] items-center gap-y-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 justify-self-start rounded-lg px-2 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <ArrowLeft size={18} />
            Quay lại trang chi tiết
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng bảng so sánh"
            className="justify-self-end rounded-full p-2 hover:bg-slate-100"
          >
            <X size={22} />
          </button>

          <h2 className="col-span-2 text-center text-xl font-extrabold sm:text-2xl">
            So sánh sản phẩm
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] border-collapse text-left text-sm">
            <thead>
              <tr>
                <th className="w-36 border border-slate-200 bg-slate-50 p-4">
                  Thông tin
                </th>

                {products.map((product, index) => (
                  <th
                    key={product.ListingId}
                    className="min-w-48 border border-slate-200 p-4 text-center"
                  >
                    Sản phẩm {index + 1}
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
                      className="break-words border border-slate-200 p-4 align-top"
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
                    {product.Status !== 'ACTIVE' && (
                      <p className="mb-2 text-xs text-slate-500">
                        {product.Status === 'RESERVED'
                          ? 'Đã có người đặt'
                          : product.Status === 'SOLD'
                            ? 'Sản phẩm đã bán'
                            : 'Sản phẩm không khả dụng'}
                      </p>
                    )}
                    <div className="flex flex-wrap justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onClose()
                          navigate(`/products/${product.ListingId}`)
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 px-4 py-3 font-bold text-emerald-700 hover:bg-emerald-50"
                      >
                        <Eye size={16} />
                        Xem chi tiết
                      </button>
                      <button
                        type="button"
                        disabled={product.Status !== 'ACTIVE'}
                        onClick={() => navigate(`/orders/create/${product.ListingId}`)}
                        className="rounded-lg bg-yellow-400 px-5 py-3 font-bold text-slate-900 hover:bg-yellow-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                      >
                        {product.Status === 'ACTIVE' ? 'Mua ngay' : 'Không khả dụng'}
                      </button>
                    </div>
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
