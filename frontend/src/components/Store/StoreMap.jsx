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
        <>
            <div className="mt-6 overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">

                <div className="border-b border-slate-100 p-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
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

                <div className="h-112.5 w-full">
                    {hasLocation ? (
                        <MapContainer
                            center={[
                                latitude,
                                longitude,
                            ]}
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
                                        {
                                            store.StoreName
                                        }
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

                {hasLocation && (
                    <div className="border-t border-slate-100 px-6 py-4">
                        <p className="text-sm text-slate-500">
                            Tọa độ:{" "}
                            <span className="font-medium text-slate-700">
                                {latitude},{" "}
                                {longitude}
                            </span>
                        </p>
                    </div>
                )}
            </div>
        </>
    );
}
