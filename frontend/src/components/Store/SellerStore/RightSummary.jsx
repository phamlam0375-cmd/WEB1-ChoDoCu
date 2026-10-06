import { Package, Pencil } from "lucide-react";

import ModalEditStore from "./ModalEditStore";
import { useState } from "react";

export default function RightSummary({ store, onStoreUpdated }) {
    const [openModalEditStore, setOpenModalEditStore] = useState(false);

    return (
        <>
            <div className="space-y-6">
                <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">

                    <h2 className="mb-4 font-bold text-slate-800">
                        Quản lý cửa hàng
                    </h2>

                    <div className="space-y-3">

                        <button
                            type="button"
                            onClick={() => setOpenModalEditStore(true)}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 px-4 py-3 font-medium text-emerald-700 transition hover:bg-emerald-50"
                        >
                            <Pencil className="h-4 w-4" />
                            Chỉnh sửa thông tin
                        </button>

                        <button
                            type="button"
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-medium text-white transition hover:bg-emerald-700"
                        >
                            <Package className="h-4 w-4" />
                            Quản lý sản phẩm
                        </button>

                    </div>
                </div>
            </div>

            <ModalEditStore
                key={store?.StoreId}
                open={openModalEditStore}
                onClose={() => setOpenModalEditStore(false)}
                store={store}
                onSaved={onStoreUpdated}
            />
        </>
    );
}