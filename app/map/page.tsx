"use client"
import MapView from "@/components/MapView";
import dynamic from "next/dynamic";
const LocationSync = dynamic(() => import("@/components/LocationSync"), { ssr: false });


export default function Map() {
  return (
    <main className="min-h-screen px-0 py-0">
      <LocationSync />
      <MapView fullScreen />
    </main>
  );
}
