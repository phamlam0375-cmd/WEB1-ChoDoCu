import { useEffect } from "react";
import { useListingStore } from "../../../store/useListing";

export default function DetailListing({ product, listingId, onClose }) {
    const listing = useListingStore((state) => state.listing);

    const item =
        product ||
        listing.find(
            (listingItem) =>
                Number(listingItem.ListingId) === Number(listingId)
        );

    const conditionLabels = {
        LIKE_NEW: "Như mới",
        GOOD: "Tốt",
        FAIR: "Khá",
        POOR: "Kém",
        NEW: "Mới",
        USED: "Đã qua sử dụng",
    };

    const statusLabels = {
        DRAFT: "Bản nháp",
        PENDING: "Chờ duyệt",
        ACTIVE: "Đang bán",
        RESERVED: "Đã giữ món",
        SOLD: "Đã bán",
        HIDDEN: "Đã ẩn",
        REJECTED: "Bị từ chối",
        DELETED: "Đã xóa",
    };

    const statusColors = {
        DRAFT: "bg-gray-100 text-gray-700",
        PENDING: "bg-yellow-100 text-yellow-700",
        ACTIVE: "bg-emerald-100 text-emerald-700",
        RESERVED: "bg-orange-100 text-orange-700",
        SOLD: "bg-blue-100 text-blue-700",
        HIDDEN: "bg-gray-100 text-gray-600",
        REJECTED: "bg-red-100 text-red-700",
        DELETED: "bg-gray-200 text-gray-500",
    };

    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === "Escape") onClose();
        };

        document.addEventListener("keydown", handleEscape);

        return () => {
            document.removeEventListener("keydown", handleEscape);
        };
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm sm:p-6"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="detail-listing-title"
                className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
                {/* Header modal */}
                <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-7">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
                            Chi tiết sản phẩm
                        </h2>
                        <p className="mt-1 text-xs text-slate-500">
                            Thông tin sản phẩm trên Chợ Đồ Cũ
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Đóng modal"
                        className="flex h-10 w-10 items-center justify-center rounded-full text-2xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                    >
                        ×
                    </button>
                </div>

                {/* Nội dung modal */}
                <div className="overflow-y-auto p-5 sm:p-7">
                    {!item ? (
                        <div className="py-12 text-center">
                            <div className="text-5xl">📦</div>
                            <h3 className="mt-4 font-bold text-slate-800">
                                Không tìm thấy sản phẩm
                            </h3>
                            <p className="mt-2 text-sm text-slate-500">
                                Sản phẩm không tồn tại trong dữ liệu đang lưu.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Tên và trạng thái */}
                            <div className="mb-6">
                                <div className="mb-3 flex flex-wrap items-center gap-2">
                                    <span className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                                        MÃ SP: #{item.ListingId}
                                    </span>

                                    <span
                                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                            statusColors[item.Status] ||
                                            "bg-gray-100 text-gray-700"
                                        }`}
                                    >
                                        {statusLabels[item.Status] || item.Status}
                                    </span>
                                </div>

                                <h3
                                    id="detail-listing-title"
                                    className="text-xl font-bold leading-snug text-slate-900 sm:text-2xl"
                                >
                                    {item.Title}
                                </h3>
                            </div>

                            <div className="grid gap-7 lg:grid-cols-5">
                                {/* Hình ảnh và mô tả */}
                                <div className="space-y-7 lg:col-span-3">
                                    <div className="flex min-h-60 items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 sm:min-h-80">
                                        {item.Images?.length > 0 ? (
                                            <img
                                                src={
                                                    typeof item.Images[0] === "string"
                                                        ? item.Images[0]
                                                        : item.Images[0].ImageUrl
                                                }
                                                alt={item.Title}
                                                className="max-h-96 w-full object-contain"
                                            />
                                        ) : (
                                            <div className="py-12 text-center text-slate-400">
                                                <div className="text-7xl">📦</div>
                                                <p className="mt-3 text-sm">
                                                    Chưa có hình ảnh sản phẩm
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <section>
                                        <h4 className="border-l-4 border-emerald-500 pl-3 font-bold text-slate-800">
                                            Mô tả sản phẩm
                                        </h4>

                                        <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">
                                            {item.Description || "Chưa có mô tả sản phẩm."}
                                        </p>
                                    </section>

                                    <section>
                                        <h4 className="border-l-4 border-emerald-500 pl-3 font-bold text-slate-800">
                                            Tình trạng và khuyết điểm
                                        </h4>

                                        <div className="mt-4 rounded-xl bg-slate-50 p-4">
                                            <p className="text-sm text-slate-500">
                                                Tình trạng
                                            </p>
                                            <p className="mt-1 font-semibold text-slate-800">
                                                {conditionLabels[item.ConditionLevel] ||
                                                    item.ConditionLevel ||
                                                    "Chưa cập nhật"}
                                            </p>

                                            <div className="my-4 border-t border-slate-200" />

                                            <p className="text-sm text-slate-500">
                                                Khuyết điểm
                                            </p>
                                            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-700">
                                                {item.KnownDefects || "Không có"}
                                            </p>
                                        </div>
                                    </section>
                                </div>

                                {/* Thông tin bên phải */}
                                <aside className="lg:col-span-2">
                                    <div className="rounded-2xl border border-slate-200 p-5">
                                        <p className="text-sm font-medium text-slate-500">
                                            Giá bán
                                        </p>

                                        <p className="mt-2 text-3xl font-extrabold text-emerald-700">
                                            {Number(item.Price).toLocaleString("vi-VN")}{" "}
                                            <span className="text-lg">₫</span>
                                        </p>

                                        <div className="my-5 border-t border-slate-100" />

                                        <h4 className="font-bold text-slate-800">
                                            Thông tin chi tiết
                                        </h4>

                                        <div className="mt-4 space-y-4">
                                            {[
                                                ["Mã sản phẩm", `#${item.ListingId}`],
                                                ["Danh mục", item.CategoryId ?? "Chưa cập nhật"],
                                                [
                                                    "Tình trạng",
                                                    conditionLabels[item.ConditionLevel] ||
                                                        item.ConditionLevel ||
                                                        "Chưa cập nhật",
                                                ],
                                            ].map(([label, value]) => (
                                                <div
                                                    key={label}
                                                    className="flex items-start justify-between gap-3"
                                                >
                                                    <span className="text-sm text-slate-500">
                                                        {label}
                                                    </span>
                                                    <span className="text-right text-sm font-semibold text-slate-800">
                                                        {value}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </aside>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer modal */}
                <div className="flex shrink-0 justify-end border-t border-slate-100 bg-white px-5 py-4 sm:px-7">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
}