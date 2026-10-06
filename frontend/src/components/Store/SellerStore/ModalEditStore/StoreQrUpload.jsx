import { Upload } from "lucide-react";

export default function StoreQrUpload({
    qrFile,
    setQrFile,
    qrImageUrl,
}) {
    return (
        <section>
            <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-800">
                    Mã QR thanh toán
                </h3>
            </div>

            <label
                htmlFor="qr-upload"
                className="group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 transition hover:border-emerald-400 hover:bg-emerald-50/50"
            >
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                    <Upload className="h-6 w-6 text-slate-500 group-hover:text-emerald-500" />
                </div>

                <p className="max-w-full truncate px-4 text-sm font-medium text-slate-700">
                    {qrFile
                        ? qrFile.name
                        : "Chọn ảnh QR"}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                    PNG hoặc JPG · tối đa 5MB
                </p>

                <span className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 group-hover:bg-emerald-600 group-hover:text-white">
                    Chọn ảnh
                </span>

                <input
                    id="qr-upload"
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(e) =>
                        setQrFile(
                            e.target.files?.[0] ||
                            null
                        )
                    }
                    className="hidden"
                />
            </label>
        </section>
    );
}