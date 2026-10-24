export default function StoreBasicInfo({
    storeName,
    setStoreName,
    description,
    setDescription,
    setField,
    fieldErrors,
    storeNameRef,
}) {
    const inputClass =
        "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

    const labelClass =
        "mb-2 block text-sm font-medium text-slate-700";

    return (
        <section>
            <div className="space-y-4">

                <div>
                    <label className={labelClass}>
                        Tên gian hàng
                    </label>

                    <input
                        ref={storeNameRef}
                        type="text"
                        value={storeName}
                        onChange={(e) =>
                            setField(
                                "StoreName",
                                e.target.value,
                                setStoreName
                            )
                        }
                        maxLength={120}
                        placeholder="Nhập tên gian hàng"
                        className={inputClass}
                    />

                    {fieldErrors.StoreName && (
                        <p className="mt-1.5 text-xs text-red-500">
                            {fieldErrors.StoreName}
                        </p>
                    )}
                </div>

                <div>
                    <label className={labelClass}>
                        Mô tả
                    </label>

                    <textarea
                        value={description}
                        onChange={(e) =>
                            setField(
                                "Description",
                                e.target.value,
                                setDescription
                            )
                        }
                        rows={4}
                        maxLength={500}
                        placeholder="Nhập mô tả cửa hàng"
                        className={`${inputClass} resize-none`}
                    />

                    {fieldErrors.Description && (
                        <p className="mt-1.5 text-xs text-red-500">
                            {fieldErrors.Description}
                        </p>
                    )}

                    <div className="mt-1 text-right text-xs text-slate-400">
                        {description.length}/500
                    </div>
                </div>

            </div>
        </section>
    );
}