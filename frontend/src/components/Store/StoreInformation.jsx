import { MapPin, Phone, Store as StoreIcon } from "lucide-react";

export default function StoreInformation({ store, isActive }) {
    return (
        <>
        <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">

            {/* TOP */}
            <div className="border-b border-slate-100 p-6">
                <div className="flex items-start gap-4">

                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-100">
                        <StoreIcon className="h-8 w-8 text-emerald-600" />
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                            <h2 className="text-xl font-bold text-slate-800">
                                {store.StoreName ||
                                    "Chưa có tên"}
                            </h2>

                            <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${isActive
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-slate-100 text-slate-600"
                                    }`}
                            >
                                {isActive
                                    ? "ĐANG HOẠT ĐỘNG"
                                    : "NGƯNG HOẠT ĐỘNG"}
                            </span>
                        </div>

                        <p className="mt-2 text-sm text-slate-500">
                            Mã cửa hàng:{" "}
                            <span className="font-medium text-slate-700">
                                {store.StoreId ||
                                    "—"}
                            </span>
                        </p>
                    </div>
                </div>
            </div>

            {/* INFORMATION */}
            <div className="grid gap-5 p-6 md:grid-cols-2">

                {/* ADDRESS */}
                <div className="rounded-xl bg-emerald-50 p-5">
                    <div className="mb-3 flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-emerald-600" />

                        <h3 className="font-semibold text-slate-800">
                            Địa chỉ
                        </h3>
                    </div>

                    <p className="text-sm leading-6 text-slate-600">
                        {store.Address ||
                            "Chưa cập nhật địa chỉ"}
                    </p>
                </div>

                {/* PHONE */}
                <div className="rounded-xl bg-emerald-50 p-5">
                    <div className="mb-3 flex items-center gap-2">
                        <Phone className="h-5 w-5 text-emerald-600" />

                        <h3 className="font-semibold text-slate-800">
                            Số điện thoại
                        </h3>
                    </div>

                    <p className="text-sm leading-6 text-slate-600">
                        {store.Phone ||
                            "Chưa cập nhật số điện thoại"}
                    </p>
                </div>

                {/* DESCRIPTION */}
                <div className="rounded-xl bg-slate-50 p-5 md:col-span-2">
                    <h3 className="mb-3 font-semibold text-slate-800">
                        Giới thiệu cửa hàng
                    </h3>

                    <p className="text-sm leading-7 text-slate-600">
                        {store.Description ||
                            "Cửa hàng chưa có mô tả."}
                    </p>
                </div>

            </div>
        </div>
        </>
    );
}
