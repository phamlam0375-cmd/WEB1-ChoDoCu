import { Camera, Car, Clock, ShieldCheck, Upload, Users } from "lucide-react";
import { postPartnerApplication, sendPartnerOtp, verifyPartnerOtp, } from "../../api/partnerApplicationApi";
import { useRef, useState } from "react";

import Header from "../Header";
import { toast } from "react-toastify";

export default function RegisterApplication() {
    const [role, setRole] = useState("seller");
    const [identityNumberMasked, setIdentityNumberMasked] = useState("");
    const [image, setImage] = useState(null);

    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [sendingOtp, setSendingOtp] = useState(false);

    const [errors, setErrors] = useState({});

    const fileInputRef = useRef(null);

    const handleResendOtp = async () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!email) {
            setErrors((prev) => ({
                ...prev,
                email: "Chưa nhập email",
            }));
            return;
        }

        if (!emailRegex.test(email)) {
            setErrors((prev) => ({
                ...prev,
                email: "Email không hợp lệ",
            }));
            return;
        }

        setErrors((prev) => ({
            ...prev,
            email: "",
        }));

        try {
            setSendingOtp(true);

            await sendPartnerOtp(email);

            toast.success("Đã gửi OTP");
        } catch (error) {
            console.error("Gửi OTP thất bại:", error);

            toast.error(
                error.response?.data?.message ||
                "Gửi OTP thất bại"
            );
        } finally {
            setSendingOtp(false);
        }
    };

    const handleEmailChange = (e) => {
        const value = e.target.value;

        setEmail(value);
        setErrors((prev) => ({
            ...prev,
            email: "",
        }));
    };
    const handleOtpChange = (e) => {
        const value = e.target.value;
        if (/^\d*$/.test(value)) {
            setOtp(value);
            setErrors((prev) => ({
                ...prev,
                otp: "",
            }));
        }
    };
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];

        if (file) {
            setImage(file);
        }
    };
    const handleIdentityNumberChange = (e) => {
        const value = e.target.value;
        if (/^\d*$/.test(value)) {
            setIdentityNumberMasked(value);
            setErrors((prev) => ({
                ...prev,
                cccd: "",
            }));
        }
    };

    const handleConfirm = async () => {
        const newErrors = {};

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const cccdRegex = /^\d{12}$/;
        const otpRegex = /^\d{6}$/;

        if (!email) {
            newErrors.email = "Chưa nhập email";
        } else if (!emailRegex.test(email)) {
            newErrors.email = "Email không hợp lệ";
        }

        if (!identityNumberMasked) {
            newErrors.cccd = "Chưa nhập số CCCD";
        } else if (!cccdRegex.test(identityNumberMasked)) {
            newErrors.cccd = "CCCD phải có đúng 12 số";
        }

        if (!otp) {
            newErrors.otp = "Chưa nhập OTP";
        } else if (!otpRegex.test(otp)) {
            newErrors.otp = "OTP phải đủ 6 số";
        }

        setErrors(newErrors);

        if (Object.keys(newErrors).length > 0) {
            return;
        }

        try {
            await verifyPartnerOtp(email, otp);
            const formData = new FormData();

            formData.append("UserId", "8");
            formData.append(
                "PartnerType",
                role.toUpperCase()
            );
            formData.append(
                "IdentityNumberMasked",
                identityNumberMasked
            );

            if (image) {
                formData.append(
                    "IdentityImageUrl",
                    image
                );
            }
            await postPartnerApplication(formData);

            toast.success("Đăng ký thành công");
        } catch (error) {
            console.error(
                "Đăng ký partner thất bại:",
                error
            );

            toast.error(
                error.response?.data?.message ||
                "Đăng ký thất bại"
            );
        }
    };

    const roleOptions = [
        {
            id: "seller",
            label: "Người bán",
            icon: Camera,
        },
        {
            id: "driver",
            label: "Tài xế",
            icon: Car,
        },
    ];

    const benefits = [
        {
            icon: ShieldCheck,
            text: "Hồ sơ được đội ngũ quản trị duyệt thủ công, đảm bảo an toàn",
        },
        {
            icon: Clock,
            text: "Xét duyệt trong vòng 24 giờ làm việc",
        },
        {
            icon: Users,
            text: "Tham gia cộng đồng người bán và tài xế đang hoạt động",
        },
    ];

    return (
        <>
            <div className="flex min-h-screen flex-col">
                <Header />

                <div className="flex w-full flex-1 bg-linear-to-br from-emerald-50 via-white to-white text-slate-900">

                    {/* LEFT */}
                    <div className="hidden w-1/2 flex-col justify-center gap-8 px-16 lg:flex xl:px-24">
                        <div>
                            <p className="text-sm font-semibold text-emerald-600">
                                Chợ Đồ Cũ
                            </p>

                            <h1 className="mt-2 text-3xl font-bold leading-snug text-slate-900 xl:text-4xl">
                                Đăng ký trở thành
                                <br />
                                đối tác của chúng tôi
                            </h1>

                            <p className="mt-4 max-w-md text-slate-500">
                                Chỉ mất vài phút để hoàn tất hồ sơ.
                                Chọn vai trò phù hợp và bắt đầu
                                hành trình của bạn ngay hôm nay.
                            </p>
                        </div>

                        <ul className="flex flex-col gap-4">
                            {benefits.map(
                                ({ icon: Icon, text }, i) => (
                                    <li
                                        key={i}
                                        className="flex items-start gap-3 text-sm text-slate-600"
                                    >
                                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                                            <Icon
                                                size={15}
                                                className="text-emerald-600"
                                            />
                                        </span>

                                        <span className="pt-1">
                                            {text}
                                        </span>
                                    </li>
                                )
                            )}
                        </ul>
                    </div>

                    {/* RIGHT */}
                    <div className="flex w-full flex-1 items-center justify-center px-6 py-12 lg:w-1/2">
                        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">

                            {/* ROLE */}
                            <div className="mb-6 grid grid-cols-2 gap-3">
                                {roleOptions.map(
                                    ({
                                        id,
                                        label,
                                        icon: Icon,
                                    }) => {
                                        const active =
                                            role === id;

                                        return (
                                            <button
                                                key={id}
                                                type="button"
                                                onClick={() =>
                                                    setRole(id)
                                                }
                                                className={`flex flex-col items-center justify-center gap-2 rounded-xl border py-5 transition-colors ${active
                                                    ? "border-emerald-600 bg-emerald-50"
                                                    : "border-slate-200 bg-white hover:border-emerald-300"
                                                    }`}
                                            >
                                                <Icon
                                                    size={22}
                                                    className={
                                                        active
                                                            ? "text-emerald-600"
                                                            : "text-slate-400"
                                                    }
                                                />

                                                <span
                                                    className={`text-sm font-medium ${active
                                                        ? "text-emerald-700"
                                                        : "text-slate-600"
                                                        }`}
                                                >
                                                    {label}
                                                </span>
                                            </button>
                                        );
                                    }
                                )}
                            </div>

                            {/* ========================= */}
                            {/* CCCD */}
                            {/* ========================= */}
                            <label className="mb-1 block text-sm font-medium text-slate-700">
                                Số CCCD
                            </label>

                            <input
                                type="text"
                                value={identityNumberMasked}
                                onChange={
                                    handleIdentityNumberChange
                                }
                                placeholder="Nhập số CCCD"
                                maxLength={12}
                                inputMode="numeric"
                                className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ${errors.cccd
                                    ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                    : "border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                    }`}
                            />

                            {errors.cccd && (
                                <p className="mt-1 text-sm text-red-500">
                                    {errors.cccd}
                                </p>
                            )}

                            {/* EMAIL */}
                            <label className="mb-1 mt-5 block text-sm font-medium text-slate-700">
                                Email nhận OTP
                            </label>

                            <input
                                type="email"
                                value={email}
                                onChange={handleEmailChange}
                                placeholder="Nhập email của bạn"
                                className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ${errors.email
                                    ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                    : "border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                    }`}
                            />

                            {errors.email && (
                                <p className="mt-1 text-sm text-red-500">
                                    {errors.email}
                                </p>
                            )}

                            {/* OTP */}
                            <label className="mb-1 mt-5 block text-sm font-medium text-slate-700">
                                Mã OTP
                            </label>

                            <div className="flex items-start gap-2">
                                <div className="w-full">
                                    <input
                                        type="text"
                                        value={otp}
                                        onChange={
                                            handleOtpChange
                                        }
                                        placeholder="Nhập mã OTP"
                                        maxLength={6}
                                        inputMode="numeric"
                                        className={`w-full rounded-lg border bg-white px-3 py-2.5 text-center tracking-widest outline-none ${errors.otp
                                            ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                            : "border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                            }`}
                                    />

                                    {errors.otp && (
                                        <p className="mt-1 text-sm text-red-500">
                                            {errors.otp}
                                        </p>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={
                                        handleResendOtp
                                    }
                                    disabled={sendingOtp}
                                    className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {sendingOtp
                                        ? "Đang gửi..."
                                        : "Gửi OTP"}
                                </button>
                            </div>

                            {/* IMAGE */}
                            <label className="mb-1 mt-5 block text-sm font-medium text-slate-700">
                                Ảnh giấy tờ (CCCD/GPLX)
                            </label>

                            <button
                                type="button"
                                onClick={() =>
                                    fileInputRef.current?.click()
                                }
                                className="mb-6 flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 py-7 text-slate-500 hover:border-emerald-400 hover:bg-emerald-50/50"
                            >
                                <Upload
                                    size={20}
                                    className="text-emerald-600"
                                />

                                <span className="text-sm">
                                    {image
                                        ? image.name
                                        : "Tải ảnh để quản trị duyệt thủ công"}
                                </span>
                            </button>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="hidden"
                            />

                            {/* CONFIRM */}
                            <button
                                type="button"
                                onClick={handleConfirm}
                                className="w-full rounded-full bg-emerald-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                            >
                                Xác nhận
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
