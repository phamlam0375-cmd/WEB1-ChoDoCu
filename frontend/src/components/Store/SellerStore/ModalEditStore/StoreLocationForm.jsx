import StoreLocationMap from "../StoreLocationMap";
import { Search } from "lucide-react";

export default function StoreLocationForm({
    address,
    setAddress,
    longitude,
    setLongitude,
    latitude,
    setLatitude,
    setField,
    fieldErrors,
    locationError,
    setLocationError,
    searchingLocation,
    setSearchingLocation,
}) {
    const inputClass =
        "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

    const handleFindLocation = async () => {
        if (!address.trim()) {
            setLocationError("Vui lòng nhập địa chỉ.");
            return;
        }

        try {
            setSearchingLocation(true);
            setLocationError("");
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=vn&q=${encodeURIComponent(address)}`
            );
            if (!response.ok) throw new Error("Không thể tìm địa chỉ.");
            const data = await response.json();
            if (!data.length) {
                setLocationError("Không tìm thấy vị trí với địa chỉ này.");
                return;
            }
            setField("Latitude", Number(data[0].lat).toFixed(6), setLatitude);
            setField("Longitude", Number(data[0].lon).toFixed(6), setLongitude);
        } catch (error) {
            console.error("Lỗi tìm vị trí:", error);
            setLocationError("Không thể tìm vị trí. Vui lòng thử lại.");
        } finally {
            setSearchingLocation(false);
        }
    };

    return (
        <section className="space-y-4">
            <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Địa chỉ</label>
                <div className="flex gap-2">
                    <input
                        value={address}
                        maxLength={255}
                        onChange={(event) => {
                            setField("Address", event.target.value, setAddress);
                            setLocationError("");
                        }}
                        className={`${inputClass} min-w-0 flex-1`}
                        placeholder="Nhập địa chỉ cửa hàng"
                    />
                    <button
                        type="button"
                        onClick={handleFindLocation}
                        disabled={searchingLocation}
                        className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                    >
                        <Search className="h-4 w-4" />
                        {searchingLocation ? "Đang tìm..." : "Tìm vị trí"}
                    </button>
                </div>
                {fieldErrors.Address && <p className="mt-1 text-sm text-red-500">{fieldErrors.Address}</p>}
                {locationError && <p className="mt-1 text-sm text-red-500">{locationError}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Kinh độ</label>
                    <input type="number" step="any" min="-180" max="180" value={longitude}
                        onChange={(event) => setField("Longitude", event.target.value, setLongitude)}
                        className={inputClass} />
                    {fieldErrors.Longitude && <p className="mt-1 text-sm text-red-500">{fieldErrors.Longitude}</p>}
                </div>
                <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Vĩ độ</label>
                    <input type="number" step="any" min="-90" max="90" value={latitude}
                        onChange={(event) => setField("Latitude", event.target.value, setLatitude)}
                        className={inputClass} />
                    {fieldErrors.Latitude && <p className="mt-1 text-sm text-red-500">{fieldErrors.Latitude}</p>}
                </div>
            </div>

            <StoreLocationMap
                latitude={latitude}
                longitude={longitude}
                setLatitude={(value) => setField("Latitude", value, setLatitude)}
                setLongitude={(value) => setField("Longitude", value, setLongitude)}
            />
        </section>
    );
}
