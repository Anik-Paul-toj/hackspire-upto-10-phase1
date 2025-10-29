"use client";
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useAlerts } from '@/hooks/useAlerts';
import { useAllLocations } from '@/hooks/useAllLocations';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function AlertsPanel() {
  const [filter, setFilter] = useState<'all'|'pending'|'verified'|'resolved'>('pending');
  const { items, loading } = useAlerts(filter);

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Alerts</h2>
        <div className="flex gap-2 text-sm">
          {(['all','pending','verified','resolved'] as const).map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={`rounded-md border px-2 py-1 ${filter===s?'bg-gray-100':''}`}>{s}</button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="text-sm text-gray-600">Loading…</div>
      ) : (
        <ul className="divide-y">
          {items.map(({ id, data }) => (
            <li key={id} className="py-3 flex items-start justify-between gap-3">
              <div>
                <div className="font-medium text-sm">{data.userName || data.userID}</div>
                <div className="text-sm text-gray-700">{data.message}</div>
                <div className="text-xs text-gray-500">{data.location ? `lat ${data.location.lat.toFixed?.(5)}, lng ${data.location.lng.toFixed?.(5)}` : 'no GPS'}</div>
              </div>
              <div className="text-right text-sm">
                <div className="mb-1">Status: {data.blockchainTX ? 'Verified ✅' : data.status}</div>
                {data.blockchainTX && (
                  <a className="text-blue-600 underline" href={`https://mumbai.polygonscan.com/tx/${data.blockchainTX}`} target="_blank" rel="noreferrer">TX</a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LocationsMap() {
  const { items } = useAllLocations();
  const pinSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="36">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#0ea5e9"/>
      <circle cx="12" cy="9" r="2.5" fill="white"/>
    </svg>
  `;
  const pinIcon = L.divIcon({ html: pinSvg, className: '', iconSize: [28,36], iconAnchor: [14,36] });

  const center = items.length && items[0].data.latestLocation ? [items[0].data.latestLocation.lat, items[0].data.latestLocation.lng] as [number, number] : [20, 0];

  return (
    <div className="rounded-lg border overflow-hidden max-w-[900px] mx-auto">
      <MapContainer center={center} zoom={3} style={{ height: 320, width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {items.map(({ id, data }) => (
          data.latestLocation ? (
            <Marker key={id} position={[data.latestLocation.lat, data.latestLocation.lng]} icon={pinIcon}>
              <Popup>
                <div className="text-sm">User: {id}<br/>Source: {data.latestLocation.source || 'n/a'}</div>
              </Popup>
            </Marker>
          ) : null
        ))}
      </MapContainer>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <div className="container mx-auto px-6 py-6 grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <LocationsMap />
      </div>
      <div>
        <AlertsPanel />
      </div>
    </div>
  );
}


