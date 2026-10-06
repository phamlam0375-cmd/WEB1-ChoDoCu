import {
    MapContainer,
    Marker,
    TileLayer,
    useMap,
    useMapEvents,
} from "react-leaflet";

import { MapPin } from "lucide-react";
import { useEffect } from "react";

function MapController({ latitude, longitude }) {
    const map = useMap();

    useEffect(() => {
        if (
            Number.isFinite(latitude) &&
            Number.isFinite(longitude)
        ) {
            map.setView(
                [latitude, longitude],
                16
            );
        }
    }, [latitude, longitude, map]);

    return null;
}

function MapClickHandler({
    setLatitude,
    setLongitude,
}) {
    useMapEvents({
        click(e) {
            setLatitude(
                e.latlng.lat.toFixed(6)
            );

            setLongitude(
                e.latlng.lng.toFixed(6)
            );
        },
    });

    return null;
}

export default function StoreLocationMap({
    latitude,
    longitude,
    setLatitude,
    setLongitude,
}) {
    const lat = Number(latitude);
    const lng = Number(longitude);

    const hasLocation =
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180;

    if (!hasLocation) {
        return (
            <div className="flex h-[350px] w-full flex-col items-center justify-center rounded-xl bg-emerald-50">
                <MapPin className="mb-3 h-10 w-10 text-emerald-500" />

                <p className="font-medium text-slate-700">
                    Chưa có vị trí
                </p>

                <p className="mt-1 text-sm text-slate-500">
                    Nhập địa chỉ và tìm vị trí.
                </p>
            </div>
        );
    }

    return (
        <div className="relative z-0 h-100 w-full overflow-hidden rounded-xl">
            <MapContainer
                center={[lat, lng]}
                zoom={16}
                scrollWheelZoom={false}
                className="h-full w-full"
            >
                <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <MapController
                    latitude={lat}
                    longitude={lng}
                />

                <MapClickHandler
                    setLatitude={setLatitude}
                    setLongitude={setLongitude}
                />

                <Marker position={[lat, lng]} />
            </MapContainer>
        </div>
    );
}