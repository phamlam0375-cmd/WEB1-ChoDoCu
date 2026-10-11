import { getStoreListing, hideListing, updateListing } from "../../api/listingApi";
import { useEffect, useState } from "react";

import Header from "../Header";
import UpdateListingModal from "./UpdateListingModal";
import { toast } from "react-toastify";

export default function CrudListing() {
    const [listing, setListing] = useState([]);
    const [openUpdate, setOpenUpdate] = useState(false);
    const [selectedListing, setSelectedListing] = useState(null);

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const conditionLabels = {
        LIKE_NEW: "Như mới",
        GOOD: "Tốt",
        FAIR: "Khá",
        POOR: "Kém",
        NEW: "Mới",
        USED: "Đã qua sử dụng",
    };

    const statusColors = {
        PENDING: "bg-yellow-100 text-yellow-700",
        ACTIVE: "bg-green-100 text-green-700",
        HIDDEN: "bg-gray-100 text-gray-700",
        SOLD: "bg-blue-100 text-blue-700",
        REJECTED: "bg-red-100 text-red-700",
        DELETED: "bg-gray-200 text-gray-500",
    };
    const statusLabels = {
        PENDING: "Chờ duyệt",
        ACTIVE: "Đang bán",
        HIDDEN: "Đã ẩn",
        SOLD: "Đã bán",
        REJECTED: "Bị từ chối",
        DELETED: "Đã xóa",
    };

    useEffect(() => {
        const fetchSellerListing = async () => {
            try {
                const res = await getStoreListing(6, page, 10);
                setListing(res.data);
                setTotalPages(res.pagination.totalPages);
            } catch (error) {
                console.log("error ====> ", error);
            }
        };

        fetchSellerListing();
    }, [page]);

    const handleUpdate = async (data) => {
        try {
            await updateListing(data.ListingId, data);
            setOpenUpdate(false);
            setSelectedListing(null);

            const res = await getStoreListing(6);
            setListing(res.data)
        }
        catch (error) {
            console.error("Loi cap nhat ", error)
        }
    }

    const handleHide = async (item) => {
        console.log("Listing đầu tiên:", listing[0]);
        if (!["ACTIVE", "HIDDEN"].includes(item.Status)) {
            toast.warning(
                "Chỉ có thể ẩn hoặc hiện sản phẩm đang bán hoặc đã ẩn"
            );
            return;
        }

        try {
            await hideListing(item.ListingId);
            const res = await getStoreListing(6, page, 10);
            setListing(res.data);
            setTotalPages(res.pagination.totalPages);
        }
        catch (error) {
            console.error("Loi ẩn sản phẩm ", error)
        }
    }

    return (
        <>
            <Header />

            <main className="min-h-screen bg-slate-50/50 px-6 py-10 font-sans text-slate-800">
                <div className="mx-auto max-w-7xl">
                    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                                Sản phẩm của tôi
                            </h1>
                        </div>

                        <button className=" inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-200 transition duration-150 ease-in-out hover:bg-emerald-700 hover:shadow-md hover:shadow-emerald-200  active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            Thêm sản phẩm
                        </button>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                        <div
                            className="grid grid-cols-[2.8fr_1.2fr_1fr_1.2fr_1fr]  items-center gap-4 border-b border-emerald-100/60 bg-emerald-50/60 px-6 py-3.5  text-xs font-bold uppercase tracking-wider text-emerald-800 " >
                            <span>Sản phẩm</span>
                            <span>Giá</span>
                            <span>Tình trạng</span>
                            <span>Trạng thái</span>
                            <span className="text-right">Thao tác</span>
                        </div>

                        <div className="divide-y divide-slate-100">
                            {listing.map((item) => (
                                <div key={item.ListingId} className=" grid grid-cols-[2.8fr_1.2fr_1fr_1.2fr_1fr] items-center gap-4 px-6 py-4.5 transition-colors duration-150 hover:bg-emerald-50/20">
                                    <div className="min-w-0 pr-2">
                                        <h3 className="truncate font-semibold text-slate-900">
                                            {item.Title}
                                        </h3>

                                        <p className="mt-0.5 truncate text-sm text-slate-500">
                                            {item.Description}
                                        </p>

                                        <p className="mt-1 text-xs text-slate-400">
                                            Lỗi:{" "}
                                            <span className="text-slate-500">
                                                {item.KnownDefects || "Không có"}
                                            </span>
                                        </p>
                                    </div>

                                    <div>
                                        <p className="font-bold text-emerald-700">
                                            {Number(item.Price)}
                                        </p>
                                    </div>

                                    <div>
                                        <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium">
                                            {conditionLabels[item.ConditionLevel]}
                                        </span>
                                    </div>

                                    <div>
                                        <span
                                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusColors[item.Status] || "bg-gray-100 text-gray-700"
                                                }`}
                                        >
                                            {statusLabels[item.Status] || item.Status}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-end gap-3">
                                        <button
                                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-2xs transition hover:border-emerald-300 hover:bg-emerald-100"
                                            onClick={() => {
                                                setSelectedListing(item);
                                                setOpenUpdate(true);
                                            }}
                                        >
                                            Sửa
                                        </button>

                                       <button
                                            type="button"
                                            role="switch"
                                            aria-checked={item.Status === "ACTIVE"}
                                            aria-label={
                                                item.Status === "HIDDEN"
                                                    ? `Hiện sản phẩm ${item.Title}`
                                                    : `Ẩn sản phẩm ${item.Title}`
                                            }
                                            title={
                                                item.Status === "HIDDEN"
                                                    ? "Hiện sản phẩm"
                                                    : "Ẩn sản phẩm"
                                            }
                                            disabled={!["ACTIVE", "HIDDEN"].includes(item.Status)}
                                            onClick={() => handleHide(item)}
                                            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 ${
                                                item.Status === "ACTIVE"
                                                    ? "bg-emerald-500"
                                                    : "bg-gray-300"
                                            }`}
                                        >
                                            <span
                                                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                                                    item.Status === "ACTIVE"
                                                        ? "translate-x-5"
                                                        : "translate-x-0.5"
                                                }`}
                                            />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/30 px-6 py-4">
                            <p className="text-sm text-slate-500">
                                Hiển thị{" "}
                                <span className="font-semibold text-slate-900">
                                    {listing.length}
                                </span>{" "}
                                sản phẩm — Trang {page}/{totalPages}
                            </p>

                            <div className="flex items-center gap-1.5">
                                <button
                                    disabled={page <= 1}
                                    onClick={() => setPage((prev) => prev - 1)}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Trước
                                </button>

                                {Array.from({ length: totalPages }, (_, index) => index + 1).map(
                                    (pageNumber) => (
                                        <button
                                            key={pageNumber}
                                            onClick={() => setPage(pageNumber)}
                                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${page === pageNumber
                                                ? "bg-emerald-600 text-white"
                                                : "border border-slate-200 bg-white text-slate-600 hover:bg-emerald-50"
                                                }`}
                                        >
                                            {pageNumber}
                                        </button>
                                    )
                                )}

                                <button
                                    disabled={page >= totalPages}
                                    onClick={() => setPage((prev) => prev + 1)}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Sau
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main >
            {
                openUpdate &&
                <UpdateListingModal
                    listing={selectedListing}
                    onClose={() => setSelectedListing(false)}
                    onSubmit={handleUpdate}
                />
            }
        </>
    );
}