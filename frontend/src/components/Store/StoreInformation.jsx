import { MapPin, Phone, Star } from "lucide-react";
import UserAvatar from "../UserAvatar";

const formatReviewDate = (value) => new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
}).format(new Date(value));

export default function StoreInformation({ store }) {
    const reviews = Array.isArray(store.Reviews) ? store.Reviews : [];
    const rating = store.RatingSummary?.average || 0;

    return (
        <>
            <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">

                {/* TOP */}
                <div className="border-b border-slate-100 p-6">
                    <div className="flex items-center gap-4">

                        <UserAvatar
                            user={store.Owner}
                            className="h-16 w-16 rounded-2xl text-lg"
                        />

                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-3">
                                <h2 className="text-xl font-bold text-slate-800">
                                    {store.StoreName ||
                                        "Chưa có tên"}
                                </h2>
                            </div>
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

            <div className="mt-6 overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-lg font-bold text-slate-800">Đánh giá cửa hàng</h3>
                        {rating > 0 && (
                            <div className="flex items-center gap-1 text-amber-500">
                                <Star className="h-5 w-5 fill-current" />
                                <span className="font-bold">{rating}</span>
                                <span className="text-sm text-slate-500">({reviews.length} đánh giá)</span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="divide-y divide-slate-100">
                    {reviews.length ? reviews.map((review) => (
                        <div className="p-6" key={review.ReviewId}>
                            <div className="flex items-center justify-between gap-3">
                                <p className="font-semibold text-slate-800">
                                    {review.reviewer?.FullName || "Khách hàng"}
                                </p>
                                <span className="text-xs text-slate-400">
                                    {formatReviewDate(review.CreatedAt)}
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
        </>
    );
}
