import {ArrowLeft, Camera, PackagePlus, X} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import Header from "../../components/Header";
import { createListing } from "../../services/listingApi";
import { toast } from "react-toastify";
import { useState } from "react";

const CreateListing = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const storeId = Number(searchParams.get("storeId"));

    const [images, setImages] = useState([]);
    const [formData, setFormData] = useState({
        Title: "",
        Description: "",
        Price: "",
        CategoryId: "",
        ConditionLevel: "GOOD",
        KnownDefects: "",
        Location: "",
    });

    const handleChange = (e) => {
        const { name, value } = e.target;

        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleImageChange = (e) => {
        const files = Array.from(e.target.files || []);
        const remaining = Math.max(0, 5 - images.length);
        const selectedFiles = files.slice(0, remaining);

        const newImages = selectedFiles.map((file) => ({
            file,
            preview: URL.createObjectURL(file),
        }));

        setImages((prev) => [...prev, ...newImages]);

        e.target.value = "";
    };

    const removeImage = (index) => {
        setImages((prev) => {
            URL.revokeObjectURL(prev[index].preview);
            return prev.filter((_, i) => i !== index);
        });
    };

    const handleSubmit = async(e) => {
        e.preventDefault();
        try{
            const user = JSON.parse(window.localStorage.getItem("user") || "null");
            const sellerId = Number(user?.UserId);
            if (!Number.isSafeInteger(sellerId) || sellerId <= 0 || !Number.isSafeInteger(storeId) || storeId <= 0) {
                toast.error("Không xác định được cửa hàng của bạn");
                return;
            }
            await createListing({
                ...formData,
                Price:Number(formData.Price),
                CategoryId:Number(formData.CategoryId),
                SellerId: sellerId,
                StoreId: storeId,
            }, images);
            toast.success("Tạo sản phẩm thành công");
            navigate(-1);
        }
        catch(error){
            toast.error("Lỗi không thể tạo sản phẩm: ",error)
        }

        
    };

    const inputClass =
        "mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10";

    const labelClass =
        "text-sm font-semibold text-slate-700";

    return (
        <>
            <Header />

            <main className="min-h-screen bg-slate-50 px-4 py-8 font-sans text-slate-800 sm:px-6 sm:py-10">
                <div className="mx-auto max-w-5xl">

                    {/* Header trang */}
                    <div className="mb-8">
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-emerald-700"
                        >
                            <ArrowLeft size={18} />
                            Quay lại danh sách
                        </button>

                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                                <PackagePlus size={25} />
                            </div>

                            <div>
                                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                                    Đăng bán sản phẩm
                                </h1>

                                <p className="mt-1 text-sm text-slate-500">
                                    Điền thông tin để đăng sản phẩm đồ cũ của bạn.
                                </p>
                            </div>
                        </div>
                    </div>

                    <form
                        onSubmit={handleSubmit}
                        className="space-y-6"
                    >
                        {/* Thông tin cơ bản */}
                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                            <div className="mb-6 border-b border-slate-100 pb-4">
                                <h2 className="text-lg font-bold text-slate-900">
                                    Thông tin sản phẩm
                                </h2>

                                <p className="mt-1 text-sm text-slate-500">
                                    Cung cấp thông tin rõ ràng để người mua dễ tìm thấy sản phẩm.
                                </p>
                            </div>

                            <div className="space-y-5">
                                <div>
                                    <label
                                        htmlFor="Title"
                                        className={labelClass}
                                    >
                                        Tên sản phẩm
                                        <span className="ml-1 text-red-500">*</span>
                                    </label>

                                    <input
                                        id="Title"
                                        name="Title"
                                        value={formData.Title}
                                        onChange={handleChange}
                                        required
                                        maxLength={180}
                                        placeholder="Ví dụ: Áo khoác nam còn mới"
                                        className={inputClass}
                                    />

                                    <p className="mt-1.5 text-right text-xs text-slate-400">
                                        {formData.Title.length}/180
                                    </p>
                                </div>

                                <div>
                                    <label
                                        htmlFor="Description"
                                        className={labelClass}
                                    >
                                        Mô tả sản phẩm
                                        <span className="ml-1 text-red-500">*</span>
                                    </label>

                                    <textarea
                                        id="Description"
                                        name="Description"
                                        value={formData.Description}
                                        onChange={handleChange}
                                        required
                                        rows={5}
                                        placeholder="Mô tả đặc điểm, nguồn gốc, thời gian sử dụng và thông tin người mua cần biết..."
                                        className={`${inputClass} resize-y`}
                                    />
                                </div>

                                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                    <div>
                                        <label
                                            htmlFor="Price"
                                            className={labelClass}
                                        >
                                            Giá bán (VNĐ)
                                            <span className="ml-1 text-red-500">*</span>
                                        </label>

                                        <div className="relative">
                                            <input
                                                id="Price"
                                                name="Price"
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={formData.Price}
                                                onChange={handleChange}
                                                required
                                                placeholder="Ví dụ: 150000"
                                                className={`${inputClass} pr-14`}
                                            />

                                            <span className="absolute right-4 top-1/2 mt-1 -translate-y-1/2 text-sm font-medium text-slate-400">
                                                VNĐ
                                            </span>
                                        </div>
                                    </div>

                                    <div>
                                        <label
                                            htmlFor="CategoryId"
                                            className={labelClass}
                                        >
                                            Danh mục
                                            <span className="ml-1 text-red-500">*</span>
                                        </label>

                                        <select
                                            id="CategoryId"
                                            name="CategoryId"
                                            value={formData.CategoryId}
                                            onChange={handleChange}
                                            required
                                            className={inputClass}
                                        >
                                            <option value="">
                                                Chọn danh mục
                                            </option>

                                            {/* Thay bằng danh mục lấy từ API */}
                                            <option value="1">Thời trang</option>
                                            <option value="2">Điện tử</option>
                                            <option value="3">Đồ gia dụng</option>
                                            <option value="4">Sách và văn phòng phẩm</option>
                                            <option value="5">Khác</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label
                                        htmlFor="ConditionLevel"
                                        className={labelClass}
                                    >
                                        Tình trạng sản phẩm
                                        <span className="ml-1 text-red-500">*</span>
                                    </label>

                                    <select
                                        id="ConditionLevel"
                                        name="ConditionLevel"
                                        value={formData.ConditionLevel}
                                        onChange={handleChange}
                                        required
                                        className={inputClass}
                                    >
                                        <option value="LIKE_NEW">
                                            Như mới
                                        </option>
                                        <option value="GOOD">
                                            Tốt
                                        </option>
                                        <option value="FAIR">
                                            Khá
                                        </option>
                                        <option value="POOR">
                                            Kém
                                        </option>
                                    </select>
                                </div>

                                <div>
                                    <label
                                        htmlFor="KnownDefects"
                                        className={labelClass}
                                    >
                                        Lỗi hoặc khuyết điểm
                                    </label>

                                    <textarea
                                        id="KnownDefects"
                                        name="KnownDefects"
                                        value={formData.KnownDefects}
                                        onChange={handleChange}
                                        rows={3}
                                        placeholder="Ví dụ: Có vết xước nhỏ ở góc..."
                                        className={`${inputClass} resize-y`}
                                    />

                                    <p className="mt-1.5 text-xs text-slate-400">
                                        Nếu sản phẩm không có lỗi, bạn có thể để trống.
                                    </p>
                                </div>

                                <div>
                                    <label
                                        htmlFor="Location"
                                        className={labelClass}
                                    >
                                        Địa điểm giao dịch
                                    </label>

                                    <input
                                        id="Location"
                                        name="Location"
                                        value={formData.Location}
                                        onChange={handleChange}
                                        placeholder="Ví dụ: Quận Ninh Kiều, Cần Thơ"
                                        className={inputClass}
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Hình ảnh */}
                        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                            <div className="mb-6 border-b border-slate-100 pb-4">
                                <h2 className="text-lg font-bold text-slate-900">
                                    Hình ảnh sản phẩm
                                </h2>

                                <p className="mt-1 text-sm text-slate-500">
                                    Tải tối đa 5 ảnh để người mua xem sản phẩm.
                                </p>
                            </div>

                            <label
                                htmlFor="listing-images"
                                className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center transition hover:border-emerald-400 hover:bg-emerald-50/50"
                            >
                                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                                    <Camera size={28} />
                                </div>

                                <span className="text-sm font-semibold text-slate-800">
                                    Nhấn để chọn hình ảnh
                                </span>

                                <span className="mt-1 text-xs text-slate-500">
                                    PNG, JPG hoặc WEBP
                                </span>

                                <input
                                    id="listing-images"
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    multiple
                                    onChange={handleImageChange}
                                    disabled={images.length >= 5}
                                    className="hidden"
                                />
                            </label>

                            {images.length > 0 && (
                                <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
                                    {images.map((image, index) => (
                                        <div
                                            key={image.preview}
                                            className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                                        >
                                            <img
                                                src={image.preview}
                                                alt={`Ảnh sản phẩm ${index + 1}`}
                                                className="h-full w-full object-cover"
                                            />

                                            <button
                                                type="button"
                                                onClick={() => removeImage(index)}
                                                aria-label={`Xóa ảnh ${index + 1}`}
                                                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow transition hover:bg-red-500 hover:text-white"
                                            >
                                                <X size={16} />
                                            </button>

                                            {index === 0 && (
                                                <span className="absolute bottom-0 left-0 right-0 bg-emerald-600/90 py-1.5 text-center text-xs font-semibold text-white">
                                                    Ảnh đại diện
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <p className="mt-3 text-xs text-slate-400">
                                Đã chọn {images.length}/5 ảnh.
                            </p>
                        </section>

                        {/* Nút thao tác */}
                        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={() => navigate(-1)}
                                className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                            >
                                Hủy
                            </button>

                            <button
                                type="submit"
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-emerald-200 transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
                            >
                                <PackagePlus size={18} />
                                Đăng sản phẩm
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </>
    );
};

export default CreateListing;
