import { Store as StoreIcon } from "lucide-react";

export default function StoreLoadingSkeleton() {
    return (
        <div className="animate-pulse">
            {/* PAGE HEADER */}
            <div className="mb-8">
                <div className="mb-3 h-4 w-32 rounded bg-slate-200" />

                <div className="h-9 w-72 rounded-lg bg-slate-200" />

                <div className="mt-3 h-4 w-96 max-w-full rounded bg-slate-200" />
            </div>

            {/* CONTENT */}
            <div className="grid gap-6 lg:grid-cols-3">

                {/* LEFT */}
                <div className="lg:col-span-2">

                    {/* STORE CARD */}
                    <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">

                        <div className="border-b border-slate-100 p-6">
                            <div className="flex items-start gap-4">

                                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-200">
                                    <StoreIcon className="h-8 w-8 text-slate-300" />
                                </div>

                                <div className="flex-1">
                                    <div className="h-6 w-52 rounded bg-slate-200" />

                                    <div className="mt-3 h-4 w-32 rounded bg-slate-200" />
                                </div>

                            </div>
                        </div>

                        <div className="grid gap-5 p-6 md:grid-cols-2">

                            <div className="rounded-xl bg-slate-100 p-5">
                                <div className="h-5 w-20 rounded bg-slate-200" />
                                <div className="mt-4 h-4 w-full rounded bg-slate-200" />
                                <div className="mt-2 h-4 w-3/4 rounded bg-slate-200" />
                            </div>

                            <div className="rounded-xl bg-slate-100 p-5">
                                <div className="h-5 w-32 rounded bg-slate-200" />
                                <div className="mt-4 h-4 w-40 rounded bg-slate-200" />
                            </div>

                            <div className="rounded-xl bg-slate-100 p-5 md:col-span-2">
                                <div className="h-5 w-40 rounded bg-slate-200" />

                                <div className="mt-4 h-4 w-full rounded bg-slate-200" />
                                <div className="mt-2 h-4 w-5/6 rounded bg-slate-200" />
                                <div className="mt-2 h-4 w-2/3 rounded bg-slate-200" />
                            </div>

                        </div>
                    </div>

                    {/* MAP */}
                    <div className="mt-6 overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">

                        <div className="border-b border-slate-100 p-6">
                            <div className="flex items-center gap-3">

                                <div className="h-10 w-10 rounded-xl bg-slate-200" />

                                <div>
                                    <div className="h-5 w-40 rounded bg-slate-200" />
                                    <div className="mt-2 h-4 w-52 rounded bg-slate-200" />
                                </div>

                            </div>
                        </div>

                        <div className="h-[450px] bg-slate-200" />

                    </div>

                </div>

                {/* RIGHT */}
                <div className="space-y-6">

                    {/* SUMMARY */}
                    <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">

                        <div className="mb-5 flex items-center gap-3">

                            <div className="h-10 w-10 rounded-xl bg-slate-200" />

                            <div className="h-5 w-24 rounded bg-slate-200" />

                        </div>

                        <div className="space-y-4">
                            <div className="h-16 rounded-xl bg-slate-100" />
                            <div className="h-16 rounded-xl bg-slate-100" />
                        </div>

                    </div>

                    {/* MANAGEMENT */}
                    <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">

                        <div className="mb-5 h-5 w-40 rounded bg-slate-200" />

                        <div className="space-y-3">
                            <div className="h-12 rounded-xl bg-slate-100" />
                            <div className="h-12 rounded-xl bg-slate-100" />
                        </div>

                    </div>

                </div>

            </div>

            {/* PRODUCTS */}
            <div className="mt-10">

                <div className="mb-5">
                    <div className="h-7 w-64 rounded bg-slate-200" />
                    <div className="mt-2 h-4 w-80 rounded bg-slate-200" />
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

                    {[1, 2, 3, 4].map((item) => (
                        <div
                            key={item}
                            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                        >
                            <div className="h-52 bg-slate-200" />

                            <div className="p-4">
                                <div className="h-5 w-3/4 rounded bg-slate-200" />
                                <div className="mt-3 h-5 w-1/2 rounded bg-slate-200" />
                                <div className="mt-3 h-4 w-full rounded bg-slate-200" />
                                <div className="mt-2 h-4 w-5/6 rounded bg-slate-200" />
                            </div>
                        </div>
                    ))}

                </div>

            </div>

        </div>
    );
}