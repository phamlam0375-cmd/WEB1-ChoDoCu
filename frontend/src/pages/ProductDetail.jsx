
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  MessageCircle,
  Minus,
  Plus,
} from 'lucide-react'
import { toast } from 'react-toastify'

import Header from '../components/Header'
import Footer from '../components/Footer'
import ProductComparison from '../components/ProductComparison'
import {
  getAllListing,
  getListingById,
} from '../services/listingApi'

import './ProductDetail.scss'

// Định dạng tiền Việt Nam
const formatMoney = (value) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(Number(value) || 0)

// Chuyển đường dẫn ảnh từ backend
const getImage = (url) => {
  if (!url) return '/product-placeholder.svg'

  if (url.startsWith('/demo/listings/')) {
    return `/api/v1/uploads/listings/${
      url.slice('/demo/listings/'.length)
    }`
  }

  if (url.startsWith('/listings/')) {
    return `/api/v1/uploads${url}`
  }

  return url
}

// Lấy toàn bộ ảnh sản phẩm
const getImages = (media = []) => {
  if (!Array.isArray(media)) return []

  return media
    .filter((item) => item.MediaType === 'IMAGE')
    .sort(
      (a, b) =>
        Number(a.SortOrder || 0) -
        Number(b.SortOrder || 0)
    )
    .map((item) => getImage(item.MediaUrl))
}

const conditionLabels = {
  NEW: 'Mới',
  LIKE_NEW: 'Như mới',
  GOOD: 'Đã sử dụng - tốt',
  FAIR: 'Đã sử dụng',
  POOR: 'Cần sửa chữa',
}

