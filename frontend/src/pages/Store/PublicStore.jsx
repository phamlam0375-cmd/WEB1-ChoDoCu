import {
    MapPin,
    Phone,
    Star,
} from "lucide-react";
import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";

import Header from "../../components/Header";
import { useParams } from "react-router-dom";
import { getStoreByOwnerId } from "../../services/storeApi";
import { getStoreListing } from "../../services/listingApi";
import StoreMap from "../../components/Store/StoreMap";
import { StoreProduct } from "../../components/Store/StoreProduct";
import UserAvatar from "../../components/UserAvatar";

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
                        setProducts(
                            (listingResponse.data || []).filter(
                                (product) => product.Status === "ACTIVE"
                            )
                        );
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
    const reviews = Array.isArray(store.Reviews) ? store.Reviews : [];
    const rating = store.RatingSummary?.average || 0;

    return (
        <div className="flex min-h-screen flex-col">
            <Header />

            <div className="flex w-full flex-1 bg-linear-to-br from-emerald-50 via-white to-white text-slate-900 ">
                <div className="mx-auto w-full max-w-6xl px-6 py-10">
                    <div className="mx-auto grid w-full max-w-4xl gap-6">
                        {/* LEFT */}
                        <div className="space-y-6">
                            {/* STORE */}
                            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-4">
                                        <UserAvatar
                                            user={store.Owner}
                                            className="h-20 w-20 rounded-2xl text-xl"
                                        />

                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h2 className="text-2xl font-bold text-slate-900">
                                                    {store.StoreName}
                                                </h2>
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

                            <div className="rounded-2xl border border-emerald-100 bg-white shadow-sm">
                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-6">
                                    <h3 className="text-lg font-bold text-slate-800">Đánh giá cửa hàng</h3>
                                    {rating > 0 && (
                                        <div className="flex items-center gap-1 text-amber-500">
                                            <Star className="h-5 w-5 fill-current" />
                                            <span className="font-bold">{rating}</span>
                                            <span className="text-sm text-slate-500">({reviews.length} đánh giá)</span>
                                        </div>
                                    )}
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {reviews.length ? reviews.map((review) => (
                                        <div className="p-6" key={review.ReviewId}>
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="font-semibold text-slate-800">
                                                    {review.reviewer?.FullName || "Khách hàng"}
                                                </p>
                                                <span className="text-xs text-slate-400">
                                                    {new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(review.CreatedAt))}
                                                </span>
                                            </div>
                                            <div className="mt-2 flex gap-0.5 text-amber-500" aria-label={`${review.Rating} sao`}>
                                                {Array.from({ length: 5 }, (_, index) => (
                                                    <Star
                                                        className={`h-4 w-4 ${index < review.Rating ? "fill-current" : "text-slate-200"}`}
                                                        key={index}
                                                    />
                                                ))}
                                            </div>
                                            {review.Comment && <p className="mt-3 text-sm leading-6 text-slate-600">{review.Comment}</p>}
                                            {review.Reply && (
                                                <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                                                    <span className="font-semibold text-slate-700">Phản hồi của cửa hàng: </span>
                                                    {review.Reply}
                                                </div>
                                            )}
                                        </div>
                                    )) : (
                                        <p className="p-6 text-sm text-slate-500">Cửa hàng chưa có đánh giá.</p>
                                    )}
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