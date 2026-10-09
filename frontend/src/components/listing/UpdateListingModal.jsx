import { useEffect, useState } from "react";

export default function UpdateListingModal({ listing, onClose, onSubmit, loading = false }) {
    const [formData, setFormData] = useState(
        { Title: "", Description: "", Price: "", ConditionLevel: "GOOD", KnownDefects: "", Location: "" }
    );

    useEffect(() => {
        if (listing)
            setFormData(
                {
                    Title: listing.Title ?? "",
                    Description: listing.Description ?? "",
                    Price: listing.Price ?? "",
                    ConditionLevel: listing.ConditionLevel ?? "GOOD",
                    KnownDefects: listing.KnownDefects ?? "",
                    Location: listing.Location ?? ""
                });
    }, [listing]);

    if (!listing) return null;

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({ ListingId: listing.ListingId, ...formData, Price: Number(formData.Price) });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && !loading && onClose()}>
            <div role="dialog" aria-modal="true" aria-labelledby="update-listing-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
                <div className="flex items-center justify-between border-b p-5">
                    <h2 id="update-listing-title" className="text-xl font-bold">Chỉnh sửa sản phẩm</h2>
                    <button type="button" onClick={onClose} disabled={loading} aria-label="Đóng modal" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 p-6">
                    <div>
                        <label htmlFor="Title" className="mb-1 block text-sm font-medium">Tên sản phẩm *</label>
                        <input id="Title" name="Title" value={formData.Title} onChange={handleChange} required maxLength={255} className="w-full rounded-lg border border-slate-300 p-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                    </div>

                    <div>
                        <label htmlFor="Description" className="mb-1 block text-sm font-medium">Mô tả *</label>
                        <textarea id="Description" name="Description" value={formData.Description} onChange={handleChange} required rows={3} className="w-full rounded-lg border border-slate-300 p-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label htmlFor="Price" className="mb-1 block text-sm font-medium">Giá bán (VNĐ) *</label>
                            <input id="Price" name="Price" type="number" min="0" step="1" value={formData.Price} onChange={handleChange} required className="w-full rounded-lg border border-slate-300 p-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                        </div>

                        <div>
                            <label htmlFor="ConditionLevel" className="mb-1 block text-sm font-medium">Tình trạng *</label>
                            <select id="ConditionLevel" name="ConditionLevel" value={formData.ConditionLevel} onChange={handleChange} required className="w-full rounded-lg border border-slate-300 bg-white p-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">
                                <option value="NEW">Mới</option>
                                <option value="LIKE_NEW">Như mới</option>
                                <option value="GOOD">Tốt</option>
                                <option value="FAIR">Khá</option>
                                <option value="POOR">Kém</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="Location" className="mb-1 block text-sm font-medium">Địa điểm</label>
                        <input id="Location" name="Location" value={formData.Location} onChange={handleChange} className="w-full rounded-lg border border-slate-300 p-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                    </div>

                    <div>
                        <label htmlFor="KnownDefects" className="mb-1 block text-sm font-medium">Lỗi sản phẩm (nếu có)</label>
                        <textarea id="KnownDefects" name="KnownDefects" value={formData.KnownDefects} onChange={handleChange} rows={2} placeholder="Ví dụ: Có vài vết trầy xước nhỏ..." className="w-full rounded-lg border border-slate-300 p-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                    </div>

                    <div className="flex justify-end gap-3 border-t pt-4">
                        <button type="button" onClick={onClose} disabled={loading} className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Hủy</button>
                        <button type="submit" disabled={loading} className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Đang cập nhật..." : "Cập nhật"}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
