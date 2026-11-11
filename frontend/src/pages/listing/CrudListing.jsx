import { ChevronLeft, ChevronRight, Loader2, Sparkles } from "lucide-react";
import {
    getSellerVipPromotions,
    getStoreListing,
    hideListing,
    promoteListings,
    updateListing,
} from "../../services/listingApi";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import Header from "../../components/Header";
import UpdateListingModal from "./UpdateListingModal";
import { errorMessage } from "../../lib/api";
import { getStoreByOwnerId } from "../../services/storeApi";
import { toast } from "react-toastify";
import { useDevAccount } from "../../hooks/useDevAccount";
import { useListingStore } from "../../store/useListing";

export default function CrudListing() {
    const listing = useListingStore((state) => state.listing);
    const setListing = useListingStore((state) => state.setListing);
    const [openUpdate, setOpenUpdate] = useState(false);
    const [selectedListing, setSelectedListing] = useState(null);

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [vipInfo, setVipInfo] = useState({ balance: 0, creditUsed: 0, feeVnd: 0, promotions: [] });
    const [vipBusy, setVipBusy] = useState(null);
    const [selectedVipIds, setSelectedVipIds] = useState([]);
    const [vipModalOpen, setVipModalOpen] = useState(false);
    const [vipDurationDays, setVipDurationDays] = useState(7);
    const vipRequestSequence = useRef(0);

    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const storeId = Number(searchParams.get("storeId"));
    const { userId, loading: accountLoading } = useDevAccount();
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
        RESERVED: "Đã đặt",
        HIDDEN: "Đã ẩn",
        SOLD: "Đã bán",
        REJECTED: "Bị từ chối",
        DELETED: "Đã xóa",
    };

    useEffect(() => {
        const fetchSellerListing = async () => {
            try {
                if (accountLoading) return;
                const ownerId = Number(userId);
                if (!Number.isSafeInteger(ownerId) || ownerId <= 0 || !Number.isSafeInteger(storeId) || storeId <= 0) {
                    navigate("/seller/store", { replace: true });
                    return;
                }

                const storeResponse = await getStoreByOwnerId(ownerId);
                const ownedStore = storeResponse.data?.data || storeResponse.data;
                if (Number(ownedStore?.StoreId) !== storeId) {
                    navigate("/seller/store", { replace: true });
                    return;
                }

                const [res, vipResponse] = await Promise.all([
                    getStoreListing(storeId, page, 10),
                    getSellerVipPromotions(),
                ]);
                setListing(res.data);
                setTotalPages(res.pagination.totalPages);
                setVipInfo(vipResponse.data);
            } catch (error) {
                toast.error(errorMessage(error));
            }
        };

        fetchSellerListing();
    }, [accountLoading, page, setListing, storeId, navigate, userId]);

    const refreshVipInfo = async () => {
        const response = await getSellerVipPromotions();
        setVipInfo(response.data);
    };

    const getPromotion = (listingId) => vipInfo.promotions.find(
        (promotion) => Number(promotion.ListingId) === Number(listingId),
    );

    const openVipModal = (ids) => {
        setSelectedVipIds(ids);
        setVipDurationDays(7);
        setVipModalOpen(true);
    };

    const handlePromote = (item) => {
        if (item.Status !== "ACTIVE") {
            toast.warning("Chỉ có thể đẩy tin đang hoạt động lên VIP.");
            return;
        }
        if (getPromotion(item.ListingId)) {
            toast.info("Tin này đang ở trạng thái VIP.");
            return;
        }
        openVipModal([item.ListingId]);
    };

    const toggleVipSelection = (listingId) => {
        setSelectedVipIds((current) => current.includes(listingId)
            ? current.filter((id) => id !== listingId)
            : [...current, listingId]);
    };

    const handleBulkPromote = () => {
        const selected = listing.filter((item) => selectedVipIds.includes(item.ListingId));
        if (!selected.length) return;
        openVipModal(selected.map((item) => item.ListingId));
    };

    const submitVipPromotion = async () => {
        if (!selectedVipIds.length) return;
        const durationMinutes = vipDurationDays * 24 * 60;
        const costPerListing = Number(vipInfo.baseCreditUsed || vipInfo.creditUsed) * (vipDurationDays / 7);
        const totalCost = costPerListing * selectedVipIds.length;
        if (totalCost > Number(vipInfo.balance)) {
            toast.warning(`Số dư không đủ. Cần ${totalCost} credit.`);
            return;
        }
        if (!window.confirm(`Đẩy ${selectedVipIds.length} tin lên VIP trong ${vipDurationDays} ngày với ${totalCost} credit?`)) return;
        setVipBusy("bulk");
        try {
            vipRequestSequence.current += 1;
            await promoteListings(selectedVipIds, `listing-vip-bulk-${vipRequestSequence.current}`, durationMinutes);
            await refreshVipInfo();
            setSelectedVipIds([]);
            setVipModalOpen(false);
            toast.success(`Đã đẩy ${selectedVipIds.length} tin lên VIP.`);
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setVipBusy(null);
        }
    };

    const handleUpdate = async (data) => {
        try {
            await updateListing(data.ListingId, data);
            setOpenUpdate(false);
            setSelectedListing(null);

            const [res, vipResponse] = await Promise.all([
                getStoreListing(storeId, page, 10),
                getSellerVipPromotions(),
            ]);
            setListing(res.data)
            setVipInfo(vipResponse.data);
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
            const res = await getStoreListing(storeId, page, 10);
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

                        <button className=" inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-200 transition duration-150 ease-in-out hover:bg-emerald-700 hover:shadow-md hover:shadow-emerald-200  active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                            onClick={() => navigate(`/seller/listings/create?storeId=${storeId}`)}
                        >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            Thêm sản phẩm
                        </button>
                    </div>

                    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm font-semibold text-amber-900">Tài khoản Credit</p>
                            <p className="mt-1 text-sm text-amber-800">
                                Số dư: <strong>{Number(vipInfo.balance).toLocaleString("vi-VN")} credit</strong>
                                {" · "}Một tin VIP 7 ngày: <strong>{vipInfo.baseCreditUsed || vipInfo.creditUsed} credit</strong>
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate("/credit/packages")}
                            className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
                        >
                            Nạp thêm Credit
                        </button>
                    </div>
                    {selectedVipIds.length > 0 && (
                        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm font-semibold text-emerald-800">
                                Đã chọn {selectedVipIds.length} tin · cần {vipInfo.creditUsed * selectedVipIds.length} credit
                            </p>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setSelectedVipIds([])} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                                    Bỏ chọn
                                </button>
                                <button type="button" disabled={vipBusy === "bulk"} onClick={handleBulkPromote} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                                    Đẩy VIP đã chọn
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                        <div
                            className="grid grid-cols-[2.8fr_1.2fr_1fr_1.2fr_1fr]  items-center gap-4 border-b border-emerald-100/60 bg-emerald-50/60 px-6 py-3.5  text-xs font-bold uppercase tracking-wider text-emerald-800 " >
                            <span className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    aria-label="Chọn tất cả tin có thể đẩy VIP"
                                    checked={listing.filter((item) => item.Status === "ACTIVE" && !getPromotion(item)).length > 0
                                        && listing.filter((item) => item.Status === "ACTIVE" && !getPromotion(item)).every((item) => selectedVipIds.includes(item.ListingId))}
                                    onChange={(event) => {
                                        const eligibleIds = listing.filter((item) => item.Status === "ACTIVE" && !getPromotion(item)).map((item) => item.ListingId);
                                        setSelectedVipIds(event.target.checked ? eligibleIds : []);
                                    }}
                                />
                                Sản phẩm
                            </span>
                            <span>Giá</span>
                            <span>Tình trạng</span>
                            <span>Trạng thái</span>
                            <span className="text-right">Thao tác</span>
                        </div>

                        <div className="divide-y divide-slate-100">
                            {listing.map((item) => (
                                <div key={item.ListingId} className=" grid grid-cols-[2.8fr_1.2fr_1fr_1.2fr_1fr] items-center gap-4 px-6 py-4.5 transition-colors duration-150 hover:bg-emerald-50/20">
                                    <div className="min-w-0 pr-2">
                                        <div className="flex items-start gap-2">
                                            <input
                                                type="checkbox"
                                                aria-label={`Chọn sản phẩm ${item.Title}`}
                                                checked={selectedVipIds.includes(item.ListingId)}
                                                disabled={item.Status !== "ACTIVE" || Boolean(getPromotion(item))}
                                                onChange={() => toggleVipSelection(item.ListingId)}
                                                className="mt-1"
                                            />
                                            <div className="min-w-0">
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
                                        {getPromotion(item) && (
                                            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                                                <Sparkles size={12} /> VIP đến {new Date(getPromotion(item).EndsAt).toLocaleDateString("vi-VN")}
                                            </span>
                                        )}
                                            </div>
                                        </div>
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
                                            type="button"
                                            disabled={vipBusy === item.ListingId || item.Status !== "ACTIVE" || Boolean(getPromotion(item))}
                                            onClick={() => handlePromote(item)}
                                            title={getPromotion(item) ? "Tin đang VIP" : "Đẩy tin lên VIP trong 7 ngày"}
                                            className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:border-amber-300 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {vipBusy === item.ListingId
                                                ? <Loader2 size={14} className="animate-spin" />
                                                : <Sparkles size={14} />}
                                            {getPromotion(item) ? "Đang VIP" : "Đẩy VIP"}
                                        </button>
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
                                            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 ${item.Status === "ACTIVE"
                                                ? "bg-emerald-500"
                                                : "bg-gray-300"
                                                }`}
                                        >
                                            <span
                                                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${item.Status === "ACTIVE"
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
            {vipModalOpen && (() => {
                const count = selectedVipIds.length;
                const baseCredit = Number(vipInfo.baseCreditUsed || vipInfo.creditUsed || 0);
                const maxDays = baseCredit > 0
                    ? Math.floor(Number(vipInfo.balance) / (baseCredit * count / 7)) * 7
                    : 0;
                const durationDays = Math.min(vipDurationDays, Math.max(7, maxDays));
                const totalCredit = baseCredit * (durationDays / 7) * count;
                const insufficientCredit = Number(vipInfo.balance) < totalCredit;
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="vip-dialog-title">
                        <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h2 id="vip-dialog-title" className="text-xl font-bold text-slate-900">Chọn thời gian VIP</h2>
                                    <p className="mt-1 text-sm text-slate-500">{count} tin · kéo thanh trượt để chọn thời lượng</p>
                                </div>
                                <button type="button" onClick={() => setVipModalOpen(false)} className="text-2xl leading-none text-slate-400 hover:text-slate-700" aria-label="Đóng">×</button>
                            </div>
                            <div className="mt-7 rounded-xl bg-emerald-50 p-5 text-center">
                                <p className="text-sm font-medium text-emerald-700">Thời lượng</p>
                                <p className="mt-1 text-4xl font-black text-emerald-700">{durationDays} ngày</p>
                                <div className="mt-5 flex items-center gap-3">
                                    <button
                                        type="button"
                                        disabled={durationDays <= 7}
                                        onClick={() => setVipDurationDays(Math.max(7, durationDays - 7))}
                                        className="rounded-full border border-emerald-200 bg-white p-2 text-emerald-700 shadow-sm hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                                        aria-label="Giảm 7 ngày"
                                    >
                                        <ChevronLeft size={18} />
                                    </button>
                                    <input
                                        type="range"
                                        min="7"
                                        max={Math.max(7, maxDays)}
                                        step="7"
                                        value={durationDays}
                                        onChange={(event) => setVipDurationDays(Number(event.target.value))}
                                        className="w-full accent-emerald-600"
                                        aria-label="Thời lượng VIP"
                                    />
                                    <button
                                        type="button"
                                        disabled={durationDays >= Math.max(7, maxDays)}
                                        onClick={() => setVipDurationDays(Math.min(Math.max(7, maxDays), durationDays + 7))}
                                        className="rounded-full border border-emerald-200 bg-white p-2 text-emerald-700 shadow-sm hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                                        aria-label="Tăng 7 ngày"
                                    >
                                        <ChevronRight size={18} />
                                    </button>
                                </div>
                                <div className="mt-2 flex justify-between text-xs text-emerald-700">
                                    <span>7 ngày</span><span>Tối đa {Math.max(7, maxDays)} ngày</span>
                                </div>
                            </div>
                            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                                <div className="rounded-lg bg-slate-50 p-3"><p className="text-slate-500">Credit cần dùng</p><p className="mt-1 font-bold text-slate-900">{totalCredit} credit</p></div>
                                <div className="rounded-lg bg-slate-50 p-3"><p className="text-slate-500">Còn lại</p><p className={`mt-1 font-bold ${insufficientCredit ? "text-red-600" : "text-emerald-700"}`}>{Number(vipInfo.balance) - totalCredit} credit</p></div>
                            </div>
                            {insufficientCredit && (
                                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                                    Số dư chưa đủ. Vui lòng nạp thêm Credit để đẩy tin VIP.
                                </p>
                            )}
                            <div className="mt-6 flex justify-end gap-2">
                                <button type="button" onClick={() => setVipModalOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Hủy</button>
                                <button type="button" disabled={vipBusy === "bulk" || totalCredit > Number(vipInfo.balance)} onClick={submitVipPromotion} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                                    {vipBusy === "bulk" && <Loader2 size={15} className="animate-spin" />} Xác nhận đẩy VIP
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
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