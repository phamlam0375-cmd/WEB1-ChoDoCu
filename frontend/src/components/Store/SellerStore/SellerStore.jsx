import "leaflet/dist/leaflet.css";

import { useEffect, useState } from "react";

import { getStoreByOwnerId } from "../../../api/store";
import {
    AlertCircle
} from "lucide-react";
import Header from "../../Header";
import RightSummary from "./RightSummary";
import StoreInformation from "../StoreInformation";
import StoreLoadingSkeleton from "../StoreLoadingSkeleton";
import StoreMap from "../StoreMap";
import { StoreProduct } from "../StoreProduct";

export default function SellerStore() {
    // const { ownerId } = useParams();
    const ownerId = 6;

    const [store, setStore] = useState(null);
    const [products, setProducts] = useState([]);

    const [loadingStore, setLoadingStore] = useState(true);
    const [productLoading, setProductLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchStore = async () => {
            if (!ownerId) {
                setError("Không tìm thấy OwnerId");
                setLoadingStore(false);
                return;
            }

            try {
                setLoadingStore(true);
                setError("");
                //fake loading 300mls
                await new Promise((resolve) => setTimeout(resolve, 400))

                const storeResponse = await getStoreByOwnerId(ownerId);
                const storeData = storeResponse.data;

                console.log("Store API:", storeData);

                const storeInfo = storeData.data || storeData;

                setStore(storeInfo);

                // =========================
                // LẤY SẢN PHẨM CỦA SHOP
                // =========================
                if (storeInfo?.StoreId) {
                    try {
                        setProductLoading(true);

                        const productResponse = await fetch(
                            `/api/listings/store/${storeInfo.StoreId}`
                        );

                        if (!productResponse.ok) {
                            throw new Error(
                                `HTTP ${productResponse.status}`
                            );
                        }

                        const productData =
                            await productResponse.json();

                        console.log(
                            "Products API:",
                            productData
                        );

                        setProducts(
                            productData.data || productData || []
                        );
                    } catch (productError) {
                        console.error(
                            "Lấy sản phẩm thất bại:",
                            productError
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

                setError(
                    error.message ||
                    "Không thể lấy thông tin cửa hàng"
                );
            } finally {
                setLoadingStore(false);
            }
        };

        fetchStore();
    }, [ownerId]);

    // =========================
    // LOADING
    // =========================

    if (loadingStore) {
        return (
            <>
                <Header />

                <main className="min-h-screen bg-linear-to-br from-emerald-50 via-white to-white">
                    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                        <StoreLoadingSkeleton />
                    </div>
                </main>
            </>
        );
    }

    // =========================
    // ERROR
    // =========================

    if (error || !store) {
        return (
            <>
                <Header />

                <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-slate-50 px-4">
                    <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
                            <AlertCircle className="h-7 w-7 text-red-600" />
                        </div>

                        <h2 className="text-xl font-bold text-slate-800">
                            Không thể tải cửa hàng
                        </h2>

                        <p className="mt-2 text-sm text-slate-500">
                            {error ||
                                "Không tìm thấy thông tin cửa hàng."}
                        </p>
                    </div>
                </div>
            </>
        );
    }

    // =========================
    // DATA
    // =========================

    const latitude = Number(store.Latitude);
    const longitude = Number(store.Longitude);

    const hasLocation =
        Number.isFinite(latitude) &&
        Number.isFinite(longitude);

    const isActive =
        String(store.Status || "").toUpperCase() ===
        "ACTIVE";

    return (
        <>
            <Header />

            <main className="min-h-screen bg-linear-to-br from-emerald-50 via-white to-white">
                <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                    <div className="grid gap-6 lg:grid-cols-3">
                        <div className="lg:col-span-2">
                            <StoreInformation
                                store={store}
                                isActive={isActive}
                            />
                            <StoreMap
                                store={store}
                                latitude={latitude}
                                longitude={longitude}
                                hasLocation={hasLocation}
                            />
                        </div >
                        <RightSummary
                            store={store}
                            onStoreUpdated={(updatedStore) =>
                                setStore(updatedStore)
                            }
                        />

                    </div>
                    <StoreProduct
                        products={products}
                        loading={productLoading}
                    />
                </div>
            </main>
        </>
    );
}