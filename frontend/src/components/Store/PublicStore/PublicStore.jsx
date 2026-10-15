import {
    MapPin,
    Package,
    Phone,
    Store as StoreIcon,
} from "lucide-react";
import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";

import Header from "../../Header";
import { useParams } from "react-router-dom";
import { getStoreByOwnerId } from "../../../api/store";
import { getStoreListing } from "../../../api/listingApi";
import StoreMap from "../StoreMap";
import { StoreProduct } from "../StoreProduct";

export default function PublicStore() {
    const { ownerId } = useParams();

    const [store, setStore] = useState(null);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [productLoading, setProductLoading] = useState(true);

    useEffect(() => {
        const fetchStore = async () => {
            try {
                const response = await getStoreByOwnerId(ownerId);
                const data = response.data;

                const storeData = data.data || data;
                setStore(storeData);

                if (storeData?.StoreId) {
                    try {
                        const listingResponse = await getStoreListing(
                            storeData.StoreId,
                            1,
                            100
                        );
                        setProducts(listingResponse.data || []);
                    } catch (listingError) {
                        console.error(
                            "Lấy sản phẩm cửa hàng thất bại:",
                            listingError
                        );
                        setProducts([]);
                    } finally {
                        setProductLoading(false);
                    }
                } else {
                    setProducts([]);
                    setProductLoading(false);
                }
            } catch (error) {
                console.error(
                    "Lấy thông tin cửa hàng thất bại:",
                    error
                );
                setProducts([]);
                setProductLoading(false);
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

    const latitude = Number(store.Latitude);
    const longitude = Number(store.Longitude);
    const hasLocation =
        Number.isFinite(latitude) &&
        Number.isFinite(longitude);

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
                            Thông tin, vị trí và sản phẩm đang được cửa hàng đăng bán.
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

                            <StoreMap
                                store={store}
                                latitude={latitude}
                                longitude={longitude}
                                hasLocation={hasLocation}
                            />
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
                                            {productLoading ? "..." : products.length}
                                        </span>
                                    </div>

                                </div>
                            </div>

                        </div>
                    </div>

                    <StoreProduct
                        products={products}
                        loading={productLoading}
                    />
                </div>
            </div>
        </div>
    );
}