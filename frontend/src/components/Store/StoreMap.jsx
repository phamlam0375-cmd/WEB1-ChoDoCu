import {
    MapContainer,
    Marker,
    Popup,
    TileLayer,
} from "react-leaflet";
import { MapPin, Navigation } from "lucide-react";

export default function StoreMap({
    store,
    latitude,
    longitude,
    hasLocation,
}) {
    return (
        <div className="mt-6 overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
            {/* HEADER */}
            <div className="border-b border-slate-100 p-6">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
                        <Navigation className="h-5 w-5 text-emerald-600" />
                    </div>

                    <div>
                        <h2 className="font-bold text-slate-800">
                            Vị trí cửa hàng
                        </h2>

                        <p className="text-sm text-slate-500">
                            Vị trí trên bản đồ
                        </p>
                    </div>
                </div>
            </div>

            {/* MAP */}
            <div className="relative z-0 h-[450px] w-full overflow-hidden">
                {hasLocation ? (
                    <MapContainer
                        center={[latitude, longitude]}
                        zoom={16}
                        scrollWheelZoom={false}
                        className="h-full w-full"
                    >
                        <TileLayer
                            attribution="&copy; OpenStreetMap contributors"
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />

                        <Marker
                            position={[
                                latitude,
                                longitude,
                            ]}
                        >
                            <Popup>
                                <strong>
                                    {store.StoreName}
                                </strong>

                                <br />

                                {store.Address ||
                                    "Chưa cập nhật địa chỉ"}
                            </Popup>
                        </Marker>
                    </MapContainer>
                ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-emerald-50">
                        <MapPin className="mb-3 h-10 w-10 text-emerald-500" />

                        <p className="font-medium text-slate-700">
                            Chưa có vị trí
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                            Cửa hàng chưa cập nhật tọa độ.
                        </p>
                    </div>
                )}
            </div>

            {/* COORDINATES */}
            {hasLocation && (
                <div className="border-t border-slate-100 px-6 py-4">
                    <div className="flex items-center justify-between gap-4">
                        {/* LEFT */}
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                                <Navigation className="h-4 w-4 text-emerald-600" />
                            </div>

                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-700">
                                    Tọa độ cửa hàng
                                </p>

                                <p className="mt-0.5 text-xs text-slate-400">
                                    Vị trí trên bản đồ
                                </p>
                            </div>
                        </div>

                        {/* RIGHT */}
                        <div className="shrink-0 text-right">
                            <p className="font-mono text-sm font-medium tracking-tight text-slate-700">
                                {Number(latitude).toFixed(6)},{" "}
                                {Number(longitude).toFixed(6)}
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                                Latitude, Longitude
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}