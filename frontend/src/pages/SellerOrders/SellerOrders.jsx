import { useEffect, useState } from "react";

import Header from "../../components/Header";
import getOrders from "../../services/sellerOrderApi";

const SellerOrder = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

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

    const handleAccept = (orderId) => {
        console.log("Chấp nhận đơn:", orderId);
    };

    const handleReject = (orderId) => {
        console.log("Từ chối đơn:", orderId);
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
                            <table className="w-full min-w-[850px] text-left">
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
                                                            onClick={() =>
                                                                handleAccept(order.OrderId)
                                                            }
                                                            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                                                        >
                                                            Chấp nhận
                                                        </button>

                                                        <button
                                                            onClick={() =>
                                                                handleReject(order.OrderId)
                                                            }
                                                            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
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