function ProductDetail() {
  const { listingId } = useParams()
  const navigate = useNavigate()

  // Dữ liệu sản phẩm
  const [product, setProduct] = useState(null)
  const [allProducts, setAllProducts] = useState([])
  const [loading, setLoading] = useState(true)

  // Ảnh và số lượng
  const [activeImage, setActiveImage] = useState(0)
  const [quantity, setQuantity] = useState(1)

  // So sánh sản phẩm
  const [compareIds, setCompareIds] = useState([])
  const [showComparison, setShowComparison] = useState(false)

  // Lấy dữ liệu thật từ backend
  useEffect(() => {
    let cancelled = false

    const loadData = async () => {
      setLoading(true)
      setProduct(null)
      setAllProducts([])
      setActiveImage(0)
      setQuantity(1)
      setCompareIds([])
      setShowComparison(false)

      try {
        // Lấy sản phẩm đang xem
        const detail = await getListingById(listingId)
        const item = detail.data || detail

        if (!item?.ListingId) {
          throw new Error('Không tìm thấy sản phẩm')
        }

        if (cancelled) return

        setProduct(item)

        // Lấy danh sách sản phẩm tương tự
        const first = await getAllListing(1, 100)

        const rows = Array.isArray(first.data)
          ? [...first.data]
          : []

        const totalPages =
          Number(first.pagination?.totalPages) || 1

        for (
          let page = 2;
          page <= totalPages;
          page += 1
        ) {
          if (cancelled) return

          const response = await getAllListing(page, 100)

          if (Array.isArray(response.data)) {
            rows.push(...response.data)
          }
        }

        if (!cancelled) {
          setAllProducts(rows)
        }
      } catch (error) {
        console.error('Lỗi tải sản phẩm:', error)

        if (!cancelled) {
          toast.error('Không thể tải chi tiết sản phẩm')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [listingId])

  // Danh sách ảnh
  const images = useMemo(
    () => getImages(product?.Media),
    [product]
  )

  // Sản phẩm tương tự: cùng danh mục và đang bán
  const related = useMemo(() => {
    if (!product) return []

    return allProducts
      .filter((item) => {
        const notCurrent =
          String(item.ListingId) !==
          String(product.ListingId)

        const sameCategory =
          String(item.CategoryId) ===
          String(product.CategoryId)

        const active = item.Status === 'ACTIVE'

        return notCurrent && sameCategory && active
      })
      .slice(0, 4)
  }, [allProducts, product])

  // Chọn / bỏ chọn sản phẩm để so sánh
  const toggleCompare = (id) => {
    const key = String(id)

    if (compareIds.includes(key)) {
      setCompareIds((current) =>
        current.filter((value) => value !== key)
      )
      return
    }

    if (compareIds.length >= 3) {
      toast.info('Chỉ được chọn tối đa 3 sản phẩm')
      return
    }

    setCompareIds((current) => [...current, key])
  }

  // Mở bảng so sánh
  const handleCompare = async () => {
    if (compareIds.length < 2) {
      toast.info('Vui lòng chọn ít nhất 2 sản phẩm')
      return
    }

    try {
      // Lấy chi tiết từng sản phẩm từ MySQL
      // để bảng so sánh có dữ liệu đầy đủ
      const results = await Promise.all(
        compareIds.map((id) => getListingById(id))
      )

      const details = results.map(
        (response) => response.data || response
      )

      const validDetails = details.filter(
        (item) => item?.ListingId
      )

      if (validDetails.length < 2) {
        toast.error('Không đủ dữ liệu để so sánh')
        return
      }

      setComparisonProducts(validDetails)
      setShowComparison(true)
    } catch (error) {
      console.error('Lỗi so sánh:', error)
      toast.error('Không thể tải dữ liệu so sánh')
    }
  }

  // Dữ liệu chi tiết dùng trong bảng so sánh
  const [comparisonProducts, setComparisonProducts] =
    useState([])

  // Chat với người bán
  const handleChat = () => {
    if (!product) return

    window.dispatchEvent(
      new CustomEvent('open-listing-chat', {
        detail: {
          listingId: product.ListingId,
          listing: product,
        },
      })
    )
  }

  // Mua ngay
  const handleBuy = () => {
    if (!product) return

    if (product.Status !== 'ACTIVE') {
      toast.info('Sản phẩm hiện không thể mua')
      return
    }

    navigate(`/orders/create/${product.ListingId}`)
  }

  // Đang tải
  if (loading) {
    return (
      <div className="product-detail-loading">
        Đang tải sản phẩm...
      </div>
    )
  }

  // Không tìm thấy
  if (!product) {
    return (
      <div className="product-detail-loading">
        <p>Không tìm thấy sản phẩm.</p>

        <button onClick={() => navigate('/')}>
          Về trang chủ
        </button>
      </div>
    )
  }

  const mainImage =
    images[activeImage] || '/product-placeholder.svg'

  return (
    <div className="product-detail-page">
      <Header />

      <main className="product-detail-container">
        {/* Quay lại */}
        <button
          type="button"
          className="product-back"
          onClick={() => navigate('/')}
        >
          <ArrowLeft size={18} />
          Quay lại trang chủ
        </button>

        <h1 className="product-page-title">
          Chi tiết sản phẩm
        </h1>

        {/* THÔNG TIN SẢN PHẨM */}
        <section className="product-main">
          {/* Hình ảnh */}
          <div className="product-gallery">
            <div className="product-main-image">
              <img
                src={mainImage}
                alt={product.Title}
                onError={(event) => {
                  event.currentTarget.onerror = null
                  event.currentTarget.src =
                    '/product-placeholder.svg'
                }}
              />
            </div>

            <div className="product-thumbnails">
              {images.map((image, index) => (
                <button
                  type="button"
                  key={index}
                  className={
                    activeImage === index ? 'active' : ''
                  }
                  onClick={() => setActiveImage(index)}
                >
                  <img
                    src={image}
                    alt={`Ảnh sản phẩm ${index + 1}`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Nội dung */}
          <div className="product-information">
            <span className="product-category">
              {product.Category?.CategoryName ||
                'Sản phẩm'}
            </span>

            <h2>{product.Title}</h2>

            <p className="product-price">
              {formatMoney(product.Price)}
            </p>

            <p className="product-description">
              {product.Description ||
                'Chưa có mô tả sản phẩm.'}
            </p>

            <div className="product-meta">
              <p>
                <strong>Tình trạng: </strong>
                {conditionLabels[
                  product.ConditionLevel
                ] ||
                  product.ConditionLevel ||
                  'Chưa cập nhật'}
              </p>

              <p>
                <strong>Địa điểm: </strong>
                {product.Location || 'Chưa cập nhật'}
              </p>

              <p>
                <strong>Người bán: </strong>
                {product.Seller?.FullName ||
                  'Chưa cập nhật'}
              </p>

              <p>
                <strong>Khuyết điểm: </strong>
                {product.KnownDefects || 'Không có'}
              </p>

              <p>
                <strong>Trạng thái: </strong>
                {product.Status === 'ACTIVE'
                  ? 'Đang bán'
                  : product.Status === 'SOLD'
                  ? 'Đã bán'
                  : product.Status === 'RESERVED'
                  ? 'Đã giữ món'
                  : product.Status || 'Chưa cập nhật'}
              </p>
            </div>

            {/* Số lượng */}
            <div className="product-quantity">
              <span>Số lượng</span>

              <button
                type="button"
                disabled={quantity <= 1}
                onClick={() =>
                  setQuantity((current) =>
                    Math.max(1, current - 1)
                  )
                }
              >
                <Minus size={16} />
              </button>

              <span>{quantity}</span>

              <button
                type="button"
                disabled
                title="Mỗi tin đăng hiện chỉ có một món"
              >
                <Plus size={16} />
              </button>
            </div>

            <p className="product-note">
              Mỗi tin đăng hiện được xử lý như một món hàng.
            </p>

            {/* Nút mua hàng */}
            <div className="product-actions">
              <button
                type="button"
                className="product-cart-button"
                onClick={() =>
                  toast.info(
                    'Chức năng giỏ hàng chưa được kết nối'
                  )
                }
              >
                Thêm vào giỏ
              </button>

              <button
                type="button"
                className="product-buy-button"
                disabled={product.Status !== 'ACTIVE'}
                onClick={handleBuy}
              >
                Mua ngay
              </button>
            </div>

            {/* Chat */}
            <button
              type="button"
              className="product-chat-button"
              onClick={handleChat}
            >
              <MessageCircle size={18} />
              Chat với người bán
            </button>

            {/* Chọn sản phẩm hiện tại */}
            <label className="product-compare-check">
              <input
                type="checkbox"
                checked={compareIds.includes(
                  String(product.ListingId)
                )}
                onChange={() =>
                  toggleCompare(product.ListingId)
                }
              />
              Chọn để so sánh
            </label>
          </div>
        </section>

        {/* SẢN PHẨM TƯƠNG TỰ */}
        <section className="product-related">
          <div className="product-section-heading">
            <h2>Sản phẩm tương tự</h2>
          </div>

          <div className="product-related-grid">
            {related.map((item) => {
              const image =
                getImages(item.Media)[0] ||
                '/product-placeholder.svg'

              return (
                <article
                  className="product-related-card"
                  key={item.ListingId}
                >
                  <label className="product-card-check">
                    <input
                      type="checkbox"
                      aria-label={`Chọn ${item.Title} để so sánh`}
                      checked={compareIds.includes(
                        String(item.ListingId)
                      )}
                      onChange={() =>
                        toggleCompare(item.ListingId)
                      }
                    />
                  </label>

                  <img
                    src={image}
                    alt={item.Title}
                    onError={(event) => {
                      event.currentTarget.onerror = null
                      event.currentTarget.src =
                        '/product-placeholder.svg'
                    }}
                  />

                  <h3>{item.Title}</h3>

                  <strong>
                    {formatMoney(item.Price)}
                  </strong>

                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/products/${item.ListingId}`
                      )
                    }
                  >
                    Xem chi tiết
                  </button>
                </article>
              )
            })}
          </div>

          {related.length === 0 && (
            <p>Chưa có sản phẩm tương tự.</p>
          )}
        </section>

        {/* THANH SO SÁNH */}
        <div className="product-compare-bar">
          <div>
            <strong>
              Đã chọn {compareIds.length}/3 sản phẩm
            </strong>

            <p>
              Chọn ít nhất 2 và tối đa 3 sản phẩm
              để so sánh
            </p>
          </div>

          <button
            type="button"
            disabled={compareIds.length < 2}
            onClick={handleCompare}
          >
            So sánh
          </button>
        </div>
      </main>

      {/* BẢNG SO SÁNH */}
      {showComparison && (
        <ProductComparison
          products={comparisonProducts}
          onClose={() => setShowComparison(false)}
        />
      )}

      <Footer />
    </div>
  )
}

export default ProductDetail
