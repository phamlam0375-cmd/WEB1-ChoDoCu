import { useState, useRef } from "react";
import { Camera, Car, Upload, ShieldCheck, Clock, Users } from "lucide-react";
import Header from "../Header";

// Bước 1/3 của luồng đăng ký người bán / tài xế.
// Sinh mã OTP giả lập 6 số, đổi mới mỗi khi bấm "Gửi lại".
function generateOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

export default function RegisterApplication({ onConfirm }) {
    const [role, setRole] = useState("seller"); // "seller" | "driver"
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState(generateOtp());
    const [idImage, setIdImage] = useState(null);
    const fileInputRef = useRef(null);

    const handleResendOtp = () => setOtp(generateOtp());

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) setIdImage(file);
    };

    const handleConfirm = () => {
        onConfirm?.({ role, phone, otp, idImage });
    };

    const roleOptions = [
        { id: "seller", label: "Người bán", icon: Camera },
        { id: "driver", label: "Tài xế", icon: Car },
    ];

    const benefits = [
        { icon: ShieldCheck, text: "Hồ sơ được đội ngũ quản trị duyệt thủ công, đảm bảo an toàn" },
        { icon: Clock, text: "Xét duyệt trong vòng 24 giờ làm việc" },
        { icon: Users, text: "Tham gia cộng đồng người bán và tài xế đang hoạt động" },
    ];

    return (
        <>
            <div className="flex min-h-screen flex-col">
                <Header />
                <div className="flex w-full flex-1 bg-gradient-to-br from-emerald-50 via-white to-white text-slate-900">
                    {/* Cột trái: giới thiệu, chỉ hiện trên màn hình rộng */}
                    <div className="hidden w-1/2 flex-col justify-center gap-8 px-16 lg:flex xl:px-24">
                        <div>
                            <p className="text-sm font-semibold text-emerald-600">Chợ Đồ Cũ</p>
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
                                <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                                        <Icon size={15} className="text-emerald-600" />
                                    </span>
                                    <span className="pt-1">{text}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Cột phải: form đăng ký */}
                    <div className="flex w-full flex-1 items-center justify-center px-6 py-12 lg:w-1/2">
                        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                            <h2 className="mb-6 text-sm font-semibold text-slate-500">
                                Bước 1/3 — Chọn vai trò
                            </h2>

                            {/* Chọn vai trò */}
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
                                            <Icon size={22} className={active ? "text-emerald-600" : "text-slate-400"} />
                                            <span className={`text-sm font-medium ${active ? "text-emerald-700" : "text-slate-600"}`}>
                                                {label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Số điện thoại */}
                            <label className="mb-1 block text-sm font-medium text-slate-700">Số điện thoại</label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="090xxxxxxx"
                                className="mb-5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                            />

                            {/* OTP + Gửi lại */}
                            <label className="mb-1 block text-sm font-medium text-slate-700">Mã OTP</label>
                            <div className="mb-5 flex items-center gap-2">
                                <input
                                    type="text"
                                    value={otp}
                                    readOnly
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-sm tracking-widest text-slate-900"
                                />
                                <button
                                    type="button"
                                    onClick={handleResendOtp}
                                    className="whitespace-nowrap rounded-lg border border-emerald-600 px-4 py-2.5 text-sm font-medium text-emerald-600 hover:bg-emerald-50"
                                >
                                    Gửi lại
                                </button>
                            </div>

                            {/* Upload ảnh giấy tờ */}
                            <label className="mb-1 block text-sm font-medium text-slate-700">
                                Ảnh giấy tờ (CCCD/GPLX)
                            </label>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="mb-6 flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 py-7 text-slate-500 hover:border-emerald-400 hover:bg-emerald-50/50"
                            >
                                <Upload size={20} className="text-emerald-600" />
                                <span className="text-sm">
                                    {idImage ? idImage.name : "Tải ảnh để quản trị duyệt thủ công"}
                                </span>
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="hidden"
                            />

                            {/* Xác nhận */}
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