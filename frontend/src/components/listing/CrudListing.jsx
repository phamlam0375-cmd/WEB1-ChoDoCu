import { useEffect, useState } from "react";

import Header from "../Header";
import { getStoreListing } from "../../api/listingApi";

export default function CrudListing() {
    const [listing, setListing] = useState([]);

    useEffect(() => {
        const fetchSellerListing = async () => {
            try {
                const data = await getStoreListing(6);
                console.log(data.data)
                setListing(data.data);
            } catch (error) {
                console.log("error ====> ", error);
            }
        };

        fetchSellerListing();
    }, []);

    return (
        <>
            <Header />

            <main className="min-h-screen bg-slate-50/50 px-6 py-10 font-sans text-slate-800">
                <div className="mx-auto max-w-7xl">
                    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                                Sản phẩm của tôi
                            </h1>
                        </div>

                        <button
                            className="
                                inline-flex items-center justify-center gap-2
                                rounded-xl bg-emerald-600 px-5 py-2.5
                                text-sm font-semibold text-white
                                shadow-sm shadow-emerald-200
                                transition duration-150 ease-in-out
                                hover:bg-emerald-700 hover:shadow-md hover:shadow-emerald-200
                                active:scale-[0.98]
                                focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2
                            ">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            Thêm sản phẩm
                        </button>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                        <div
                            className="grid grid-cols-[2.8fr_1.2fr_1fr_1.2fr_1fr]  items-center gap-4 border-b border-emerald-100/60 bg-emerald-50/60 px-6 py-3.5  text-xs font-bold uppercase tracking-wider text-emerald-800 " >
                            <span>Sản phẩm</span>
                            <span>Giá</span>
                            <span>Tình trạng</span>
                            <span>Trạng thái</span>
                            <span className="text-right">Thao tác</span>
                        </div>

                        <div className="divide-y divide-slate-100">
                            {listing.map((item) => (
                                <div key={item.ListingId} className=" grid grid-cols-[2.8fr_1.2fr_1fr_1.2fr_1fr] items-center gap-4 px-6 py-4.5 transition-colors duration-150 hover:bg-emerald-50/20">
                                    <div className="min-w-0 pr-2">
                                        <h3 className="truncate font-semibold text-slate-900">
                                            {item.Title}
                                        </h3>

                                        <p className="mt-0.5 truncate text-sm text-slate-500">
                                            {item.Description}
                                        </p>

                                        <p className="mt-1 text-xs text-slate-400">
                                            Lỗi:{" "}
                                            <span className="text-slate-500">
                                                {item.KnownDefects || "Không có"}
                                            </span>
                                        </p>
                                    </div>

                                    <div>
                                        <p className="font-bold text-emerald-700">
                                            {item.Price}
                                        </p>

                                        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                                            Giá bán
                                        </p>
                                    </div>

                                    <div>
                                        <span className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset">
                                            {item.ConditionLevel}
                                        </span>
                                    </div>

                                    <div>
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                                            {item.Status}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-end gap-2">
                                        <button className=" rounded-lg border border-slate-200 bg-white px-3 py-1.5  text-xs font-semibold text-slate-700 shadow-2xs  transition  hover:border-emerald-300   hover:bg-emerald-50  hover:text-emerald-700   " >
                                            Sửa
                                        </button>

                                        <button className=" rounded-lg border border-transparent bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 hover:text-rose-700 ">
                                            Xóa
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/30 px-6 py-4">
                            <p className="text-sm text-slate-500">
                                Hiển thị{" "}
                                <span className="font-semibold text-slate-900">
                                    {listing.length}
                                </span>{" "}
                                sản phẩm
                            </p>

                            <div className="flex items-center gap-1.5">
                                <button disabled className=" cursor-not-allowed rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-400 opacity-60 shadow-2xs " >
                                    Trước
                                </button>

                                <button className=" rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs">
                                    1
                                </button>

                                <button className=" rounded-lg border border-slate-200 bg-white  px-3 py-1.5  text-xs font-medium text-slate-600  shadow-2xs transition  hover:border-emerald-200  hover:bg-emerald-50 hover:text-emerald-700 " >
                                    Sau
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
}