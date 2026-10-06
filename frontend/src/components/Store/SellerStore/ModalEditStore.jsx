import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import StoreLocationMap from "./StoreLocationMap";

export default function ModalEditStore({
    open,
    onClose,
    store,
}) {
    const [storeName, setStoreName] = useState(store?.StoreName || "");
    const [description, setDescription] = useState(store?.Description || "");
    const [address, setAddress] = useState(store?.Address || "");
    const [longitude, setLongitude] = useState(store?.Longitude ?? "");
    const [latitude, setLatitude] = useState(store?.Latitude ?? "");

    const [searchingLocation, setSearchingLocation] = useState(false);
    const [locationError, setLocationError] = useState("");

    const storeNameRef = useRef(null);
    const descriptionRef = useRef(null);
    const addressRef = useRef(null);
    const longitudeRef = useRef(null);
    const latitudeRef = useRef(null);

    useEffect(() => {
        if (open) {
            setTimeout(() => {
                storeNameRef.current?.focus();
            }, 100);
        }
    }, [open]);

    const handleKeyDown = (event, nextInputRef) => {
        if (
            event.key === "Enter" &&
            event.currentTarget.tagName !== "TEXTAREA"
        ) {
            event.preventDefault();
            nextInputRef.current?.focus();
        }
    };

    // Tìm tọa độ từ địa chỉ
    const handleFindLocation = async () => {
        if (!address.trim()) {
            setLocationError("Vui lòng nhập địa chỉ.");
            return;
        }

        try {
            setSearchingLocation(true);
            setLocationError("");

            const url =
                "https://nominatim.openstreetmap.org/search" +
                "?format=jsonv2" +
                "&limit=1" +
                "&countrycodes=vn" +
                `&q=${encodeURIComponent(address)}`;

            const response = await fetch(url, {
                headers: {
                    Accept: "application/json",
                },
            });

            if (!response.ok) {
                throw new Error("Không thể tìm địa chỉ.");
            }

            const data = await response.json();

            if (!data.length) {
                setLocationError(
                    "Không tìm thấy vị trí với địa chỉ này."
                );
                return;
            }

            const location = data[0];

            setLatitude(Number(location.lat).toFixed(6));
            setLongitude(Number(location.lon).toFixed(6));
        } catch (error) {
            console.error("Lỗi tìm vị trí:", error);

            setLocationError(
                "Không thể tìm vị trí. Vui lòng thử lại."
            );
        } finally {
            setSearchingLocation(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const data = {
            StoreName: storeName.trim(),
            Description: description.trim(),
            Address: address.trim(),
            Longitude: longitude
                ? Number(longitude)
                : null,
            Latitude: latitude
                ? Number(latitude)
                : null,
        };

        console.log("Dữ liệu cập nhật cửa hàng:", data);

        // TODO:
        // Gọi API PATCH /stores/:ownerId ở đây

        // Ví dụ:
        // await updateStore(store.OwnerId, data);

        onClose();
    };

    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                    <h2 className="text-lg font-bold text-slate-800">
                        Chỉnh sửa thông tin cửa hàng
                    </h2>

                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body */}
                <form
                    onSubmit={handleSubmit}
                    className="flex min-h-0 flex-col"
                >
                    <div className="max-h-[75vh] space-y-5 overflow-y-auto p-6">
                        {/* Tên cửa hàng */}
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">
                                Tên gian hàng
                            </label>

                            <input
                                ref={storeNameRef}
                                type="text"
                                value={storeName}
                                onChange={(e) =>
                                    setStoreName(e.target.value)
                                }
                                onKeyDown={(e) =>
                                    handleKeyDown(
                                        e,
                                        descriptionRef
                                    )
                                }
                                maxLength={255}
                                placeholder="Nhập tên gian hàng"
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                            />
                        </div>

                        {/* Mô tả */}
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">
                                Mô tả
                            </label>

                            <textarea
                                ref={descriptionRef}
                                value={description}
                                onChange={(e) =>
                                    setDescription(e.target.value)
                                }
                                onKeyDown={(e) =>
                                    handleKeyDown(
                                        e,
                                        addressRef
                                    )
                                }
                                rows={4}
                                placeholder="Nhập mô tả cửa hàng"
                                className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                            />
                        </div>

                        {/* Địa chỉ */}
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">
                                Địa chỉ
                            </label>

                            <div className="flex gap-2">
                                <input
                                    ref={addressRef}
                                    type="text"
                                    value={address}
                                    onChange={(e) => {
                                        setAddress(
                                            e.target.value
                                        );
                                        setLocationError("");
                                    }}
                                    onKeyDown={(e) =>
                                        handleKeyDown(
                                            e,
                                            longitudeRef
                                        )
                                    }
                                    maxLength={255}
                                    placeholder="Nhập địa chỉ cửa hàng"
                                    className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                                />

                                <button
                                    type="button"
                                    onClick={handleFindLocation}
                                    disabled={searchingLocation}
                                    className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <Search className="h-4 w-4" />

                                    {searchingLocation
                                        ? "Đang tìm..."
                                        : "Tìm vị trí"}
                                </button>
                            </div>

                            {locationError && (
                                <p className="mt-2 text-sm text-red-500">
                                    {locationError}
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">
                                    Kinh độ
                                </label>

                                <input
                                    ref={longitudeRef}
                                    type="number"
                                    step="any"
                                    value={longitude}
                                    onChange={(e) =>
                                        setLongitude(
                                            e.target.value
                                        )
                                    }
                                    onKeyDown={(e) =>
                                        handleKeyDown(
                                            e,
                                            latitudeRef
                                        )
                                    }
                                    placeholder="Ví dụ: 106.700981"
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">
                                    Vĩ độ
                                </label>

                                <input
                                    ref={latitudeRef}
                                    type="number"
                                    step="any"
                                    value={latitude}
                                    onChange={(e) =>
                                        setLatitude(
                                            e.target.value
                                        )
                                    }
                                    placeholder="Ví dụ: 10.776889"
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                                />
                            </div>
                        </div>

                        {/* Bản đồ */}
                        <div>
                            <div className="mb-2 flex items-center justify-between gap-3">
                                <label className="block text-sm font-medium text-slate-700">
                                    Vị trí trên bản đồ
                                </label>

                                <span className="text-right text-xs text-slate-400">
                                    Click vào bản đồ để chọn vị trí
                                </span>
                            </div>

                            <StoreLocationMap
                                latitude={latitude}
                                longitude={longitude}
                                setLatitude={setLatitude}
                                setLongitude={setLongitude}
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                            Hủy
                        </button>

                        <button
                            type="submit"
                            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700"
                        >
                            Sửa
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}