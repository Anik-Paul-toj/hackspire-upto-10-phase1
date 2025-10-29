"use client"
import dynamic from "next/dynamic";
const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });
const LocationSync = dynamic(() => import("@/components/LocationSync"), { ssr: false });


export default function Map() {
  return (
    <main className="min-h-screen px-0 py-0">
      <LocationSync />
      <MapView fullScreen />
    </main>
  );
}
