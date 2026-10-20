import {
    updateStore,
    uploadQrImage,
} from "../../../../api/store";
import { useEffect, useRef, useState } from "react";

import StoreBasicInfo from "./StoreBasicInfo";
import StoreLocationForm from "./StoreLocationForm";
import StorePaymentForm from "./StorePaymentForm";
import StoreQrUpload from "./StoreQrUpload";
import { X } from "lucide-react";

export default function ModalEditStore({
    open,
    onClose,
    store,
    onSaved,
}) {
    const [storeName, setStoreName] = useState("");
    const [description, setDescription] = useState("");
    const [address, setAddress] = useState("");
    const [longitude, setLongitude] = useState("");
    const [latitude, setLatitude] = useState("");
    const [isDemoLocation, setIsDemoLocation] = useState(false);

    const [bankName, setBankName] = useState("");
    const [bankAccountNumber, setBankAccountNumber] =
        useState("");
    const [bankAccountHolder, setBankAccountHolder] =
        useState("");

    const [qrImageUrl, setQrImageUrl] = useState("");
    const [qrFile, setQrFile] = useState(null);

    const [searchingLocation, setSearchingLocation] =
        useState(false);

    const [locationError, setLocationError] =
        useState("");

    const [fieldErrors, setFieldErrors] = useState({});

    const [submitError, setSubmitError] = useState("");

    const [saving, setSaving] = useState(false);

    const storeNameRef = useRef(null);

    // =========================
    // Reset form
    // =========================
    useEffect(() => {
        if (!open) return;

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
            setLocationError("");
            setSubmitError("");
            storeNameRef.current?.focus();
        }, 0);
        return () => clearTimeout(timer);
    }, [open, store]);

    // =========================
    // Validation
    // =========================
    const validateField = (field, value) => {
        const limits = {
            StoreName: [
                /^.{1,120}$/,
                "Tên gian hàng bắt buộc, tối đa 120 ký tự",
            ],

            Description: [
                /^.{0,500}$/,
                "Mô tả tối đa 500 ký tự",
            ],

            Address: [
                /^.{0,255}$/,
                "Địa chỉ tối đa 255 ký tự",
            ],

            BankName: [
                /^.{0,80}$/,
                "Tên ngân hàng tối đa 80 ký tự",
            ],

            BankAccountNumber: [
                /^.{0,30}$/,
                "Số tài khoản tối đa 30 ký tự",
            ],

            BankAccountHolder: [
                /^.{0,100}$/,
                "Chủ tài khoản tối đa 100 ký tự",
            ],
        };

        if (
            limits[field] &&
            !limits[field][0].test(value)
        ) {
            return limits[field][1];
        }

        if (
            field === "Latitude" &&
            value !== "" &&
            (
                !Number.isFinite(Number(value)) ||
                Number(value) < -90 ||
                Number(value) > 90
            )
        ) {
            return "Vĩ độ phải từ -90 đến 90";
        }

        if (
            field === "Longitude" &&
            value !== "" &&
            (
                !Number.isFinite(Number(value)) ||
                Number(value) < -180 ||
                Number(value) > 180
            )
        ) {
            return "Kinh độ phải từ -180 đến 180";
        }

        return "";
    };

    const setField = (
        field,
        value,
        setter
    ) => {
        setter(value);

        setFieldErrors((current) => ({
            ...current,
            [field]: validateField(
                field,
                value
            ),
        }));
    };

    // =========================
    // Submit
    // =========================
    const handleSubmit = async (e) => {
        e.preventDefault();

        const nextErrors = {
            StoreName: validateField(
                "StoreName",
                storeName.trim()
            ),

            Description: validateField(
                "Description",
                description
            ),

            Address: validateField(
                "Address",
                address
            ),

            Latitude: validateField(
                "Latitude",
                latitude
            ),

            Longitude: validateField(
                "Longitude",
                longitude
            ),

            BankName: validateField(
                "BankName",
                bankName
            ),

            BankAccountNumber: validateField(
                "BankAccountNumber",
                bankAccountNumber
            ),

            BankAccountHolder: validateField(
                "BankAccountHolder",
                bankAccountHolder
            ),
        };

        const errors = Object.fromEntries(
            Object.entries(nextErrors).filter(
                ([, message]) => message
            )
        );

        setFieldErrors(errors);

        if (
            Object.keys(errors).length ||
            !store?.OwnerId
        ) {
            return;
        }

        try {
            setSaving(true);
            setSubmitError("");

            let nextQrImageUrl =
                qrImageUrl || null;

            // Upload QR
            if (qrFile) {
                if (
                    ![
                        "image/png",
                        "image/jpeg",
                    ].includes(qrFile.type) ||
                    qrFile.size >
                        5 * 1024 * 1024
                ) {
                    throw new Error(
                        "Ảnh QR chỉ nhận JPG/PNG và tối đa 5MB"
                    );
                }

                const uploadResponse =
                    await uploadQrImage(qrFile);

                nextQrImageUrl =
                    uploadResponse.data.data.url;
            }

            // Data
            const data = {
                StoreName:
                    storeName.trim(),

                Description:
                    description.trim() || null,

                Address:
                    address.trim() || null,

                Longitude:
                    longitude === ""
                        ? null
                        : Number(longitude),

                Latitude:
                    latitude === ""
                        ? null
                        : Number(latitude),

                IsDemoLocation:
                    isDemoLocation,

                BankName:
                    bankName.trim() || null,

                BankAccountNumber:
                    bankAccountNumber.trim() ||
                    null,

                BankAccountHolder:
                    bankAccountHolder.trim() ||
                    null,

                QrImageUrl:
                    nextQrImageUrl,
            };

            const response =
                await updateStore(
                    store.OwnerId,
                    data
                );

            onSaved?.(
                response.data.data
            );

            onClose();
        } catch (error) {
            console.error(
                "Lỗi cập nhật cửa hàng:",
                error
            );

            setSubmitError(
                error.message ||
                    "Cập nhật cửa hàng thất bại"
            );
        } finally {
            setSaving(false);
        }
    };

    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

                {/* Header */}
                <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
                    <h2 className="text-lg font-bold text-slate-800">
                        Chỉnh sửa thông tin cửa hàng
                    </h2>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Form */}
                <form
                    onSubmit={handleSubmit}
                    className="flex min-h-0 flex-1 flex-col"
                >
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        <div className="space-y-7 p-6">

                            <StoreBasicInfo
                                storeName={storeName}
                                setStoreName={setStoreName}
                                description={description}
                                setDescription={setDescription}
                                setField={setField}
                                fieldErrors={fieldErrors}
                                storeNameRef={storeNameRef}
                            />

                            <StoreLocationForm
                                address={address}
                                setAddress={setAddress}
                                longitude={longitude}
                                setLongitude={setLongitude}
                                latitude={latitude}
                                setLatitude={setLatitude}
                                setField={setField}
                                fieldErrors={fieldErrors}
                                locationError={locationError}
                                setLocationError={
                                    setLocationError
                                }
                                searchingLocation={
                                    searchingLocation
                                }
                                setSearchingLocation={
                                    setSearchingLocation
                                }
                            />

                            <StorePaymentForm
                                bankName={bankName}
                                setBankName={setBankName}
                                bankAccountNumber={
                                    bankAccountNumber
                                }
                                setBankAccountNumber={
                                    setBankAccountNumber
                                }
                                bankAccountHolder={
                                    bankAccountHolder
                                }
                                setBankAccountHolder={
                                    setBankAccountHolder
                                }
                                setField={setField}
                                fieldErrors={
                                    fieldErrors
                                }
                            />

                            <StoreQrUpload
                                qrFile={qrFile}
                                setQrFile={setQrFile}
                                qrImageUrl={
                                    qrImageUrl
                                }
                            />

                        </div>
                    </div>

                    {/* Footer */}
                    <div className="shrink-0 border-t border-slate-100 bg-white px-6 py-4">

                        {submitError && (
                            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
                                {submitError}
                            </div>
                        )}

                        <div className="flex justify-end gap-3">

                            <button
                                type="button"
                                onClick={onClose}
                                disabled={saving}
                                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                                Hủy
                            </button>

                            <button
                                type="submit"
                                disabled={saving}
                                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                                {saving
                                    ? "Đang lưu..."
                                    : "Lưu thông tin"}
                            </button>

                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}