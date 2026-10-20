import { Eye, Package } from "lucide-react";

import DetailListing from "../../pages/Store/SellerStore/DetailListing";
import { useState } from "react";

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
const [openDetail, setOpenDetail] = useState(false);
    const [selectedDetail, setSelectedDetail] = useState(null);

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
                                    className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-md"
                                >

                                    {/* IMAGE */}
                                    <div className="relative h-52 overflow-hidden bg-slate-100">

                                        <ProductImage
                                            image={image}
                                            alt={product.Title || product.Name || "Sản phẩm"}
                                        />

                                        {/* STATUS */}
                                        {product.Status && (
                                            <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
                                                {
                                                    product.Status
                                                }
                                            </span>
                                        )}
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
                                            onClick={() => {
                                                setSelectedDetail(product);
                                                setOpenDetail(true);
                                            }}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-600 hover:text-white"
                                        >
                                            <Eye size={14} />
                                            Chi tiết
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {openDetail && selectedDetail && (
                <DetailListing
                    product={selectedDetail}
                    onClose={() => {
                        setOpenDetail(false);
                        setSelectedDetail(null);
                    }}
                />
            )}
        </>
    );
}