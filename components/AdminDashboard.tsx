"use client";
import React, { useState, useEffect, useMemo } from 'react';
import "leaflet/dist/leaflet.css";
import { useAlerts } from '@/hooks/useAlerts';
import { useAllLocations } from '@/hooks/useAllLocations';
import { dispatchAlert, resolveAlert } from '@/lib/alerts';
import { useUserProfileContext } from '@/contexts/UserProfileProvider';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type Tourist = { id: string; name: string; email: string; role: string; verified: boolean; photoURL?: string; lastActive?: any };
type LocationData = { latestLocation?: { lat: number; lng: number; source?: string; timestamp?: any } };

type PolicePOI = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  distanceMeters: number;
};

function MapCenterController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => { map.setView(center, zoom, { animate: true }); }, [center, zoom, map]);
  return null;
}

export default function AdminDashboard() {
  const { items: alerts } = useAlerts('all');
  const { items: locations } = useAllLocations();
  const { user } = useUserProfileContext();

  const [tourists, setTourists] = useState<Tourist[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number]>([20, 0]);
  const [mapZoom, setMapZoom] = useState<number>(2);
  const [selected, setSelected] = useState<{ 
    title: string; 
    lat: number; 
    lng: number; 
    details?: string;
    type?: 'tourist' | 'sos';
    id?: string;
  } | null>(null);
  const [selectedTourist, setSelectedTourist] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [dispatchForm, setDispatchForm] = useState<{ alertId: string; classification: string; notes: string }>(
    { alertId: '', classification: 'Medical Emergency', notes: '' }
  );
  const [nearbyPolice, setNearbyPolice] = useState<PolicePOI[] | null>(null);
  const [policeLoading, setPoliceLoading] = useState<boolean>(false);
  const [policeError, setPoliceError] = useState<string | null>(null);

  const formatTimestamp = (value: any) => {
    if (!value) return 'Unknown time';
    try {
      // Firestore Timestamp or Date
      const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value.seconds ? value.seconds * 1000 : value);
      return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    } catch {
      return String(value);
    }
  };

  useEffect(() => {
    const { db } = getFirebase();
    const q = query(collection(db, 'users'), orderBy('lastActive', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setTourists(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter((u: any) => u.role === 'tourist'));
    });
    return () => unsub();
  }, []);

  const findLocation = (id: string) => locations.find(l => l.id === id)?.data as LocationData | undefined;

  // Statistics calculations
  const stats = useMemo(() => {
    const activeAlerts = alerts.filter(a => a.data.status === 'pending').length;
    const totalTourists = tourists.length;
    const touristsWithLocation = tourists.filter(t => findLocation(t.id)?.latestLocation).length;
    const verifiedAlerts = alerts.filter(a => a.data.status === 'verified').length;
    
    return { activeAlerts, totalTourists, touristsWithLocation, verifiedAlerts };
  }, [alerts, tourists, locations]);

  // Filtered tourists
  const filteredTourists = useMemo(() => {
    return tourists.filter(t => {
      const hasLocation = !!findLocation(t.id)?.latestLocation;
      if (filterStatus === 'active') return hasLocation;
      if (filterStatus === 'inactive') return !hasLocation;
      return true;
    });
  }, [tourists, locations, filterStatus]);

  const viewTourist = (id: string, name?: string) => {
    const loc = findLocation(id);
    setSelectedTourist(id);
    if (loc?.latestLocation) {
      setMapCenter([loc.latestLocation.lat, loc.latestLocation.lng]);
      setMapZoom(15);
      setSelected({ 
        title: name ?? id, 
        lat: loc.latestLocation.lat, 
        lng: loc.latestLocation.lng, 
        details: loc.latestLocation.source,
        type: 'tourist',
        id
      });
      setTimeout(() => document.getElementById('admin-map')?.scrollIntoView({ behavior: 'smooth' }), 100);
    } else {
      setSelected({ 
        title: name ?? id, 
        lat: 0, 
        lng: 0, 
        details: 'No GPS available',
        type: 'tourist',
        id
      });
    }
  };

  const viewAlert = (alert: any, lat: number, lng: number, title = 'SOS') => {
    setSelectedTourist(null);
    setMapCenter([lat, lng]); 
    setMapZoom(15); 
    setSelected({ 
      title, 
      lat, 
      lng, 
      type: 'sos',
      id: alert.id,
      details: `Status: ${alert.data.status}`
    });
    setTimeout(() => document.getElementById('admin-map')?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  // Haversine distance in meters
  const distanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371000; // meters
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Fetch nearest police station (prefer Google Places rankby=distance; fallback to Overpass)
  const fetchNearbyPolice = async (lat: number, lng: number) => {
    try {
      setPoliceLoading(true);
      setPoliceError(null);
      setNearbyPolice(null);
      const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

      // Try Google Places Nearby Search with rankby=distance (no radius) for multiple nearest results
      if (googleKey) {
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&rankby=distance&keyword=${encodeURIComponent('police station')}&key=${googleKey}`;
        const gRes = await fetch(url);
        if (!gRes.ok) throw new Error(`Google Places error ${gRes.status}`);
        const gData = await gRes.json();
        if (Array.isArray(gData.results) && gData.results.length > 0) {
          const pois: PolicePOI[] = gData.results
            .slice(0, 10)
            .map((r: any) => {
              const poiLat = Number(r?.geometry?.location?.lat);
              const poiLon = Number(r?.geometry?.location?.lng);
              if (!isFinite(poiLat) || !isFinite(poiLon)) return null;
              return {
                id: String(r.place_id || `${poiLat},${poiLon}`),
                name: r.name || 'Police Station',
                lat: poiLat,
                lng: poiLon,
                distanceMeters: Math.round(distanceMeters(lat, lng, poiLat, poiLon))
              } as PolicePOI;
            })
            .filter(Boolean)
            .sort((a: PolicePOI, b: PolicePOI) => a.distanceMeters - b.distanceMeters);
          setNearbyPolice(pois);
          return;
        }
        // If Google responds but has no results, fall through to Overpass
      }

      // Fallback: Overpass API with escalating radius; ensure at least one result if available in region
      const fetchOverpass = async (r: number) => {
        const q = `[
          out:json
        ];
        (
          node["amenity"="police"](around:${r},${lat},${lng});
          way["amenity"="police"](around:${r},${lat},${lng});
          relation["amenity"="police"](around:${r},${lat},${lng});
        );
        out center 50;`;
        const resp = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body: q
        });
        if (!resp.ok) throw new Error(`Overpass error ${resp.status}`);
        const d = await resp.json();
        const list: PolicePOI[] = (d.elements || [])
          .map((el: any) => {
            const center = el.type === 'node' ? { lat: el.lat, lon: el.lon } : (el.center || {});
            const poiLat = Number(center.lat);
            const poiLon = Number(center.lon);
            if (!isFinite(poiLat) || !isFinite(poiLon)) return null;
            const name = (el.tags && (el.tags.name || el.tags.operator || 'Police Station')) || 'Police Station';
            return {
              id: String(el.id),
              name,
              lat: poiLat,
              lng: poiLon,
              distanceMeters: Math.round(distanceMeters(lat, lng, poiLat, poiLon))
            } as PolicePOI;
          })
          .filter(Boolean)
          .sort((a: PolicePOI, b: PolicePOI) => a.distanceMeters - b.distanceMeters);
        return list;
      };

      const radii = [5000, 10000, 50000, 150000, 300000];
      let pois: PolicePOI[] = [];
      for (const r of radii) {
        pois = await fetchOverpass(r);
        if (pois.length > 0) break;
      }

      if (pois.length === 0) {
        // Final fallback: Nominatim search (no key) to get one closest result
        const nomiUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent('police station')}&limit=1&addressdetails=0&accept-language=en&lat=${lat}&lon=${lng}`;
        const nRes = await fetch(nomiUrl, { headers: { 'User-Agent': 'hackspire-app/1.0' } as any });
        if (nRes.ok) {
          const nData = await nRes.json();
          if (Array.isArray(nData) && nData.length > 0) {
            const n = nData[0];
            const poiLat = Number(n.lat);
            const poiLon = Number(n.lon);
            if (isFinite(poiLat) && isFinite(poiLon)) {
              pois = [{
                id: String(n.osm_id || `${poiLat},${poiLon}`),
                name: n.display_name?.split(',')?.[0] || 'Police Station',
                lat: poiLat,
                lng: poiLon,
                distanceMeters: Math.round(distanceMeters(lat, lng, poiLat, poiLon))
              }];
            }
          }
        }
      }

      // Ensure at least one is returned if any source produced a coordinate
      setNearbyPolice(pois.length > 0 ? pois.slice(0, 20) : []);
    } catch (e: any) {
      setPoliceError(e?.message || 'Failed to load nearby police stations');
    } finally {
      setPoliceLoading(false);
    }
  };

  // Refetch police stations when selection changes
  useEffect(() => {
    if (selected && isFinite(selected.lat) && isFinite(selected.lng)) {
      void fetchNearbyPolice(selected.lat, selected.lng);
    } else {
      setNearbyPolice(null);
      setPoliceError(null);
      setPoliceLoading(false);
    }
  }, [selected?.lat, selected?.lng]);

  const handleDispatchAlert = async (alertId: string, classification: string) => {
    try {
      await dispatchAlert({ 
        alertId, 
        adminId: user?.uid ?? 'unknown', 
        classification,
        notes: 'Dispatched from admin dashboard'
      });
    } catch (error) {
      console.error('Failed to dispatch alert:', error);
    }
  };

  useEffect(() => {
    if (selected?.type === 'sos' && selected.id) {
      setDispatchForm((prev) => ({ ...prev, alertId: selected.id! }));
    }
  }, [selected]);

  const handleResolveAlert = async (alertId: string) => {
    try {
      await resolveAlert(alertId);
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
  };

  // Enhanced icons with better styling
  const touristIcon = L.divIcon({ 
    html: `<div class="relative">
      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='32' height='40' class="drop-shadow-lg">
        <path d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z' fill='#16a34a'/>
        <circle cx='12' cy='9' r='3' fill='white'/>
        <path d='M12 6.5c1.38 0 2.5 1.12 2.5 2.5s-1.12 2.5-2.5 2.5S9.5 10.38 9.5 9s1.12-2.5 2.5-2.5z' fill='#16a34a'/>
      </svg>
    </div>`, 
    className: '', 
    iconSize: [32, 40], 
    iconAnchor: [16, 40] 
  });

  const selectedTouristIcon = L.divIcon({ 
    html: `<div class="relative animate-pulse">
      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='36' height='44' class="drop-shadow-xl">
        <path d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z' fill='#059669'/>
        <circle cx='12' cy='9' r='3.5' fill='white'/>
        <path d='M12 5.5c1.93 0 3.5 1.57 3.5 3.5s-1.57 3.5-3.5 3.5S8.5 10.93 8.5 9s1.57-3.5 3.5-3.5z' fill='#059669'/>
      </svg>
    </div>`, 
    className: '', 
    iconSize: [36, 44], 
    iconAnchor: [18, 44] 
  });
  
  const alertIcon = L.divIcon({ 
    html: `<div class="relative animate-bounce">
      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='36' height='44' class="drop-shadow-xl">
        <path d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z' fill='#dc2626'/>
        <circle cx='12' cy='9' r='4' fill='white'/>
        <text x='12' y='13' text-anchor='middle' fill='#dc2626' font-size='8' font-weight='bold'>!</text>
      </svg>
    </div>`, 
    className: '', 
    iconSize: [36, 44], 
    iconAnchor: [18, 44] 
  });

  const verifiedAlertIcon = L.divIcon({ 
    html: `<div class="relative">
      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='32' height='40' class="drop-shadow-lg">
        <path d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z' fill='#f59e0b'/>
        <circle cx='12' cy='9' r='3' fill='white'/>
        <path d='M10.5 9l1 1 2.5-2.5' stroke='#f59e0b' stroke-width='1.5' fill='none'/>
      </svg>
    </div>`, 
    className: '', 
    iconSize: [32, 40], 
    iconAnchor: [16, 40] 
  });

  const policeIcon = L.divIcon({
    html: `<div class="relative">
      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='28' height='36' class="drop-shadow">
        <path d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z' fill='#1d4ed8'/>
        <path d='M7 9h10l-5 6-5-6z' fill='white'/>
      </svg>
    </div>`,
    className: '',
    iconSize: [28, 36],
    iconAnchor: [14, 36]
  });

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 via-gray-100 to-green-50">
      <div className="container mx-auto px-4 py-6">
        {/* Header with Statistics */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Admin Control Center</h1>
              <p className="text-gray-600">Real-time monitoring and emergency response</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500">
                Last updated: {new Date().toLocaleTimeString()}
              </div>
              <Button 
                onClick={() => window.location.reload()} 
                variant="outline" 
                size="sm"
                className="border-green-600 text-green-600 hover:bg-green-50"
              >
                Refresh
              </Button>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Active Alerts</p>
                    <p className="text-2xl font-bold text-red-600">{stats.activeAlerts}</p>
                  </div>
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.084 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                </div>
              </CardContent>
            </Card>

          

            <Card className="border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Tourists</p>
                    <p className="text-2xl font-bold text-green-600">{stats.totalTourists}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">With GPS</p>
                    <p className="text-2xl font-bold text-blue-600">{stats.touristsWithLocation}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Dispatched</p>
                    <p className="text-2xl font-bold text-amber-600">{stats.verifiedAlerts}</p>
                  </div>
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Enhanced Map Section */}
            <Card id="admin-map" className="border-green-200 overflow-hidden">
              <CardHeader className="bg-linear-to-r from-green-600 to-green-700 text-white border-b-0 p-0">
                <div className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white text-lg">Real-time Monitoring Map</CardTitle>
                    <CardDescription className="text-green-100 mt-1">
                      Live tracking • {stats.touristsWithLocation} tourists • {stats.activeAlerts} active alerts
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-sm bg-green-800/30 px-3 py-1 rounded-full">
                      Zoom: {mapZoom}
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div style={{ height: 560 }} className="relative">
                  <MapContainer 
                    center={mapCenter} 
                    zoom={mapZoom} 
                    style={{ height: '100%', width: '100%' }} 
                    key={`${mapCenter[0]}-${mapCenter[1]}-${mapZoom}`}
                    className="z-0"
                  >
                    <TileLayer 
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    <MapCenterController center={mapCenter} zoom={mapZoom} />

                    {/* Tourist Markers */}
                    {locations.map(({ id, data }) => {
                      const tourist = tourists.find(t => t.id === id);
                      const isSelected = selectedTourist === id;
                      return data.latestLocation ? (
                        <Marker 
                          key={`tourist-${id}`} 
                          position={[data.latestLocation.lat, data.latestLocation.lng]} 
                          icon={isSelected ? selectedTouristIcon : touristIcon}
                          eventHandlers={{ 
                            click: () => {
                              setSelected({ 
                                title: `${tourist?.name || id}`, 
                                lat: data.latestLocation!.lat, 
                                lng: data.latestLocation!.lng, 
                                details: data.latestLocation?.source,
                                type: 'tourist',
                                id
                              });
                              setSelectedTourist(id);
                            }
                          }}
                        >
                          <Popup className="custom-popup">
                            <div className="p-2 min-w-[200px]">
                              <div className="flex items-center gap-2 mb-2">
                                {tourist?.photoURL ? (
                                  <img src={tourist.photoURL} className="w-8 h-8 rounded-full" alt={tourist.name} />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-semibold">
                                    {tourist?.name?.charAt(0)?.toUpperCase() || 'T'}
                                  </div>
                                )}
                                <div>
                                  <div className="font-semibold text-gray-900">{tourist?.name || id}</div>
                                  <div className="text-xs text-gray-600">{tourist?.email}</div>
                                </div>
                              </div>
                              <div className="text-xs text-gray-500 mb-2">
                                Source: {data.latestLocation.source || 'Unknown'}
                              </div>
                              <div className="bg-green-50 p-2 rounded mb-2">
                                <div className="text-xs font-mono text-green-800">
                                  {data.latestLocation.lat.toFixed(6)}, {data.latestLocation.lng.toFixed(6)}
                                </div>
                              </div>
                              <Button 
                                size="sm" 
                                onClick={() => copyToClipboard(`${data.latestLocation!.lat},${data.latestLocation!.lng}`)}
                                className="w-full bg-green-600 hover:bg-green-700"
                              >
                                Copy Coordinates
                              </Button>
                            </div>
                          </Popup>
                        </Marker>
                      ) : null;
                    })}

                    {/* SOS Alert Markers */}
                    {alerts.map(({ id, data }) => (
                      data.location && data.status !== 'resolved' ? (
                        <Marker 
                          key={`alert-${id}`} 
                          position={[data.location.lat, data.location.lng]} 
                          icon={data.status === 'verified' ? verifiedAlertIcon : alertIcon}
                          eventHandlers={{ 
                            click: () => viewAlert(
                              { id, data }, 
                              data.location!.lat, 
                              data.location!.lng, 
                              `SOS: ${data.userName || 'Unknown'}`
                            )
                          }}
                        >
                          <Popup className="custom-popup">
                            <div className="p-2 min-w-[220px]">
                              <div className="flex items-center gap-2 mb-3">
                                <div className={`w-3 h-3 rounded-full ${
                                  data.status === 'pending' ? 'bg-red-500' : 
                                  data.status === 'verified' ? 'bg-amber-500' : 'bg-gray-500'
                                }`}></div>
                                <div className="font-semibold text-red-600 text-lg">SOS ALERT</div>
                                <div className={`text-xs px-2 py-1 rounded-full ${
                                  data.status === 'pending' ? 'bg-red-100 text-red-700' :
                                  data.status === 'verified' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'
                                }`}>
                                  {data.status.toUpperCase()}
                                </div>
                              </div>
                              
                              <div className="space-y-2 mb-3">
                                <div>
                                  <span className="text-xs text-gray-500">User:</span>
                                  <div className="font-medium">{data.userName || 'Unknown'}</div>
                                </div>
                                {data.message && (
                                  <div>
                                    <span className="text-xs text-gray-500">Message:</span>
                                    <div className="text-sm">{data.message}</div>
                                  </div>
                                )}
                                <div>
                                  <span className="text-xs text-gray-500">Location:</span>
                                  <div className="font-mono text-xs bg-red-50 p-2 rounded">
                                    {data.location.lat.toFixed(6)}, {data.location.lng.toFixed(6)}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex gap-2">
                                {data.status === 'pending' && (
                                  <Button 
                                    size="sm"
                                    onClick={() => handleDispatchAlert(id, 'emergency')}
                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                  >
                                    Dispatch
                                  </Button>
                                )}
                                <Button 
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleResolveAlert(id)}
                                  className="flex-1"
                                >
                                  Resolve
                                </Button>
                              </div>
                            </div>
                          </Popup>
                        </Marker>
                      ) : null
                    ))}

                    {/* Nearby Police Markers */}
                    {nearbyPolice && nearbyPolice.map(p => (
                      <Marker
                        key={`police-${p.id}`}
                        position={[p.lat, p.lng]}
                        icon={policeIcon}
                      >
                        <Popup className="custom-popup">
                          <div className="p-2 min-w-[200px]">
                            <div className="font-semibold text-blue-700 mb-1">{p.name}</div>
                            <div className="text-xs text-gray-600">~{(p.distanceMeters/1000).toFixed(2)} km away</div>
                            <Button size="sm" className="mt-2 w-full" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`, '_blank')}>Directions</Button>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
              </CardContent>
            </Card>

            {/* Enhanced Selected Location Section */}
            <Card className="border-green-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Selected Location Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selected ? (
                  <div className="space-y-4">
                    <div className={`p-4 rounded-lg border-l-4 ${
                      selected.type === 'sos' ? 'bg-red-50 border-red-500' : 'bg-green-50 border-green-500'
                    }`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`w-2 h-2 rounded-full ${
                              selected.type === 'sos' ? 'bg-red-500' : 'bg-green-500'
                            }`}></div>
                            <span className={`text-xs font-medium ${
                              selected.type === 'sos' ? 'text-red-700' : 'text-green-700'
                            }`}>
                              {selected.type === 'sos' ? 'SOS ALERT' : 'TOURIST'}
                            </span>
                          </div>
                          <div className="font-semibold text-gray-900 mb-1">{selected.title}</div>
                          {selected.details && (
                            <div className="text-sm text-gray-600 mb-2">{selected.details}</div>
                          )}
                        </div>
                      </div>
                      
                      <div className="bg-white p-3 rounded border mt-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Coordinates</div>
                            <div className="font-mono text-sm text-gray-800">
                              {selected.lat.toFixed(6)}, {selected.lng.toFixed(6)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Timestamp</div>
                            <div className="text-sm text-gray-800">
                              {selected.type === 'tourist' ? (
                                (() => {
                                  const loc = selected.id ? findLocation(selected.id) : undefined;
                                  return formatTimestamp(loc?.latestLocation?.timestamp);
                                })()
                              ) : (
                                (() => {
                                  const alert = alerts.find(a => a.id === selected.id);
                                  return formatTimestamp(alert?.data?.timestamp);
                                })()
                              )}
                            </div>
                          </div>
                          <div className="flex items-end gap-2">
                            <Button 
                              size="sm"
                              onClick={() => copyToClipboard(`${selected.lat},${selected.lng}`)}
                              className={selected.type === 'sos' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
                            >
                              Copy Coords
                            </Button>
                            <Button 
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(`https://www.google.com/maps?q=${selected.lat},${selected.lng}`, '_blank')}
                            >
                              Open in Maps
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Nearby Police Stations List */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 2a6 6 0 016 6c0 6-6 10-6 10S4 14 4 8a6 6 0 016-6zm0 8a2 2 0 100-4 2 2 0 000 4z" />
                          </svg>
                          <div className="font-medium">Nearby Police Stations</div>
                        </div>
                        {selected && (
                          <div className="text-xs text-gray-500">Reference: {selected.lat.toFixed(3)}, {selected.lng.toFixed(3)}</div>
                        )}
                      </div>
                      <div className="rounded border bg-white">
                        {policeLoading && (
                          <div className="p-3 text-sm text-gray-600">Searching within 3 km…</div>
                        )}
                        {policeError && (
                          <div className="p-3 text-sm text-red-600">{policeError}</div>
                        )}
                        {!policeLoading && !policeError && (!nearbyPolice || nearbyPolice.length === 0) && (
                          <div className="p-3 text-sm text-gray-600">No police stations found nearby.</div>
                        )}
                        {!policeLoading && !policeError && nearbyPolice && nearbyPolice.length > 0 && (
                          <ul className="max-h-60 overflow-y-auto divide-y">
                            {nearbyPolice.map((p) => (
                              <li key={p.id} className="p-3 flex items-center justify-between gap-3">
                                <div>
                                  <div className="font-medium text-gray-900">{p.name}</div>
                                  <div className="text-xs text-gray-600">~{(p.distanceMeters/1000).toFixed(2)} km</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button size="sm" variant="outline" onClick={() => window.open(`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}`, '_blank')}>View</Button>
                                  <Button size="sm" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`, '_blank')}>Route</Button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    {selected.type === 'tourist' && selected.id && (() => {
                      const t = tourists.find(u => u.id === selected.id);
                      const loc = findLocation(selected.id);
                      return (
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex items-start gap-3">
                            {t?.photoURL ? (
                              <img src={t.photoURL} className="w-12 h-12 rounded-full border" alt={t.name} />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold text-lg">
                                {t?.name?.charAt(0)?.toUpperCase() || 'T'}
                              </div>
                            )}
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <div className="text-xs text-gray-500">Name</div>
                                <div className="font-medium text-gray-900">{t?.name || selected.title}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500">Email</div>
                                <div className="text-sm text-gray-800">{t?.email || 'N/A'}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500">Verified</div>
                                <div className={`inline-flex items-center text-xs px-2 py-1 rounded-full ${t?.verified ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{t?.verified ? 'Yes' : 'No'}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500">User ID</div>
                                <div className="text-xs font-mono text-gray-700 break-all">{t?.id}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500">Last Active</div>
                                <div className="text-sm text-gray-800">{formatTimestamp(t?.lastActive)}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500">GPS Source</div>
                                <div className="text-sm text-gray-800">{loc?.latestLocation?.source || 'Unknown'}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="text-gray-500 text-sm">Click a tourist or SOS marker on the map</p>
                    <p className="text-gray-400 text-xs mt-1">to view location details</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-6">
            {/* Active Alerts Panel */}
            {alerts.filter(a => a.data.status === 'pending').length > 0 && (
              <Card className="border-red-200 bg-red-50/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2 text-red-700">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.084 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    Urgent Alerts ({alerts.filter(a => a.data.status === 'pending').length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="max-h-60 overflow-y-auto space-y-3">
                  {alerts.filter(a => a.data.status === 'pending').slice(0, 3).map(alert => (
                    <div key={alert.id} className="bg-white p-3 rounded border border-red-200">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="font-medium text-red-700">{alert.data.userName}</div>
                          <div className="text-xs text-gray-600 mt-1">{alert.data.message}</div>
                          {alert.data.location && (
                            <div className="text-xs font-mono text-gray-500 mt-1">
                              {alert.data.location.lat.toFixed(4)}, {alert.data.location.lng.toFixed(4)}
                            </div>
                          )}
                        </div>
                        <Button 
                          size="sm"
                          onClick={() => alert.data.location && viewAlert(alert, alert.data.location.lat, alert.data.location.lng)}
                          className="bg-red-600 hover:bg-red-700 text-xs"
                        >
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Enhanced Tourists Panel */}
            <Card className="border-green-200 overflow-hidden flex flex-col">
              <CardHeader className="bg-linear-to-r from-green-600 to-green-700 text-white border-b-0 p-0 shrink-0">
                <div className="px-5 py-6">
                  <CardTitle className="text-white flex items-center justify-between">
                    <span>Tourist Management</span>
                    <span className="text-sm bg-green-800/30 px-2 py-1 rounded-full">
                      {stats.touristsWithLocation}/{stats.totalTourists}
                    </span>
                  </CardTitle>
                  <CardDescription className="text-green-100 mt-2">
                    Real-time location tracking
                  </CardDescription>
                </div>
              </CardHeader>
              
              <CardContent className="p-0 flex flex-col">
                {/* Filter Controls */}
                <div className="p-4 border-b bg-gray-50 shrink-0">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={filterStatus === 'all' ? 'default' : 'outline'}
                      onClick={() => setFilterStatus('all')}
                      className={filterStatus === 'all' ? 'bg-green-600 hover:bg-green-700' : ''}
                    >
                      All ({tourists.length})
                    </Button>
                    <Button
                      size="sm"
                      variant={filterStatus === 'active' ? 'default' : 'outline'}
                      onClick={() => setFilterStatus('active')}
                      className={filterStatus === 'active' ? 'bg-green-600 hover:bg-green-700' : ''}
                    >
                      With GPS ({stats.touristsWithLocation})
                    </Button>
                    <Button
                      size="sm"
                      variant={filterStatus === 'inactive' ? 'default' : 'outline'}
                      onClick={() => setFilterStatus('inactive')}
                      className={filterStatus === 'inactive' ? 'bg-green-600 hover:bg-green-700' : ''}
                    >
                      No GPS ({stats.totalTourists - stats.touristsWithLocation})
                    </Button>
                  </div>
                </div>

                <div>
                  {filteredTourists.map(tourist => {
                    const loc = findLocation(tourist.id);
                    const isSelected = selectedTourist === tourist.id;
                    return (
                      <div 
                        key={tourist.id} 
                        className={`p-4 border-b last:border-b-0 hover:bg-gray-50 transition-colors cursor-pointer ${
                          isSelected ? 'bg-green-50 border-green-200' : ''
                        }`}
                        onClick={() => viewTourist(tourist.id, tourist.name)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="shrink-0 relative">
                            {tourist.photoURL ? (
                              <img 
                                src={tourist.photoURL} 
                                className="w-12 h-12 rounded-full border-2 border-gray-200 shadow-sm" 
                                alt={tourist.name} 
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center font-semibold text-lg shadow-sm">
                                {tourist.name?.charAt(0)?.toUpperCase() || 'T'}
                              </div>
                            )}
                            {loc?.latestLocation && (
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full flex items-center justify-center">
                                <div className="w-2 h-2 bg-white rounded-full"></div>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="font-medium text-gray-900 truncate">{tourist.name}</div>
                              {tourist.verified && (
                                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <div className="text-sm text-gray-500 truncate mb-2">{tourist.email}</div>
                            
                            <div className="flex items-center justify-between">
                              {loc?.latestLocation ? (
                                <div className="flex items-center gap-2">
                                  <div className="text-xs text-green-600 font-medium">GPS Active</div>
                                  <div className="text-xs font-mono text-gray-500">
                                    {loc.latestLocation.lat.toFixed(3)}, {loc.latestLocation.lng.toFixed(3)}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs text-gray-400">No GPS signal</div>
                              )}
                              
                              <Button 
                                size="sm" 
                                variant="ghost"
                                className="text-green-600 hover:text-green-700 h-6 px-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  viewTourist(tourist.id, tourist.name);
                                }}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {filteredTourists.length === 0 && (
                    <div className="p-8 text-center">
                      <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                      <p className="text-gray-500 text-sm">No tourists match this filter</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
        {/* SOS Dispatch Section (Bottom) */}
        <div className="mt-8">
          <Card className="border-red-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-red-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.084 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                Dispatch SOS Help
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Select Alert</label>
                  <select
                    value={dispatchForm.alertId}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, alertId: e.target.value })}
                    className="w-full border rounded px-3 py-2 text-sm"
                  >
                    <option value="">Choose pending alert…</option>
                    {alerts.filter(a => a.data.status === 'pending').map((a) => (
                      <option key={a.id} value={a.id}>
                        {(a.data.userName || 'Unknown') + (a.data.location ? ` (${a.data.location.lat.toFixed(3)}, ${a.data.location.lng.toFixed(3)})` : '')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Emergency Type</label>
                  <select
                    value={dispatchForm.classification}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, classification: e.target.value })}
                    className="w-full border rounded px-3 py-2 text-sm"
                  >
                    <option>Medical Emergency</option>
                    <option>Security Threat</option>
                    <option>Accident</option>
                    <option>Natural Disaster</option>
                    <option>Lost/Stranded</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <Button
                    disabled={!dispatchForm.alertId}
                    onClick={async () => {
                      if (!dispatchForm.alertId) return;
                      try {
                        await dispatchAlert({
                          alertId: dispatchForm.alertId,
                          adminId: user?.uid ?? 'unknown',
                          classification: dispatchForm.classification,
                          notes: dispatchForm.notes || 'Dispatched from admin dashboard',
                        });
                        setDispatchForm((prev) => ({ ...prev, notes: '' }));
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                    className="w-full bg-red-600 hover:bg-red-700"
                  >
                    Dispatch Help
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Notes (optional)</label>
                <textarea
                  value={dispatchForm.notes}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, notes: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm min-h-[80px]"
                  placeholder="Add context for responders…"
                />
              </div>

              {dispatchForm.alertId && (
                <div className="text-xs text-gray-500">
                  Tip: Use the map or the alerts panel to review details before dispatching.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}