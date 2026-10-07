import {
    MapPin,
    Package,
    Pencil,
    Phone,
    Store as StoreIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import Header from "../../Header";
import { useParams } from "react-router-dom";
import { getStoreByOwnerId } from "../../../api/store";

export default function PublicStore() {
    const { ownerId } = useParams();

    const [store, setStore] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStore = async () => {
            try {
                const response = await getStoreByOwnerId(ownerId);
                const data = response.data;

                setStore(data.data || data);
            } catch (error) {
                console.error(
                    "Lấy thông tin cửa hàng thất bại:",
                    error
                );
            } finally {
                setLoading(false);
            }
        };

        fetchStore();
    }, [ownerId]);

    if (loading) {
        return (
            <div className="flex min-h-screen flex-col">
                <Header />

                <div className="flex flex-1 items-center justify-center bg-linear-to-br from-emerald-50 via-white to-white">
                    <p className="text-sm text-slate-500">
                        Đang tải thông tin cửa hàng...
                    </p>
                </div>
            </div>
        );
    }

    if (!store) {
        return (
            <div className="flex min-h-screen flex-col">
                <Header />

                <div className="flex flex-1 items-center justify-center bg-linear-to-br from-emerald-50 via-white to-white">
                    <p className="text-sm text-red-500">
                        Không tìm thấy cửa hàng
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col">
            {/* HEADER */}
            <Header />

            {/* MAIN */}
            <div className="flex w-full flex-1 bg-linear-to-br from-emerald-50 via-white to-white text-slate-900">
                <div className="mx-auto w-full max-w-6xl px-6 py-10">
                    {/* TITLE */}
                    <div className="mb-8">
                        <p className="text-sm font-semibold text-emerald-600">
                            Chợ Đồ Cũ
                        </p>

                        <h1 className="mt-2 text-3xl font-bold text-slate-900">
                            Thông tin cửa hàng
                        </h1>

                        <p className="mt-2 text-sm text-slate-500">
                            Quản lý thông tin và vị trí cửa hàng của bạn.
                        </p>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-3">
                        {/* LEFT */}
                        <div className="space-y-6 lg:col-span-2">
                            {/* STORE */}
                            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-4">
                                        {/* STORE ICON */}
                                        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-emerald-100">
                                            <StoreIcon
                                                size={36}
                                                className="text-emerald-600"
                                            />
                                        </div>

                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h2 className="text-2xl font-bold text-slate-900">
                                                    {store.StoreName}
                                                </h2>

                                                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                                                    {store.Status ||
                                                        "ACTIVE"}
                                                </span>
                                            </div>

                                            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                                                {store.Description ||
                                                    "Chưa có mô tả cửa hàng."}
                                            </p>
                                        </div>
                                    </div>

                                    {/* EDIT */}
                                    <button
                                        type="button"
                                        className="flex shrink-0 items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                                    >
                                        <Pencil size={16} />
                                        Chỉnh sửa
                                    </button>
                                </div>

                                {/* INFO */}
                                <div className="mt-8 grid gap-4 border-t border-slate-100 pt-6 sm:grid-cols-2">
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                                            <MapPin
                                                size={17}
                                                className="text-emerald-600"
                                            />
                                        </div>

                                        <div>
                                            <p className="text-xs font-medium text-slate-400">
                                                Địa chỉ
                                            </p>

                                            <p className="mt-1 text-sm text-slate-700">
                                                {store.Address ||
                                                    "Chưa cập nhật"}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                                            <Phone
                                                size={17}
                                                className="text-emerald-600"
                                            />
                                        </div>

                                        <div>
                                            <p className="text-xs font-medium text-slate-400">
                                                Số điện thoại
                                            </p>

                                            <p className="mt-1 text-sm text-slate-700">
                                                {store.Phone ||
                                                    "Chưa cập nhật"}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* MAP */}
                            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                                <div className="mb-5 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900">
                                            Vị trí cửa hàng
                                        </h2>

                                        <p className="mt-1 text-sm text-slate-500">
                                            Vị trí hiện tại của cửa hàng
                                        </p>
                                    </div>

                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                                        <MapPin
                                            size={19}
                                            className="text-emerald-600"
                                        />
                                    </div>
                                </div>

                                {/* MAP */}
                                <div className="relative flex h-64 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-emerald-50">
                                    <div className="absolute inset-0 bg-[linear-gradient(45deg,#d1fae5_25%,transparent_25%,transparent_75%,#d1fae5_75%),linear-gradient(45deg,#d1fae5_25%,transparent_25%,transparent_75%,#d1fae5_75%)] bg-[length:40px_40px] bg-[position:0_0,20px_20px] opacity-50" />

                                    <div className="relative flex flex-col items-center">
                                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 shadow-lg">
                                            <MapPin
                                                size={28}
                                                className="text-white"
                                            />
                                        </div>

                                        <div className="mt-3 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-md">
                                            {store.StoreName}
                                        </div>
                                    </div>
                                </div>

                                {/* COORDINATES */}
                                <div className="mt-4 grid grid-cols-2 gap-4">
                                    <div className="rounded-xl bg-emerald-50 p-4">
                                        <p className="text-xs font-medium text-emerald-600">
                                            Latitude
                                        </p>

                                        <p className="mt-1 text-sm font-semibold text-slate-700">
                                            {store.Latitude ?? "--"}
                                        </p>
                                    </div>

                                    <div className="rounded-xl bg-emerald-50 p-4">
                                        <p className="text-xs font-medium text-emerald-600">
                                            Longitude
                                        </p>

                                        <p className="mt-1 text-sm font-semibold text-slate-700">
                                            {store.Longitude ?? "--"}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT */}
                        <div className="space-y-6">
                            {/* SUMMARY */}
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                                        <Package
                                            size={20}
                                            className="text-emerald-600"
                                        />
                                    </div>

                                    <div>
                                        <h2 className="text-base font-semibold text-slate-900">
                                            Tổng quan
                                        </h2>

                                        <p className="text-xs text-slate-500">
                                            Thông tin cửa hàng
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-6 space-y-4">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                        <span className="text-sm text-slate-500">
                                            Trạng thái
                                        </span>

                                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                                            {store.Status || "ACTIVE"}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                        <span className="text-sm text-slate-500">
                                            Owner ID
                                        </span>

                                        <span className="text-sm font-semibold text-slate-700">
                                            {ownerId}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-slate-500">
                                            Sản phẩm
                                        </span>

                                        <span className="text-sm font-semibold text-slate-700">
                                            0
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* ACTION */}
                            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                                    <StoreIcon
                                        size={20}
                                        className="text-emerald-600"
                                    />
                                </div>

                                <h3 className="mt-4 font-semibold text-emerald-900">
                                    Quản lý cửa hàng
                                </h3>

                                <p className="mt-2 text-sm leading-6 text-emerald-700">
                                    Cập nhật thông tin cửa hàng, địa chỉ và vị
                                    trí để khách hàng dễ dàng tìm thấy bạn.
                                </p>

                                <button
                                    type="button"
                                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                                >
                                    <Pencil size={16} />
                                    Chỉnh sửa cửa hàng
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}