"use client";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Circle, CircleMarker, useMap, Marker } from "react-leaflet";

function Recenter({ lat, lng }: { lat: number; lng: number }) {
	const map = useMap();
	useEffect(() => {
		if (!isFinite(lat) || !isFinite(lng)) return;
		map.setView([lat, lng], 15);
	}, [lat, lng, map]);
	return null;
}

function MarkerOverlay({ coords, accuracy }: { coords: { lat: number; lng: number }; accuracy: number | null }) {
	const map = useMap();
	const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

	useEffect(() => {
		if (!coords) return;
		const update = () => {
			try {
				const p = map.latLngToContainerPoint([coords.lat, coords.lng]);
				setPos({ x: p.x, y: p.y });
			} catch (e) {
				// ignore
			}
		};

		update();
		map.on("move zoom resize", update);
		return () => {
			map.off("move zoom resize", update);
		};
	}, [map, coords]);

	if (!pos) return null;

	// Position panel to the right of the marker and vertically centered
	const left = Math.round(pos.x + 20); // to the right of the marker
	const top = Math.round(pos.y); // we'll vertically center with translateY

	const panel = (
		<div
			style={{
				position: "absolute",
				left: Math.min(left, window.innerWidth - 200), // Prevent overflow on mobile
				top,
				transform: "translateY(-50%)",
				zIndex: 99999,
				pointerEvents: "auto",
				width: window.innerWidth < 640 ? 150 : 180, // Smaller on mobile
			}}
		>
			<div className="bg-white/95 text-xs sm:text-sm text-gray-800 p-2 rounded-md shadow-md">
				<div className="font-medium">Your location</div>
				<div className="mt-1">Lat: {coords.lat.toFixed(4)}</div>
				<div>Lng: {coords.lng.toFixed(4)}</div>
				{accuracy != null && <div className="text-xs text-gray-600">±{Math.round(accuracy)}m</div>}
			</div>
		</div>
	);

	const container = map.getContainer();
	if (!container) return null;
	return ReactDOM.createPortal(panel, container as HTMLElement);
}

export default function MapView({ fullScreen = false }: { fullScreen?: boolean }) {
	const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
	const [accuracy, setAccuracy] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!("geolocation" in navigator)) {
			setError("Geolocation is not supported by your browser.");
			setLoading(false);
			return;
		}

		navigator.geolocation.getCurrentPosition(
			(pos) => {
				setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
				setAccuracy(pos.coords.accuracy || null);
				setLoading(false);
			},
			(err) => {
				setError(err.message || "Failed to get location");
				setLoading(false);
			},
			{ enableHighAccuracy: true, timeout: 10000 }
		);

		return () => {
			/* no-op */
		};
	}, []);

	// create a small red pin svg icon as a divIcon so we don't need to import image assets
	const pinSvg = `
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="36">
			<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#e63946"/>
			<circle cx="12" cy="9" r="2.5" fill="white"/>
		</svg>
	`;
	const pinIcon = L.divIcon({ html: pinSvg, className: "", iconSize: [28, 36], iconAnchor: [14, 36] });

	return (
		<div className="w-full">
			<div style={{ position: "relative" }}>
				<div 
					style={{ 
						height: fullScreen ? "100vh" : "min(420px, 80vh)", 
						width: "100%", 
						borderRadius: fullScreen ? 0 : 12, 
						overflow: "hidden" 
					}}
					className="touch-pan-x touch-pan-y"
				>
					<MapContainer 
						center={[0, 0]} 
						zoom={2} 
						style={{ height: "100%", width: "100%" }}
						className="z-0"
						touchZoom={true}
						scrollWheelZoom={true}
						doubleClickZoom={true}
						dragging={true}
					>
						<TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
						{coords && (
							<>
								<Recenter lat={coords.lat} lng={coords.lng} />
								<Marker position={[coords.lat, coords.lng]} icon={pinIcon} />
								{accuracy && (
									<Circle center={[coords.lat, coords.lng]} radius={accuracy} pathOptions={{ color: "#2a9d8f", fillOpacity: 0.12 }} />
								)}
								<MarkerOverlay coords={coords} accuracy={accuracy} />
							</>
						)}
					</MapContainer>
				</div>
			</div>

			{loading && <p className="mt-3 text-sm text-gray-600 px-4 sm:px-0">Locating you… allow location access in your browser.</p>}
			{error && <p className="mt-3 text-sm text-red-600 px-4 sm:px-0">Error retrieving location: {error}</p>}
		</div>
	);
}
