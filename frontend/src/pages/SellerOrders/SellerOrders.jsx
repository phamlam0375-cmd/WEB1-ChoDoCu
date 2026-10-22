import { getOrders, updateOrderStatus } from "../../services/sellerOrderApi";
import { useEffect, useState } from "react";

import Header from "../../components/Header";

const SellerOrder = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [processingId, setProcessingId] = useState(null);
    const [activeModal, setActiveModal] = useState(null);
    const [rejectReason, setRejectReason] = useState("");
    const [actionError, setActionError] = useState("");
    const [notice, setNotice] = useState("");

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                setLoading(true);
                setError("");

                const res = await getOrders();

                const orderData = Array.isArray(res)
                    ? res
                    : Array.isArray(res?.data)
                        ? res.data
                        : [];

                setOrders(orderData);
            } catch (error) {
                console.error("Lỗi lấy đơn hàng:", error);
                setError(
                    error.response?.data?.message ||
                    "Không thể tải danh sách đơn hàng."
                );
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();
    }, []);

    const openAcceptModal = (orderId) => {
        setActionError("");
        setActiveModal({ type: "accept", orderId });
    };
    const openRejectModal = (orderId) => {
        setActionError("");
        setRejectReason("");
        setActiveModal({ type: "reject", orderId });
    };

    const closeModal = () => {
        if (processingId !== null) return;

        setActiveModal(null);
        setRejectReason("");
        setActionError("");
    };

    const handleAccept = async () => {
        const orderId = activeModal?.orderId;
        if (!orderId) return;
        try {
            setProcessingId(orderId);
            setActionError("");

            const res = await updateOrderStatus(orderId, "CONFIRM");

            await fetchOrders();

            setActiveModal({ type: "result" });
            setNotice(res.message);

            await fetchOrders();
        } catch (err) {
            setActionError(
                err.response?.data?.message ||
                "Không thể chấp nhận đơn hàng."
            );
        } finally {
            setProcessingId(null);
        }
    }

    const handleReject = async () => {
        const orderId = activeModal?.orderId;
        if (!orderId) return;

        if (!rejectReason.trim()) {
            setActionError("Vui lòng nhập lý do từ chối.");
            return;
        }

        try {
            setProcessingId(orderId);
            setActionError("");

            const res = await updateOrderStatus(
                orderId,
                "REJECTED",
                rejectReason.trim()
            );

            await fetchOrders();

            setActiveModal({ type: "result" });
            setNotice(res.message || "Đã từ chối đơn hàng.");

            await fetchOrders();
        } catch (err) {
            setActionError(
                err.response?.data?.message ||
                "Không thể từ chối đơn hàng."
            );
        } finally {
            setProcessingId(null);
        }
    };

    const formatPrice = (price) => {
        if (price === null || price === undefined || price === "") {
            return "—";
        }

        return `${Number(price).toLocaleString("vi-VN")} đ`;
    };

    const formatDate = (date) => {
        if (!date) return "—";

        const parsedDate = new Date(date);

        if (Number.isNaN(parsedDate.getTime())) {
            return "—";
        }

        return parsedDate.toLocaleDateString("vi-VN");
    };

    return (
        <>
            <Header />
            {/* Modal xác nhận chấp nhận đơn */}
            {activeModal?.type === "accept" && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                            <svg
                                className="h-7 w-7 text-emerald-600"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="m5 12 4 4L19 6"
                                />
                            </svg>
                        </div>

                        <h2 className="mt-4 text-center text-xl font-bold text-slate-900">
                            Xác nhận đơn hàng
                        </h2>

                        <p className="mt-2 text-center text-sm leading-6 text-slate-500">
                            Bạn có chắc muốn chấp nhận đơn hàng
                            {" "}
                            <span className="font-semibold text-slate-800">
                                #{activeModal.orderId}
                            </span>
                            ? Đơn hàng sẽ chuyển sang trạng thái đã xác nhận.
                        </p>

                        {actionError && (
                            <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                                {actionError}
                            </p>
                        )}

                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={closeModal}
                                disabled={processingId !== null}
                                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                                Hủy
                            </button>

                            <button
                                onClick={handleAccept}
                                disabled={processingId !== null}
                                className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {processingId !== null
                                    ? "Đang xử lý..."
                                    : "Xác nhận"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal nhập lý do từ chối */}
            {activeModal?.type === "reject" && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
                            <svg
                                className="h-7 w-7 text-red-600"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M6 18 18 6M6 6l12 12"
                                />
                            </svg>
                        </div>

                        <h2 className="mt-4 text-center text-xl font-bold text-slate-900">
                            Từ chối đơn hàng
                        </h2>

                        <p className="mt-2 text-center text-sm text-slate-500">
                            Đơn hàng #{activeModal.orderId}
                        </p>

                        <label
                            htmlFor="reject-reason"
                            className="mt-5 block text-sm font-semibold text-slate-700"
                        >
                            Lý do từ chối <span className="text-red-500">*</span>
                        </label>

                        <textarea
                            id="reject-reason"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            maxLength={500}
                            rows={4}
                            placeholder="Nhập lý do từ chối đơn hàng..."
                            className="mt-2 w-full resize-none rounded-xl border border-slate-200 p-3 text-sm outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-50"
                        />

                        <p className="mt-1 text-right text-xs text-slate-400">
                            {rejectReason.length}/500 ký tự
                        </p>

                        {actionError && (
                            <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                                {actionError}
                            </p>
                        )}

                        <div className="mt-5 flex gap-3">
                            <button
                                onClick={closeModal}
                                disabled={processingId !== null}
                                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                                Hủy
                            </button>

                            <button
                                onClick={handleReject}
                                disabled={processingId !== null}
                                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                            >
                                {processingId !== null
                                    ? "Đang xử lý..."
                                    : "Xác nhận từ chối"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal thông báo kết quả */}
            {activeModal?.type === "result" && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                            <svg
                                className="h-7 w-7 text-emerald-600"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="m5 12 4 4L19 6"
                                />
                            </svg>
                        </div>

                        <h2 className="mt-4 text-xl font-bold text-slate-900">
                            Hoàn tất
                        </h2>

                        <p className="mt-2 text-sm text-slate-500">
                            {notice}
                        </p>

                        <button
                            onClick={() => {
                                setActiveModal(null);
                                setRejectReason("");
                                setActionError("");
                            }}
                            className="mt-6 w-full rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            )}
            <main className="min-h-screen bg-slate-50/50 px-4 py-8 font-sans text-slate-800 sm:px-6 sm:py-10">
                <div className="mx-auto max-w-7xl">
                    <div className="mb-8">
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                            Quản lý đơn hàng
                        </h1>

                        <p className="mt-2 text-sm text-slate-500">
                            Xem và xử lý các đơn hàng đang chờ xác nhận.
                        </p>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                            <h2 className="font-semibold text-slate-800">
                                Đơn hàng chờ xử lý
                            </h2>

                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
                                {orders.length} đơn
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full min-w-212.5 text-left">
                                <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-bold uppercase tracking-wider text-slate-500">
                                    <tr>
                                        <th className="px-6 py-4">Mã đơn</th>
                                        <th className="px-6 py-4">Khách hàng</th>
                                        <th className="px-6 py-4">Ngày đặt</th>
                                        <th className="px-6 py-4">Tổng tiền</th>
                                        <th className="px-6 py-4">Trạng thái</th>
                                        <th className="px-6 py-4">Hành động</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        <tr>
                                            <td
                                                colSpan={6}
                                                className="px-6 py-12 text-center text-sm text-slate-500"
                                            >
                                                <div className="flex items-center justify-center gap-3">
                                                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                                                    Đang tải danh sách đơn hàng...
                                                </div>
                                            </td>
                                        </tr>
                                    ) : error ? (
                                        <tr>
                                            <td
                                                colSpan={6}
                                                className="px-6 py-12 text-center font-medium text-red-600"
                                            >
                                                {error}
                                            </td>
                                        </tr>
                                    ) : orders.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={6}
                                                className="px-6 py-12 text-center"
                                            >
                                                <div className="flex flex-col items-center">
                                                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                                                        <svg
                                                            className="h-6 w-6"
                                                            fill="none"
                                                            viewBox="0 0 24 24"
                                                            stroke="currentColor"
                                                            strokeWidth={1.8}
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                                                            />
                                                        </svg>
                                                    </div>

                                                    <p className="font-semibold text-slate-700">
                                                        Không có đơn hàng chờ xử lý
                                                    </p>

                                                    <p className="mt-1 text-sm text-slate-400">
                                                        Các đơn hàng mới sẽ xuất hiện tại đây.
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        orders.map((order) => (
                                            <tr
                                                key={order.OrderId}
                                                className="transition-colors duration-150 hover:bg-emerald-50/20"
                                            >
                                                <td className="px-6 py-4">
                                                    <span className="font-semibold text-slate-900">
                                                        #{order.OrderId}
                                                    </span>
                                                </td>

                                                <td className="px-6 py-4">
                                                    <span className="text-sm text-slate-600">
                                                        {order.BuyerName ||
                                                            order.FullName ||
                                                            order.BuyerId ||
                                                            "—"}
                                                    </span>
                                                </td>

                                                <td className="px-6 py-4 text-sm text-slate-500">
                                                    {formatDate(
                                                        order.CreatedAt ||
                                                        order.createdAt
                                                    )}
                                                </td>

                                                <td className="px-6 py-4">
                                                    <span className="whitespace-nowrap font-bold text-emerald-700">
                                                        {formatPrice(order.TotalAmount)}
                                                    </span>
                                                </td>

                                                <td className="px-6 py-4">
                                                    <span className="inline-flex whitespace-nowrap rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                                                        Đang giữ món
                                                    </span>
                                                </td>

                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => openAcceptModal(order.OrderId)}
                                                            disabled={processingId !== null}
                                                            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                                                        >
                                                            Chấp nhận
                                                        </button>

                                                        <button
                                                            onClick={() => openRejectModal(order.OrderId)}
                                                            disabled={processingId !== null}
                                                            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                                        >
                                                            Từ chối
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
};

export default SellerOrder;