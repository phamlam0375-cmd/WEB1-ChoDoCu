export default function StorePaymentForm({
    bankName,
    setBankName,
    bankAccountNumber,
    setBankAccountNumber,
    bankAccountHolder,
    setBankAccountHolder,
    setField,
    fieldErrors,
}) {
    const inputClass =
        "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

    const labelClass =
        "mb-2 block text-sm font-medium text-slate-700";

    return (
        <section>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                <div>
                    <label className={labelClass}>
                        Tên ngân hàng
                    </label>

                    <input
                        type="text"
                        value={bankName}
                        maxLength={80}
                        onChange={(e) =>
                            setField(
                                "BankName",
                                e.target.value,
                                setBankName
                            )
                        }
                        placeholder="Ví dụ: Vietcombank"
                        className={inputClass}
                    />

                    {fieldErrors.BankName && (
                        <p className="mt-1.5 text-xs text-red-500">
                            {fieldErrors.BankName}
                        </p>
                    )}
                </div>

                <div>
                    <label className={labelClass}>
                        Số tài khoản
                    </label>

                    <input
                        type="text"
                        value={bankAccountNumber}
                        maxLength={30}
                        onChange={(e) =>
                            setField(
                                "BankAccountNumber",
                                e.target.value,
                                setBankAccountNumber
                            )
                        }
                        placeholder="Nhập số tài khoản"
                        className={inputClass}
                    />

                    {fieldErrors.BankAccountNumber && (
                        <p className="mt-1.5 text-xs text-red-500">
                            {fieldErrors.BankAccountNumber}
                        </p>
                    )}
                </div>

                <div className="sm:col-span-2">
                    <label className={labelClass}>
                        Chủ tài khoản
                    </label>

                    <input
                        type="text"
                        value={bankAccountHolder}
                        maxLength={100}
                        onChange={(e) =>
                            setField(
                                "BankAccountHolder",
                                e.target.value,
                                setBankAccountHolder
                            )
                        }
                        placeholder="Nhập tên chủ tài khoản"
                        className={inputClass}
                    />

                    {fieldErrors.BankAccountHolder && (
                        <p className="mt-1.5 text-xs text-red-500">
                            {fieldErrors.BankAccountHolder}
                        </p>
                    )}
                </div>

            </div>
        </section>
    );
}