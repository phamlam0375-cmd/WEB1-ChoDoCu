import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import CategorySection from '../components/CategorySection'
import FeaturedProducts from '../components/FeaturedProducts'
import Footer from '../components/Footer'
import Header from '../components/Header'
import HeroSection from '../components/HeroSection'
import ProductFilters from '../components/ProductFilters'
import ProductGrid from '../components/ProductGrid'
import SearchBar from '../components/SearchBar'
import WhyChooseUs from '../components/WhyChooseUs'
import { categories as fallbackCategories, conditions as fallbackConditions, locations as fallbackLocations } from '../data/mockProducts'
import { getAllListing } from '../api/listingApi'
import ListingDetail from './listing/ListingDetail'
import { useListingStore } from '../store/useListing'
import { matchesProductCategory } from '../utils/productFilters'
import { searchProducts } from '../utils/searchEngine'
import { clearSearchHistory, getSearchHistory, saveSearchHistory } from '../utils/searchHistory'

const defaultFilters = {
  category: 'all',
  minPrice: '',
  maxPrice: '',
  condition: 'all',
  location: 'all',
  sort: 'newest',
}

function HomePage() {
  const navigate = useNavigate()
  const listing = useListingStore((state) => state.listing)
  const setListing = useListingStore((state) => state.setListing)
  const [categories, setCategories] = useState(fallbackCategories)
  const [locations, setLocations] = useState(fallbackLocations)
  const [conditions] = useState(fallbackConditions)
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [searchCategory, setSearchCategory] = useState('all')
  const [searchLocation, setSearchLocation] = useState('all')
  const [draftFilters, setDraftFilters] = useState(defaultFilters)
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters)
  const [savedIds, setSavedIds] = useState(() => new Set())
  const [savedOnly, setSavedOnly] = useState(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [searchHistory, setSearchHistory] = useState(() => getSearchHistory())
  const [selectedProduct, setSelectedProduct] = useState(null)

  useEffect(() => {
    let cancelled = false

    const loadListings = async () => {
      try {
        const response = await getAllListing(1, 100)
        if (cancelled) return

        const rows = response.data || []
        const categoryRows = [...new Map(
          rows
            .filter((item) => item.Category)
            .map((item) => [item.Category.CategoryId, item.Category]),
        ).values()]
        const categoryIcons = fallbackCategories.map((item) => item.icon)
        const categoryOptions = categoryRows.map((item, index) => ({
          id: String(item.CategoryId),
          name: item.CategoryName,
          icon: categoryIcons[index % categoryIcons.length],
        }))

        setCategories(categoryOptions.length ? categoryOptions : fallbackCategories)
        setLocations([...new Set(rows.map((item) => item.Location).filter(Boolean))])
        setListing(rows)
      } catch {
        if (!cancelled) toast.error('Không thể tải danh sách sản phẩm.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadListings()
    return () => { cancelled = true }
  }, [setListing])

  const products = useMemo(() => listing.map((item, index) => ({
    id: item.ListingId,
    name: item.Title,
    price: Number(item.Price),
    category: String(item.CategoryId),
    categoryName: item.Category?.CategoryName || '',
    description: item.Description || '',
    knownDefects: item.KnownDefects || '',
    status: item.Status || '',
    condition: { NEW: 'Như mới', LIKE_NEW: 'Như mới', GOOD: 'Đã sử dụng', FAIR: 'Đã sử dụng', POOR: 'Cần sửa chữa nhẹ' }[item.ConditionLevel] || item.ConditionLevel,
    location: item.Location || 'Chưa cập nhật',
    postedAt: new Date(item.CreatedAt).toLocaleDateString('vi-VN'),
    createdOrder: new Date(item.CreatedAt).getTime() || index,
    seller: item.Seller?.FullName || `Người bán #${item.SellerId}`,
    sellerId: item.SellerId,
    sellerAvatar: item.Seller?.AvatarUrl || '',
    verified: Boolean(item.Seller?.EmailVerified),
    isVip: false,
    isFeatured: index < 3,
    image: item.Media?.find((media) => media.MediaType === 'IMAGE')?.MediaUrl || '/product-placeholder.svg',
  })), [listing])

  const filteredProducts = useMemo(() => {
    const minPrice = Number(appliedFilters.minPrice) || 0
    const maxPrice = Number(appliedFilters.maxPrice) || Number.POSITIVE_INFINITY
    const matchesFilters = (product) => {
      const matchesCategory = matchesProductCategory(product, appliedFilters.category, categories)
      const matchesCondition = appliedFilters.condition === 'all' || product.condition === appliedFilters.condition
      const matchesLocation = appliedFilters.location === 'all' || product.location === appliedFilters.location
      const matchesPrice = product.price >= minPrice && product.price <= maxPrice
      const matchesSaved = !savedOnly || savedIds.has(product.id)

      return matchesCategory && matchesCondition && matchesLocation && matchesPrice && matchesSaved
    }

    if (!appliedKeyword.trim()) {
      return products
        .filter(matchesFilters)
        .sort((first, second) => {
          if (appliedFilters.sort === 'price-asc') return first.price - second.price
          if (appliedFilters.sort === 'price-desc') return second.price - first.price
          return second.createdOrder - first.createdOrder
        })
    }

    return searchProducts(products, appliedKeyword)
      .filter(({ product }) => matchesFilters(product))
      .sort((first, second) => {
        if (appliedFilters.sort === 'price-asc') return first.product.price - second.product.price || second.score - first.score
        if (appliedFilters.sort === 'price-desc') return second.product.price - first.product.price || second.score - first.score
        return second.score - first.score || second.product.createdOrder - first.product.createdOrder
      })
      .map(({ product }) => product)
  }, [appliedFilters, appliedKeyword, categories, products, savedIds, savedOnly])

  const featuredProducts = useMemo(() => products.filter((product) => product.isFeatured), [products])

  const scrollToProducts = () => {
    window.setTimeout(() => document.getElementById('san-pham')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  const syncQuickFilters = (category, location) => {
    setDraftFilters((current) => ({ ...current, category, location }))
    setAppliedFilters((current) => ({ ...current, category, location }))
  }

  const handleSearch = (event) => {
    event.preventDefault()
    setAppliedKeyword(keyword)
    setSearchHistory(saveSearchHistory(keyword))
    syncQuickFilters(searchCategory, searchLocation)
    setSavedOnly(false)
    scrollToProducts()
  }

  const handleHistorySelect = (query) => {
    setKeyword(query)
    setAppliedKeyword(query)
    setSearchHistory(saveSearchHistory(query))
    syncQuickFilters(searchCategory, searchLocation)
    setSavedOnly(false)
    scrollToProducts()
  }

  const handleClearSearchHistory = () => {
    setSearchHistory(clearSearchHistory())
  }

  const handleCategorySelect = (category) => {
    setSearchCategory(category)
    setDraftFilters((current) => ({ ...current, category }))
    setAppliedFilters((current) => ({ ...current, category }))
    setSavedOnly(false)
    scrollToProducts()
  }

  const handleDraftFilterChange = (field, value) => {
    setDraftFilters((current) => ({ ...current, [field]: value }))
  }

  const handleApplyFilters = () => {
    setAppliedFilters(draftFilters)
    setSearchCategory(draftFilters.category)
    setSearchLocation(draftFilters.location)
    setSavedOnly(false)
    scrollToProducts()
  }

  const handleResetFilters = () => {
    setKeyword('')
    setAppliedKeyword('')
    setSearchCategory('all')
    setSearchLocation('all')
    setDraftFilters(defaultFilters)
    setAppliedFilters(defaultFilters)
    setSavedOnly(false)
    scrollToProducts()
  }

  const handleToggleSave = (productId) => {
    const product = products.find((item) => item.id === productId)
    const isCurrentlySaved = savedIds.has(productId)

    setSavedIds((current) => {
      const next = new Set(current)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })

    toast[isCurrentlySaved ? 'info' : 'success'](
      isCurrentlySaved ? `Đã bỏ lưu “${product.name}”` : `Đã lưu “${product.name}”`,
    )
  }

  const handleShowSaved = () => {
    setSavedOnly((current) => !current)
    scrollToProducts()
  }

  const handleUnavailable = () => {
    toast.info('Chức năng đang được phát triển')
  }

  const handleViewProduct = (product) => {
    setSelectedProduct(product)
  }

  const handleBuyProduct = (product) => {
    const listingId = Number(product?.id)
    if (!Number.isSafeInteger(listingId) || listingId <= 0) {
      toast.error('Sản phẩm chưa có mã tin đăng hợp lệ.')
      return
    }
    navigate(`/orders/create/${listingId}`)
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header
        savedCount={savedIds.size}
        savedOnly={savedOnly}
        onShowSaved={handleShowSaved}
        onUnavailable={handleUnavailable}
      />
      <main aria-busy={loading}>
        <HeroSection onExplore={scrollToProducts} onSell={handleUnavailable} />
        <SearchBar
          keyword={keyword}
          category={searchCategory}
          location={searchLocation}
          categories={categories}
          locations={locations}
          searchHistory={searchHistory}
          onKeywordChange={setKeyword}
          onCategoryChange={setSearchCategory}
          onLocationChange={setSearchLocation}
          onSubmit={handleSearch}
          onHistorySelect={handleHistorySelect}
          onClearHistory={handleClearSearchHistory}
        />
        <CategorySection
          categories={categories}
          products={products}
          selectedCategory={appliedFilters.category}
          onSelect={handleCategorySelect}
        />
        <FeaturedProducts
          products={featuredProducts}
          savedIds={savedIds}
          onToggleSave={handleToggleSave}
          onView={handleViewProduct}
        />

        <section id="san-pham" className="scroll-mt-24 bg-slate-50 py-16 sm:py-20">
          <div className="mx-auto grid max-w-7xl gap-7 px-4 sm:px-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:px-8">
            <ProductFilters
              filters={draftFilters}
              categories={categories}
              conditions={conditions}
              locations={locations}
              onChange={handleDraftFilterChange}
              onApply={handleApplyFilters}
              onReset={handleResetFilters}
              mobileOpen={mobileFiltersOpen}
              onMobileOpenChange={setMobileFiltersOpen}
            />
            <ProductGrid
              products={filteredProducts}
              savedIds={savedIds}
              savedOnly={savedOnly}
              onToggleSave={handleToggleSave}
              onView={handleViewProduct}
              onBuy={handleBuyProduct}
              onOpenFilters={() => setMobileFiltersOpen(true)}
              onReset={handleResetFilters}
            />
          </div>
        </section>
        <WhyChooseUs onSell={handleUnavailable} />
      </main>
      <Footer />
      <ListingDetail
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
  )
}

export default HomePage
