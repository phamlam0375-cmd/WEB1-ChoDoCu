import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import StoreLocationMap from "./StoreLocationMap";

export default function ModalEditStore({
    open,
    onClose,
    store,
    onSaved,
}) {
    const [storeName, setStoreName] = useState(store?.StoreName || "");
    const [description, setDescription] = useState(store?.Description || "");
    const [address, setAddress] = useState(store?.Address || "");
    const [longitude, setLongitude] = useState(store?.Longitude ?? "");
    const [latitude, setLatitude] = useState(store?.Latitude ?? "");
    const [isDemoLocation, setIsDemoLocation] = useState(Boolean(store?.IsDemoLocation));
    const [bankName, setBankName] = useState(store?.BankName || "");
    const [bankAccountNumber, setBankAccountNumber] = useState(store?.BankAccountNumber || "");
    const [bankAccountHolder, setBankAccountHolder] = useState(store?.BankAccountHolder || "");
    const [qrImageUrl, setQrImageUrl] = useState(store?.QrImageUrl || "");
    const [qrFile, setQrFile] = useState(null);

    const [searchingLocation, setSearchingLocation] = useState(false);
    const [locationError, setLocationError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const [submitError, setSubmitError] = useState("");
    const [saving, setSaving] = useState(false);

    const storeNameRef = useRef(null);
    const descriptionRef = useRef(null);
    const addressRef = useRef(null);
    const longitudeRef = useRef(null);
    const latitudeRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const timer = setTimeout(() => {
            setStoreName(store?.StoreName || "");
            setDescription(store?.Description || "");
            setAddress(store?.Address || "");
            setLongitude(store?.Longitude ?? "");
            setLatitude(store?.Latitude ?? "");
            setIsDemoLocation(Boolean(store?.IsDemoLocation));
            setBankName(store?.BankName || "");
            setBankAccountNumber(store?.BankAccountNumber || "");
            setBankAccountHolder(store?.BankAccountHolder || "");
            setQrImageUrl(store?.QrImageUrl || "");
            setQrFile(null);
            setFieldErrors({});
            setSubmitError("");
            storeNameRef.current?.focus();
        }, 0);
        return () => clearTimeout(timer);
    }, [
        open,
        store?.Address,
        store?.BankAccountHolder,
        store?.BankAccountNumber,
        store?.BankName,
        store?.Description,
        store?.IsDemoLocation,
        store?.Latitude,
        store?.Longitude,
        store?.QrImageUrl,
        store?.StoreName,
    ]);

    const validateField = (field, value) => {
        const limits = {
            StoreName: [/^.{1,120}$/, "Tên gian hàng bắt buộc, tối đa 120 ký tự"],
            Description: [/^.{0,500}$/, "Mô tả tối đa 500 ký tự"],
            Address: [/^.{0,255}$/, "Địa chỉ tối đa 255 ký tự"],
            BankName: [/^.{0,80}$/, "Tên ngân hàng tối đa 80 ký tự"],
            BankAccountNumber: [/^.{0,30}$/, "Số tài khoản tối đa 30 ký tự"],
            BankAccountHolder: [/^.{0,100}$/, "Chủ tài khoản tối đa 100 ký tự"],
        };
        if (limits[field] && !limits[field][0].test(value)) return limits[field][1];
        if (field === "Latitude" && value !== "" && (!Number.isFinite(Number(value)) || Number(value) < -90 || Number(value) > 90)) return "Vĩ độ phải từ -90 đến 90";
        if (field === "Longitude" && value !== "" && (!Number.isFinite(Number(value)) || Number(value) < -180 || Number(value) > 180)) return "Kinh độ phải từ -180 đến 180";
        return "";
    };

    const setField = (field, value, setter) => {
        setter(value);
        setFieldErrors((current) => ({ ...current, [field]: validateField(field, value) }));
    };

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        const nextErrors = {
            StoreName: validateField("StoreName", storeName.trim()),
            Description: validateField("Description", description),
            Address: validateField("Address", address),
            Latitude: validateField("Latitude", latitude),
            Longitude: validateField("Longitude", longitude),
            BankName: validateField("BankName", bankName),
            BankAccountNumber: validateField("BankAccountNumber", bankAccountNumber),
            BankAccountHolder: validateField("BankAccountHolder", bankAccountHolder),
        };
        const errors = Object.fromEntries(Object.entries(nextErrors).filter(([, message]) => message));
        setFieldErrors(errors);
        if (Object.keys(errors).length || !store?.OwnerId) return;

        try {
            setSaving(true);
            setSubmitError("");
            let nextQrImageUrl = qrImageUrl || null;
            if (qrFile) {
                if (!["image/png", "image/jpeg"].includes(qrFile.type) || qrFile.size > 5 * 1024 * 1024) {
                    throw new Error("Ảnh QR chỉ nhận JPG/PNG và tối đa 5MB");
                }
                const uploadResponse = await fetch("/api/v1/uploads", {
                    method: "POST",
                    headers: { "Content-Type": qrFile.type },
                    body: qrFile,
                });
                const uploadResult = await uploadResponse.json();
                if (!uploadResponse.ok) throw new Error(uploadResult.message || "Không thể tải ảnh QR");
                nextQrImageUrl = uploadResult.data.url;
            }

            const data = {
            StoreName: storeName.trim(),
                Description: description.trim() || null,
                Address: address.trim() || null,
                Longitude: longitude === "" ? null : Number(longitude),
                Latitude: latitude === "" ? null : Number(latitude),
                IsDemoLocation: isDemoLocation,
                BankName: bankName.trim() || null,
                BankAccountNumber: bankAccountNumber.trim() || null,
                BankAccountHolder: bankAccountHolder.trim() || null,
                QrImageUrl: nextQrImageUrl,
            };
            const response = await fetch(`/api/stores/${store.OwnerId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || "Cập nhật cửa hàng thất bại");
            onSaved?.(result.data);
            onClose();
        } catch (error) {
            setSubmitError(error.message || "Cập nhật cửa hàng thất bại");
        } finally {
            setSaving(false);
        }
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
                                setField("StoreName", e.target.value, setStoreName)
                                }
                                onKeyDown={(e) =>
                                    handleKeyDown(
                                        e,
                                        descriptionRef
                                    )
                                }
                                maxLength={120}
                                placeholder="Nhập tên gian hàng"
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                            />
                            {fieldErrors.StoreName && <p className="mt-1 text-sm text-red-500">{fieldErrors.StoreName}</p>}
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
                                    setField("Description", e.target.value, setDescription)
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
                            {fieldErrors.Description && <p className="mt-1 text-sm text-red-500">{fieldErrors.Description}</p>}
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
                                        setField("Address", e.target.value, setAddress);
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
                            {fieldErrors.Address && <p className="mt-1 text-sm text-red-500">{fieldErrors.Address}</p>}
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
                                    onChange={(e) => setField("Longitude", e.target.value, setLongitude)}
                                    min="-180"
                                    max="180"
                                    onKeyDown={(e) =>
                                        handleKeyDown(
                                            e,
                                            latitudeRef
                                        )
                                    }
                                    placeholder="Ví dụ: 106.700981"
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                                />
                                {fieldErrors.Longitude && <p className="mt-1 text-sm text-red-500">{fieldErrors.Longitude}</p>}
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
                                    onChange={(e) => setField("Latitude", e.target.value, setLatitude)}
                                    min="-90"
                                    max="90"
                                    placeholder="Ví dụ: 10.776889"
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                                />
                                {fieldErrors.Latitude && <p className="mt-1 text-sm text-red-500">{fieldErrors.Latitude}</p>}
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

                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                                type="checkbox"
                                checked={isDemoLocation}
                                onChange={(e) => setIsDemoLocation(e.target.checked)}
                                className="h-4 w-4 accent-emerald-600"
                            />
                            Vị trí demo
                        </label>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">Tên ngân hàng</label>
                                <input
                                    type="text"
                                    value={bankName}
                                    maxLength={80}
                                    onChange={(e) => setField("BankName", e.target.value, setBankName)}
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                                />
                                {fieldErrors.BankName && <p className="mt-1 text-sm text-red-500">{fieldErrors.BankName}</p>}
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">Số tài khoản</label>
                                <input
                                    type="text"
                                    value={bankAccountNumber}
                                    maxLength={30}
                                    onChange={(e) => setField("BankAccountNumber", e.target.value, setBankAccountNumber)}
                                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                                />
                                {fieldErrors.BankAccountNumber && <p className="mt-1 text-sm text-red-500">{fieldErrors.BankAccountNumber}</p>}
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">Chủ tài khoản</label>
                            <input
                                type="text"
                                value={bankAccountHolder}
                                maxLength={100}
                                onChange={(e) => setField("BankAccountHolder", e.target.value, setBankAccountHolder)}
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                            />
                            {fieldErrors.BankAccountHolder && <p className="mt-1 text-sm text-red-500">{fieldErrors.BankAccountHolder}</p>}
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">Ảnh QR</label>
                            <input
                                type="file"
                                accept="image/png,image/jpeg"
                                onChange={(e) => setQrFile(e.target.files?.[0] || null)}
                                className="block w-full text-sm text-slate-500"
                            />
                            {qrImageUrl && <p className="mt-1 text-xs text-slate-500">Đã có ảnh QR. Chọn ảnh mới để thay đổi.</p>}
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
                            disabled={saving}
                            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700"
                        >
                            {saving ? "Đang lưu..." : "Lưu thông tin"}
                        </button>
                        {submitError && <p className="mr-auto text-sm text-red-500">{submitError}</p>}
                    </div>
                </form>
            </div>
        </div>
    );
}