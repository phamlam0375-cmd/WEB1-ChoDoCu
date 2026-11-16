import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useState } from "react";

const statusLabels = {
    PENDING: "Chờ duyệt",
    ACTIVE: "Đang bán",
    RESERVED: "Đã đặt",
    SOLD: "Đã bán",
    HIDDEN: "Đã ẩn",
    REJECTED: "Bị từ chối",
};

const conditionLabels = {
    NEW: "Mới",
    LIKE_NEW: "Như mới",
    GOOD: "Tốt",
    FAIR: "Khá",
    POOR: "Kém",
};

const resolveImageUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("/demo/listings/")) return `/api/v1/uploads/listings/${url.slice("/demo/listings/".length)}`;
    if (url.startsWith("/listings/")) return `/api/v1/uploads${url}`;
    return url;
};

export default function ListingDetailModal({ listing, onClose }) {
    const [activeImage, setActiveImage] = useState(0);

    useEffect(() => {
        setActiveImage(0);
    }, [listing?.ListingId]);

    if (!listing) return null;

    const images = (listing.Media || [])
        .filter((media) => media.MediaType === "IMAGE" && media.MediaUrl)
        .sort((first, second) => Number(first.SortOrder || 0) - Number(second.SortOrder || 0));
    const image = images[activeImage];

    const showPreviousImage = () => {
        setActiveImage((current) => (current - 1 + images.length) % images.length);
    };

    const showNextImage = () => {
        setActiveImage((current) => (current + 1) % images.length);
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="listing-detail-title"
            onMouseDown={(event) => event.target === event.currentTarget && onClose()}
        >
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Chi tiết sản phẩm</p>
                        <h2 id="listing-detail-title" className="mt-1 truncate text-xl font-bold text-slate-900">
                            {listing.Title}
                        </h2>
                    </div>
                    <button type="button" onClick={onClose} className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Đóng">
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-5 p-5">
                    {image && (
                        <div className="relative rounded-xl bg-slate-100 p-2">
                            <img
                                src={resolveImageUrl(image.MediaUrl)}
                                alt={`${listing.Title} - ảnh ${activeImage + 1}`}
                                className="h-64 w-full object-contain"
                            />
                            {images.length > 1 && (
                                <>
                                    <button
                                        type="button"
                                        onClick={showPreviousImage}
                                        aria-label="Ảnh trước"
                                        className="absolute left-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-slate-900/70 text-white hover:bg-slate-900"
                                    >
                                        <ChevronLeft size={18} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={showNextImage}
                                        aria-label="Ảnh tiếp theo"
                                        className="absolute right-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-slate-900/70 text-white hover:bg-slate-900"
                                    >
                                        <ChevronRight size={18} />
                                    </button>
                                    <span className="absolute bottom-3 right-3 rounded-full bg-slate-900/75 px-2.5 py-1 text-xs font-semibold text-white">
                                        {activeImage + 1}/{images.length}
                                    </span>
                                </>
                            )}
                        </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl bg-emerald-50 p-4">
                            <p className="text-sm text-slate-500">Giá bán</p>
                            <p className="mt-1 text-xl font-bold text-emerald-700">
                                {Number(listing.Price).toLocaleString("vi-VN")} VNĐ
                            </p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-4">
                            <p className="text-sm text-slate-500">Trạng thái</p>
                            <p className="mt-1 font-semibold text-slate-900">{statusLabels[listing.Status] || listing.Status}</p>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-bold text-slate-900">Mô tả</h3>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{listing.Description || "Chưa có mô tả"}</p>
                    </div>

                    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                        <div>
                            <dt className="text-slate-500">Tình trạng</dt>
                            <dd className="font-medium text-slate-900">{conditionLabels[listing.ConditionLevel] || listing.ConditionLevel}</dd>
                        </div>
                        <div>
                            <dt className="text-slate-500">Địa điểm</dt>
                            <dd className="font-medium text-slate-900">{listing.Location || "Chưa cập nhật"}</dd>
                        </div>
                        <div className="sm:col-span-2">
                            <dt className="text-slate-500">Lỗi hoặc khuyết điểm</dt>
                            <dd className="font-medium text-slate-900">{listing.KnownDefects || "Không có"}</dd>
                        </div>
                    </dl>
                </div>
            </div>
        </div>
    );
}
