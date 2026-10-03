import { useState, useRef } from "react";
import { toast } from "react-toastify";
import { Camera, Car, Upload, ShieldCheck, Clock, Users } from "lucide-react";
import Header from "../Header";
import { postPartnerApplication, sendPartnerOtp, verifyPartnerOtp } from "../../api/partnerApplicationApi";

export default function RegisterApplication({ onConfirm }) {
    const [role, setRole] = useState("seller");
    const [identityNumberMasked, setIdentityNumberMasked] = useState("");
    const [image, setImage] = useState(null);

    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [sendingOtp, setSendingOtp] = useState(false);

    const fileInputRef = useRef(null);

    const handleResendOtp = async () => {
        if (!email) {
            toast("nhap email");
            return;
        }
        try {
            setSendingOtp(true);
            await sendPartnerOtp(email)
            toast.success("da gui otp");
        } catch (error) {
            console.error("Gửi OTP thất bại:", error);
            toast.error(error.response?.data?.message || "Gửi OTP thất bại");
        } finally {
            setSendingOtp(false);
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
        }
    };

    const handleConfirm = async () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email) {
            toast.error("chua nhap email");
        }
        if (!emailRegex.test(email)) {
            toast.error("Email không hợp lệ");
        }
        const cccdRegex = /^\d{12}$/;
        if (!cccdRegex.test(identityNumberMasked)) {
            toast.error("Cccd không hợp lệ")
        }
        const otpRegex = /^\d{6}$/;
        if (!otpRegex.test(otp)) {
            toast.error("Otp phải đủ 6 số")
        }

        try {
            await verifyPartnerOtp(email, otp);
            const formData = new FormData();
            formData.append("UserId", "7");
            formData.append("PartnerType", role.toUpperCase());
            formData.append("IdentityNumberMasked", identityNumberMasked);
            if (image) {
                formData.append("IdentityImageUrl", image)
            }
            const res = await postPartnerApplication(formData);
        }
        catch (er) {
            console.error("Loi dang ky", er)
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
                                Chỉ mất vài phút để hoàn tất hồ sơ. Chọn vai trò phù hợp và bắt đầu
                                hành trình của bạn ngay hôm nay.
                            </p>
                        </div>

                        <ul className="flex flex-col gap-4">
                            {benefits.map(({ icon: Icon, text }, i) => (
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
                            ))}
                        </ul>
                    </div>

                    {/* RIGHT */}
                    <div className="flex w-full flex-1 items-center justify-center px-6 py-12 lg:w-1/2">
                        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">

                            {/* ROLE */}
                            <div className="mb-6 grid grid-cols-2 gap-3">
                                {roleOptions.map(({ id, label, icon: Icon }) => {
                                    const active = role === id;

                                    return (
                                        <button
                                            key={id}
                                            type="button"
                                            onClick={() => setRole(id)}
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
                                })}
                            </div>

                            {/* CCCD */}
                            <label className="mb-1 block text-sm font-medium text-slate-700">
                                Số CCCD
                            </label>
                            <input
                                type="text"
                                value={identityNumberMasked}
                                onChange={handleIdentityNumberChange}
                                placeholder="Nhập số CCCD"
                                maxLength={12}
                                inputMode="numeric"
                                className="mb-5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                            />
                            <label className="mb-1 block text-sm font-medium text-slate-700">
                                Email nhận OTP
                            </label>

                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Nhập email của bạn"
                                className="mb-5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                            />
                            {/* OTP */}
                            <label className="mb-1 block text-sm font-medium text-slate-700">
                                Mã OTP
                            </label>

                            <div className="mb-5 flex items-center gap-2">
                                <input
                                    type="text"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    placeholder="Nhập mã OTP"
                                    maxLength={6}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-center tracking-widest"
                                />

                                <button type="button" onClick={handleResendOtp} disabled={sendingOtp}>
                                    {sendingOtp ? "Đang gửi..." : "Gửi OTP"}
                                </button>
                            </div>

                            {/* IMAGE */}
                            <label className="mb-1 block text-sm font-medium text-slate-700">
                                Ảnh giấy tờ (CCCD/GPLX)
                            </label>

                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
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