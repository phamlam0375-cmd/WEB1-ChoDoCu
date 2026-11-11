import { Package, ShoppingBag } from "lucide-react";

import ListingDetail from "../../pages/listing/ListingDetail";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const formatPrice = (price) => {
    if (price === null || price === undefined) {
        return "Liên hệ";
    }

    const number = Number(price);

    return Number.isNaN(number)
        ? price
        : `${number.toLocaleString("vi-VN")} đ`;
};

const getProductImage = (product) =>
    product.Media?.find((media) => media.MediaType === "IMAGE")?.MediaUrl ||
    product.ImageUrl ||
    product.imageUrl ||
    product.ThumbnailUrl ||
    product.thumbnailUrl ||
    product.Image ||
    null;

const resolveProductImage = (image) => {
    if (typeof image !== "string" || !image) return null;
    if (image.startsWith("/demo/listings/")) {
        return `/api/v1/uploads/listings/${image.slice("/demo/listings/".length)}`;
    }
    if (image.startsWith("/listings/")) {
        return `/api/v1/uploads${image}`;
    }
    return image;
};

function ProductImage({ image, alt }) {
    const [failed, setFailed] = useState(false);

    if (!image || failed) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Package className="h-12 w-12 text-slate-300" />
            </div>
        );
    }

    return (
        <img
            src={resolveProductImage(image)}
            alt={alt}
            onError={() => setFailed(true)}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
    );
}

export function StoreProduct({ products, loading }) {
    const navigate = useNavigate();
    const [openDetail, setOpenDetail] = useState(false);
    const [selectedDetail, setSelectedDetail] = useState(null);

    const handleBuy = (event, product) => {
        event.stopPropagation();
        const listingId = Number(product?.ListingId || product?.id);
        if (Number.isSafeInteger(listingId) && listingId > 0) {
            navigate(`/orders/create/${listingId}`);
        }
    };

    const getDetailProduct = (product) => ({
        id: product.ListingId || product.id,
        name: product.Title || product.Name || "Sản phẩm chưa có tên",
        price: Number(product.Price),
        status: product.Status || "ACTIVE",
        condition: product.ConditionLevel || "",
        location: product.Location || "Chưa cập nhật",
        description: product.Description || "",
        knownDefects: product.KnownDefects || "",
        postedAt: product.CreatedAt
            ? new Date(product.CreatedAt).toLocaleDateString("vi-VN")
            : "",
        seller: product.Seller?.FullName || "Người bán",
        sellerId: product.SellerId,
        image: resolveProductImage(getProductImage(product)) || "/product-placeholder.svg",
    });

    return (
        <>
            <section className="mt-10">

                <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                        <div className="flex items-center gap-3">
                            <Package className="h-6 w-6 text-emerald-600" />

                            <h2 className="text-2xl font-bold text-slate-900">
                                Sản phẩm của cửa hàng
                            </h2>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
                        Đang tải sản phẩm...
                    </div>
                ) : products.length === 0 ? (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">

                            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-50">
                                <Package className="h-10 w-10 text-emerald-500" />
                            </div>

                            <h3 className="text-lg font-bold text-slate-800">
                                Chưa có sản phẩm
                            </h3>

                            <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                                Cửa hàng hiện chưa có sản phẩm nào được đăng bán.
                                Hãy thêm sản phẩm để bắt đầu kinh doanh.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {products.map((product) => {
                            const image = getProductImage(product);

                            return (
                                <div
                                    key={
                                        product.ListingId ||
                                        product.id
                                    }
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => {
                                        setSelectedDetail(product);
                                        setOpenDetail(true);
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault();
                                            setSelectedDetail(product);
                                            setOpenDetail(true);
                                        }
                                    }}
                                    aria-label={`Xem chi tiết ${product.Title || product.Name || "sản phẩm"}`}
                                    className="group cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                                >

                                    {/* IMAGE */}
                                    <div className="relative h-52 overflow-hidden bg-slate-100">

                                        <ProductImage
                                            image={image}
                                            alt={product.Title || product.Name || "Sản phẩm"}
                                        />

                                    </div>

                                    {/* CONTENT */}
                                    <div className="p-4">

                                        <h3 className="line-clamp-2 min-h-12 font-semibold text-slate-800">
                                            {product.Title ||
                                                product.Name ||
                                                "Sản phẩm chưa có tên"}
                                        </h3>

                                        <p className="mt-3 text-lg font-bold text-emerald-600">
                                            {formatPrice(
                                                product.Price
                                            )}
                                        </p>

                                        {product.Description && (
                                            <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-500">
                                                {
                                                    product.Description
                                                }
                                            </p>
                                        )}

                                        <button
                                            type="button"
                                            onClick={(event) => handleBuy(event, product)}
                                            disabled={product.Status !== "ACTIVE"}
                                            className={`mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition ${
                                                product.Status === "ACTIVE"
                                                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                                    : "cursor-not-allowed bg-slate-100 text-slate-400"
                                            }`}
                                        >
                                            <ShoppingBag size={16} />
                                            {product.Status === "ACTIVE" ? "Mua hàng" : "Không khả dụng"}
                                        </button>

                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {openDetail && selectedDetail && (
                <ListingDetail
                    product={getDetailProduct(selectedDetail)}
                    onClose={() => {
                        setOpenDetail(false);
                        setSelectedDetail(null);
                    }}
                />
            )}
        </>
    );
}