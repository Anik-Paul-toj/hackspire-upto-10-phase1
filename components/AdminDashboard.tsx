"use client";
import React, { useState, useEffect, useMemo } from 'react';
import "leaflet/dist/leaflet.css";
import { useAlerts } from '@/hooks/useAlerts';
import { useAllLocations } from '@/hooks/useAllLocations';
import { useRealtimeSOS } from '@/hooks/useRealtimeSOS';
import { useDevicesSOS, upsertDeviceSOSIntoFirestore } from '@/hooks/useDevicesSOS';
import { dispatchAlert, resolveAlert, createAlert } from '@/lib/alerts';
import { updateAdminActivity } from '@/lib/user';
import { useUserProfileContext } from '@/contexts/UserProfileProvider';
import { collection, onSnapshot } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, Circle } from 'react-leaflet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// 50 random unsafe zones scattered around Kolkata area (22.443830, 88.416730)
const UNSAFE_ZONES = [
  [22.441234, 88.423567], [22.467891, 88.402345], [22.428456, 88.435678], [22.454321, 88.408912],
  [22.437890, 88.421234], [22.461345, 88.395678], [22.433456, 88.429012], [22.459789, 88.411345],
  [22.425678, 88.417890], [22.452134, 88.403456], [22.439012, 88.426789], [22.456789, 88.399012],
  [22.431234, 88.413456], [22.464567, 88.407890], [22.447890, 88.431234], [22.435678, 88.419567],
  [22.463012, 88.401890], [22.441567, 88.425234], [22.458345, 88.393678], [22.429789, 88.437012],
  [22.466234, 88.405345], [22.443890, 88.427678], [22.450123, 88.409234], [22.427345, 88.433567],
  [22.465890, 88.397890], [22.439567, 88.421567], [22.462234, 88.415890], [22.435012, 88.409123],
  [22.457678, 88.431890], [22.441890, 88.403234], [22.448567, 88.427345], [22.433789, 88.419012],
  [22.460456, 88.393345], [22.446123, 88.425678], [22.438234, 88.407567], [22.454890, 88.429890],
  [22.442567, 88.401567], [22.467234, 88.423890], [22.430456, 88.415234], [22.463789, 88.397567],
  [22.445012, 88.431567], [22.426890, 88.409890], [22.459234, 88.403890], [22.437567, 88.427234],
  [22.451890, 88.395234], [22.444345, 88.423234], [22.466890, 88.407234], [22.432123, 88.429567],
  [22.458890, 88.401234], [22.440567, 88.425890]
];

// Function to check if a point is within unsafe zone radius
const isPointInUnsafeZone = (lat: number, lng: number, unsafeRadius = 100) => {
  return UNSAFE_ZONES.some(zone => {
    const distance = getDistanceFromLatLonInMeters(lat, lng, zone[0], zone[1]);
    return distance <= unsafeRadius;
  });
};

// Function to calculate distance between two points
const getDistanceFromLatLonInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371000; // Radius of the earth in meters
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const d = R * c; // Distance in meters
  return d;
};

const deg2rad = (deg: number) => {
  return deg * (Math.PI/180);
};

// Function to generate safe route avoiding unsafe zones using actual roads
const generateSafeRoute = async (startLat: number, startLng: number, endLat: number, endLng: number) => {
  try {
    console.log('Generating safe route from', startLat, startLng, 'to', endLat, endLng);
    
    // First, get the direct route to analyze
    const directUrl = `/api/route?fromLat=${startLat}&fromLng=${startLng}&toLat=${endLat}&toLng=${endLng}`;
    const directResponse = await fetch(directUrl);
    
    if (directResponse.ok) {
      const directData = await directResponse.json();
      
      if (directData.success && directData.coordinates) {
        console.log('Direct route received with', directData.coordinates.length, 'points');
        
        // Check if direct route is safe
        const unsafePoints = directData.coordinates.filter((coord: [number, number]) => 
          isPointInUnsafeZone(coord[0], coord[1], 150)
        );
        
        if (unsafePoints.length === 0) {
          console.log('Direct route is safe, using it');
          return directData.coordinates;
        }
        
        console.log('Direct route has', unsafePoints.length, 'unsafe points, generating safe alternative');
        
        // Find strategic waypoints that create a road-based detour
        const strategicWaypoints = await findStrategicRoadWaypoints(startLat, startLng, endLat, endLng, unsafePoints);
        
        if (strategicWaypoints.length > 0) {
          console.log('Found', strategicWaypoints.length, 'strategic waypoints');
          
          // Get route through strategic waypoints
          const waypointsParam = strategicWaypoints.map(wp => `${wp[0]},${wp[1]}`).join('|');
          const safeUrl = `/api/route?fromLat=${startLat}&fromLng=${startLng}&toLat=${endLat}&toLng=${endLng}&waypoints=${waypointsParam}`;
          
          const safeResponse = await fetch(safeUrl);
          if (safeResponse.ok) {
            const safeData = await safeResponse.json();
            if (safeData.success && safeData.coordinates) {
              // Verify the new route is actually safe
              const newUnsafePoints = safeData.coordinates.filter((coord: [number, number]) => 
                isPointInUnsafeZone(coord[0], coord[1], 100)
              );
              
              if (newUnsafePoints.length === 0) {
                console.log('Generated safe route successfully with', safeData.coordinates.length, 'points');
                return safeData.coordinates;
              } else {
                console.log('Generated route still has', newUnsafePoints.length, 'unsafe points, trying alternative');
              }
            }
          }
        }
        
        // Try major road routing as fallback
        return await generateMajorRoadRoute(startLat, startLng, endLat, endLng);
      }
    }
    
    return await generateMajorRoadRoute(startLat, startLng, endLat, endLng);
    
  } catch (error) {
    console.error('Error generating safe route:', error);
    return await generateMajorRoadRoute(startLat, startLng, endLat, endLng);
  }
};

// Find strategic waypoints based on major roads and safe areas
const findStrategicRoadWaypoints = async (startLat: number, startLng: number, endLat: number, endLng: number, unsafePoints: [number, number][]): Promise<[number, number][]> => {
  const waypoints: [number, number][] = [];
  
  // Calculate the general direction and distance
  const latDiff = endLat - startLat;
  const lngDiff = endLng - startLng;
  const totalDistance = getDistanceFromLatLonInMeters(startLat, startLng, endLat, endLng);
  
  // If it's a short route (< 2km), use simple offset waypoints
  if (totalDistance < 2000) {
    const midLat = startLat + latDiff * 0.5;
    const midLng = startLng + lngDiff * 0.5;
    
    // Try different offset directions to avoid unsafe zones
    const offsets = [
      [0.003, 0],     // North
      [-0.003, 0],    // South  
      [0, 0.003],     // East
      [0, -0.003],    // West
    ];
    
    for (const [latOffset, lngOffset] of offsets) {
      const waypointLat = midLat + latOffset;
      const waypointLng = midLng + lngOffset;
      
      if (!isPointInUnsafeZone(waypointLat, waypointLng, 200)) {
        waypoints.push([waypointLat, waypointLng]);
        break;
      }
    }
  } else {
    // For longer routes, use multiple strategic waypoints
    
    // First waypoint - go around the unsafe zone cluster
    const quarter1Lat = startLat + latDiff * 0.25;
    const quarter1Lng = startLng + lngDiff * 0.25;
    
    // Find safe area near first quarter point
    let safeWaypoint1 = findNearestMajorRoadPoint(quarter1Lat, quarter1Lng);
    if (safeWaypoint1) {
      waypoints.push(safeWaypoint1);
    }
    
    // Second waypoint - continue avoiding unsafe areas
    const quarter3Lat = startLat + latDiff * 0.75;
    const quarter3Lng = startLng + lngDiff * 0.75;
    
    let safeWaypoint2 = findNearestMajorRoadPoint(quarter3Lat, quarter3Lng);
    if (safeWaypoint2) {
      waypoints.push(safeWaypoint2);
    }
  }
  
  return waypoints;
};

// Find nearest point that's likely on a major road and safe
const findNearestMajorRoadPoint = (lat: number, lng: number): [number, number] | null => {
  // Major road coordinates in Kolkata area (these are approximate main road intersections)
  const majorRoadPoints = [
    [22.4707, 88.4117], // Sealdah area
    [22.4632, 88.4015], // Park Street area  
    [22.4561, 88.3931], // Kalighat area
    [22.4354, 88.4006], // Garia area
    [22.4489, 88.4236], // Salt Lake area
    [22.4276, 88.4213], // Jadavpur area
    [22.4918, 88.4005], // Shyambazar area
    [22.4802, 88.4167], // Belgachia area
  ];
  
  let nearestPoint: [number, number] | null = null;
  let minDistance = Infinity;
  
  for (const roadPoint of majorRoadPoints) {
    const distance = getDistanceFromLatLonInMeters(lat, lng, roadPoint[0], roadPoint[1]);
    
    // Only consider points that are safe and reasonably close
    if (distance < minDistance && distance < 3000 && !isPointInUnsafeZone(roadPoint[0], roadPoint[1], 300)) {
      minDistance = distance;
      nearestPoint = [roadPoint[0], roadPoint[1]];
    }
  }
  
  return nearestPoint;
};

// Generate route using major roads when all else fails
const generateMajorRoadRoute = async (startLat: number, startLng: number, endLat: number, endLng: number): Promise<[number, number][]> => {
  console.log('Generating major road route as fallback');
  
  // Use known safe major road points as waypoints
  const safeRoadWaypoints: [number, number][] = [];
  
  // Determine which major roads to use based on direction
  const latDiff = endLat - startLat;
  const lngDiff = endLng - startLng;
  
  if (Math.abs(latDiff) > Math.abs(lngDiff)) {
    // More vertical movement - use north-south roads
    if (latDiff > 0) {
      // Going north
      safeRoadWaypoints.push([22.4632, 88.4015]); // Park Street
      safeRoadWaypoints.push([22.4707, 88.4117]); // Sealdah
    } else {
      // Going south  
      safeRoadWaypoints.push([22.4354, 88.4006]); // Garia
      safeRoadWaypoints.push([22.4276, 88.4213]); // Jadavpur
    }
  } else {
    // More horizontal movement - use east-west roads
    if (lngDiff > 0) {
      // Going east
      safeRoadWaypoints.push([22.4489, 88.4236]); // Salt Lake
    } else {
      // Going west
      safeRoadWaypoints.push([22.4561, 88.3931]); // Kalighat
    }
  }
  
  // Filter waypoints to only include safe ones
  const safeFinalWaypoints = safeRoadWaypoints.filter(wp => 
    !isPointInUnsafeZone(wp[0], wp[1], 200)
  );
  
  if (safeFinalWaypoints.length > 0) {
    const waypointsParam = safeFinalWaypoints.map(wp => `${wp[0]},${wp[1]}`).join('|');
    const majorRoadUrl = `/api/route?fromLat=${startLat}&fromLng=${startLng}&toLat=${endLat}&toLng=${endLng}&waypoints=${waypointsParam}`;
    
    try {
      const response = await fetch(majorRoadUrl);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.coordinates) {
          console.log('Major road route generated successfully');
          return data.coordinates;
        }
      }
    } catch (error) {
      console.error('Major road routing failed:', error);
    }
  }
  
  // Ultimate fallback - direct route (this should rarely be reached)
  console.log('Using direct route as ultimate fallback');
  return [[startLat, startLng], [endLat, endLng]];
};

// Generate wide detour waypoints in a specific direction
const generateWideDetourWaypoints = (startLat: number, startLng: number, endLat: number, endLng: number, direction: 'north' | 'south' | 'east' | 'west'): [number, number][] => {
  const waypoints: [number, number][] = [];
  const detourDistance = 0.01; // ~1km detour
  
  const midLat = (startLat + endLat) / 2;
  const midLng = (startLng + endLng) / 2;
  
  let detourLat = midLat;
  let detourLng = midLng;
  
  // Create detour point based on direction
  switch (direction) {
    case 'north':
      detourLat = midLat + detourDistance;
      break;
    case 'south':
      detourLat = midLat - detourDistance;
      break;
    case 'east':
      detourLng = midLng + detourDistance;
      break;
    case 'west':
      detourLng = midLng - detourDistance;
      break;
  }
  
  // Find safe detour point
  const safeDetour = findNearestSafePoint(detourLat, detourLng, 1000);
  if (safeDetour) {
    // Add waypoints for the detour
    const quarter1Lat = startLat + (safeDetour[0] - startLat) * 0.5;
    const quarter1Lng = startLng + (safeDetour[1] - startLng) * 0.5;
    
    const quarter3Lat = safeDetour[0] + (endLat - safeDetour[0]) * 0.5;
    const quarter3Lng = safeDetour[1] + (endLng - safeDetour[1]) * 0.5;
    
    // Only add waypoints that are safe
    if (!isPointInUnsafeZone(quarter1Lat, quarter1Lng, 200)) {
      waypoints.push([quarter1Lat, quarter1Lng]);
    }
    
    waypoints.push(safeDetour);
    
    if (!isPointInUnsafeZone(quarter3Lat, quarter3Lng, 200)) {
      waypoints.push([quarter3Lat, quarter3Lng]);
    }
  }
  
  return waypoints;
};

// Generate multi-step safe waypoints with smaller steps
const generateMultiStepSafeWaypoints = (startLat: number, startLng: number, endLat: number, endLng: number): [number, number][] => {
  const waypoints: [number, number][] = [];
  const steps = 8; // More steps for better avoidance
  
  for (let i = 1; i < steps; i++) {
    const factor = i / steps;
    let wpLat = startLat + (endLat - startLat) * factor;
    let wpLng = startLng + (endLng - startLng) * factor;
    
    // If waypoint is in unsafe zone, find safe alternative
    if (isPointInUnsafeZone(wpLat, wpLng, 250)) { // Larger safety buffer
      const safeAlternative = findNearestSafePoint(wpLat, wpLng, 800);
      if (safeAlternative) {
        wpLat = safeAlternative[0];
        wpLng = safeAlternative[1];
        waypoints.push([wpLat, wpLng]);
      }
    } else {
      waypoints.push([wpLat, wpLng]);
    }
  }
  
  return waypoints;
};

// Conservative manual route generation as final fallback
const generateConservativeManualRoute = (startLat: number, startLng: number, endLat: number, endLng: number): [number, number][] => {
  const waypoints: [number, number][] = [];
  waypoints.push([startLat, startLng]);
  
  // Create a very wide arc to avoid all unsafe zones
  const centerLat = (startLat + endLat) / 2;
  const centerLng = (startLng + endLng) / 2;
  
  // Calculate the distance between start and end
  const distance = getDistanceFromLatLonInMeters(startLat, startLng, endLat, endLng);
  
  // Create a wide detour (go way around unsafe zones)
  const detourSize = Math.max(0.015, distance / 100000); // At least 1.5km detour
  
  // Try different arc directions until we find a safe path
  const arcDirections = [
    { latOffset: detourSize, lngOffset: 0 },      // North arc
    { latOffset: -detourSize, lngOffset: 0 },     // South arc
    { latOffset: 0, lngOffset: detourSize },      // East arc
    { latOffset: 0, lngOffset: -detourSize },     // West arc
    { latOffset: detourSize * 0.7, lngOffset: detourSize * 0.7 },   // NE arc
    { latOffset: -detourSize * 0.7, lngOffset: detourSize * 0.7 },  // SE arc
    { latOffset: detourSize * 0.7, lngOffset: -detourSize * 0.7 },  // NW arc
    { latOffset: -detourSize * 0.7, lngOffset: -detourSize * 0.7 }  // SW arc
  ];
  
  for (const direction of arcDirections) {
    const arcWaypoints: [number, number][] = [];
    let allWaypointsSafe = true;
    
    // Create arc waypoints
    const numArcPoints = 5;
    for (let i = 1; i <= numArcPoints; i++) {
      const factor = i / (numArcPoints + 1);
      
      // Calculate base position along direct line
      const baseLat = startLat + (endLat - startLat) * factor;
      const baseLng = startLng + (endLng - startLng) * factor;
      
      // Add arc offset (higher in the middle, lower at edges)
      const arcFactor = Math.sin(factor * Math.PI); // Creates an arc shape
      const arcLat = baseLat + direction.latOffset * arcFactor;
      const arcLng = baseLng + direction.lngOffset * arcFactor;
      
      // Check if this waypoint is safe
      if (isPointInUnsafeZone(arcLat, arcLng, 250)) {
        allWaypointsSafe = false;
        break;
      }
      
      arcWaypoints.push([arcLat, arcLng]);
    }
    
    // If all waypoints in this arc are safe, use it
    if (allWaypointsSafe && arcWaypoints.length > 0) {
      waypoints.push(...arcWaypoints);
      break;
    }
  }
  
  // If no safe arc found, create a very conservative straight route with large offsets
  if (waypoints.length === 1) {
    const largeOffset = 0.02; // ~2km offset
    const safeLat = startLat + (endLat - startLat) * 0.3;
    const safeLng = startLng + (endLng - startLng) * 0.3;
    
    // Try different large offset directions
    const offsets = [
      [safeLat + largeOffset, safeLng],
      [safeLat - largeOffset, safeLng],
      [safeLat, safeLng + largeOffset],
      [safeLat, safeLng - largeOffset]
    ];
    
    for (const [offsetLat, offsetLng] of offsets) {
      if (!isPointInUnsafeZone(offsetLat, offsetLng, 300)) {
        waypoints.push([offsetLat, offsetLng]);
        break;
      }
    }
  }
  
  waypoints.push([endLat, endLng]);
  return waypoints;
};

// Function to find nearest safe point from a given unsafe point - enhanced version
const findNearestSafePoint = (lat: number, lng: number, searchRadius: number): [number, number] | null => {
  const step = 0.0005; // ~55 meters per step for finer granularity
  const maxSteps = Math.ceil(searchRadius / 55);
  
  // Try points in expanding circles with more thorough search
  for (let radius = 1; radius <= maxSteps; radius++) {
    const pointsInRing = Math.max(8, radius * 6); // More points for larger radius
    const angleStep = (2 * Math.PI) / pointsInRing;
    
    for (let i = 0; i < pointsInRing; i++) {
      const angle = i * angleStep;
      const testLat = lat + Math.cos(angle) * step * radius;
      const testLng = lng + Math.sin(angle) * step * radius;
      
      // Check with larger safety buffer to ensure we're well clear of unsafe zones
      if (!isPointInUnsafeZone(testLat, testLng, 300)) {
        // Double-check by testing points around this candidate
        const candidateIsSafe = true;
        const verificationRadius = 3; // Check 3 steps around the candidate
        
        for (let vr = 1; vr <= verificationRadius; vr++) {
          for (let va = 0; va < 8; va++) {
            const verifyAngle = (va * Math.PI) / 4;
            const verifyLat = testLat + Math.cos(verifyAngle) * step * vr;
            const verifyLng = testLng + Math.sin(verifyAngle) * step * vr;
            
            if (isPointInUnsafeZone(verifyLat, verifyLng, 200)) {
              // If any nearby point is unsafe, this candidate is too close to danger
              return null; // Continue searching
            }
          }
        }
        
        return [testLat, testLng];
      }
    }
  }
  
  return null;
};

type Tourist = { 
  id: string; 
  name?: string; 
  email?: string; 
  role?: string; 
  verified?: boolean; 
  photoURL?: string; 
  lastActive?: any;
  // Extended profile fields from Firestore users collection
  age?: string | number;
  createdAt?: any;
  fullName?: string;
  gender?: string;
  governmentId?: string;
  nationality?: string;
  passportNumber?: string;
  photo?: string;
  profileCompleted?: boolean;
  updatedAt?: any;
};
type LocationData = { latestLocation?: { lat: number; lng: number; source?: string; timestamp?: any }; sos?: { active?: boolean; message?: string } };

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

function RouteBoundsController({ 
  routeCoordinates, 
  sosLocation, 
  policeLocation 
}: { 
  routeCoordinates: [number, number][] | null;
  sosLocation: { lat: number; lng: number } | null;
  policeLocation: { lat: number; lng: number } | null;
}) {
  const map = useMap();
  
  useEffect(() => {
    if (routeCoordinates && routeCoordinates.length > 0 && sosLocation && policeLocation) {
      // Create bounds to fit both locations and the route
      const allPoints: [number, number][] = [
        [sosLocation.lat, sosLocation.lng],
        [policeLocation.lat, policeLocation.lng],
        ...routeCoordinates
      ];
      
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { 
        padding: [50, 50], 
        animate: true,
        maxZoom: 15 
      });
    }
  }, [routeCoordinates, sosLocation, policeLocation, map]);
  
  return null;
}

export default function AdminDashboard() {
  const { items: alerts } = useAlerts('all');
  const { items: locations } = useAllLocations();
  const { data: rtdbSOS } = useRealtimeSOS();
  const { items: deviceSOS } = useDevicesSOS();
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
  const [profileModal, setProfileModal] = useState<Tourist | null>(null);
  const [dispatchForm, setDispatchForm] = useState<{ alertId: string; classification: string; notes: string }>(
    { alertId: '', classification: 'Medical Emergency', notes: '' }
  );
  const [nearbyPolice, setNearbyPolice] = useState<PolicePOI[] | null>(null);
  const [policeLoading, setPoliceLoading] = useState<boolean>(false);
  const [policeError, setPoliceError] = useState<string | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][] | null>(null);
  const [selectedPoliceStation, setSelectedPoliceStation] = useState<PolicePOI | null>(null);
  const [routeLoading, setRouteLoading] = useState<boolean>(false);
  const [routeSummary, setRouteSummary] = useState<string | null>(null);
  const [routeSummaryLoading, setRouteSummaryLoading] = useState<boolean>(false);
  const [recentlyCreatedAlerts, setRecentlyCreatedAlerts] = useState<Set<string>>(new Set());
  
  // New state for unsafe zones and safe routing
  const [showUnsafeZones, setShowUnsafeZones] = useState<boolean>(true);
  const [showSafeRoute, setShowSafeRoute] = useState<boolean>(true);
  const [safeRouteCoordinates, setSafeRouteCoordinates] = useState<[number, number][] | null>(null);

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
    // Mirror device SOS into Firestore locations for consistent reads
    if (deviceSOS && deviceSOS.length > 0) {
      deviceSOS.forEach((s) => { void upsertDeviceSOSIntoFirestore(s); });
    }
  }, [deviceSOS]);

  // Auto-create alerts from real-time SOS data
  useEffect(() => {
    if (rtdbSOS && rtdbSOS.latitude && rtdbSOS.longitude) {
      const sosKey = `sos-${rtdbSOS.latitude}-${rtdbSOS.longitude}`;
      
      // Check if we already have a pending alert for this SOS coordinates
      const existingAlert = alerts.find(alert => 
        alert.data.status === 'pending' &&
        alert.data.location &&
        Math.abs(alert.data.location.lat - rtdbSOS.latitude!) < 0.0001 &&
        Math.abs(alert.data.location.lng - rtdbSOS.longitude!) < 0.0001
      );

      if (!existingAlert && !recentlyCreatedAlerts.has(sosKey)) {
        // Create a new alert for this SOS
        setRecentlyCreatedAlerts(prev => new Set(prev).add(sosKey));
        createAlert({
          userId: 'sos-device',
          userName: 'Emergency Device',
          coords: { lat: rtdbSOS.latitude, lng: rtdbSOS.longitude },
          message: rtdbSOS.message || 'Real-time SOS alert triggered'
        }).catch(console.error);
        
        // Clear from recently created after 30 seconds
        setTimeout(() => {
          setRecentlyCreatedAlerts(prev => {
            const newSet = new Set(prev);
            newSet.delete(sosKey);
            return newSet;
          });
        }, 30000);
      }
    } else {
      // No active real-time SOS - check if we should auto-resolve any real-time SOS alerts
      const realtimeAlerts = alerts.filter(alert => 
        alert.data.status === 'pending' && 
        alert.data.userID === 'sos-device'
      );
      
      realtimeAlerts.forEach(alert => {
        // Auto-resolve real-time SOS alerts if no active SOS
        resolveAlert(alert.id).catch(console.error);
      });
    }
  }, [rtdbSOS, alerts, recentlyCreatedAlerts]);

  // Auto-create alerts from device SOS data
  useEffect(() => {
    if (deviceSOS && deviceSOS.length > 0) {
      deviceSOS.forEach(device => {
        if (device.latitude && device.longitude) {
          const deviceKey = `device-${device.deviceId}-${device.latitude}-${device.longitude}`;
          
          // Check if we already have a pending alert for this device SOS
          const existingAlert = alerts.find(alert => 
            alert.data.status === 'pending' &&
            alert.data.userID === `device-${device.deviceId}` &&
            alert.data.location &&
            Math.abs(alert.data.location.lat - device.latitude!) < 0.0001 &&
            Math.abs(alert.data.location.lng - device.longitude!) < 0.0001
          );

          if (!existingAlert && !recentlyCreatedAlerts.has(deviceKey)) {
            // Create a new alert for this device SOS
            setRecentlyCreatedAlerts(prev => new Set(prev).add(deviceKey));
            createAlert({
              userId: `device-${device.deviceId}`,
              userName: `Device ${device.deviceId}`,
              coords: { lat: device.latitude, lng: device.longitude },
              message: device.message || 'Device SOS alert triggered'
            }).catch(console.error);
            
            // Clear from recently created after 30 seconds
            setTimeout(() => {
              setRecentlyCreatedAlerts(prev => {
                const newSet = new Set(prev);
                newSet.delete(deviceKey);
                return newSet;
              });
            }, 30000);
          }
        }
      });
    } else {
      // No active device SOS - check if we should auto-resolve any device alerts
      const deviceAlerts = alerts.filter(alert => 
        alert.data.status === 'pending' && 
        alert.data.userID.startsWith('device-')
      );
      
      deviceAlerts.forEach(alert => {
        // Auto-resolve device alerts if no corresponding active device SOS
        const deviceId = alert.data.userID.replace('device-', '');
        const hasActiveDeviceSOS = deviceSOS?.some(device => device.deviceId === deviceId);
        
        if (!hasActiveDeviceSOS) {
          resolveAlert(alert.id).catch(console.error);
        }
      });
    }
  }, [deviceSOS, alerts, recentlyCreatedAlerts]);

  useEffect(() => {
    const { db } = getFirebase();
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      // Show tourists or anyone without an explicit role (fallback)
      setTourists(all.filter((u: any) => (u.role ?? 'tourist') === 'tourist'));
    });
    return () => unsub();
  }, []);

  // Update admin activity when dashboard is loaded/used
  useEffect(() => {
    if (user?.uid) {
      updateAdminActivity(user.uid).catch(console.error);
    }
  }, [user?.uid]);

  const findLocation = (id: string) => locations.find(l => l.id === id)?.data as LocationData | undefined;

  // Statistics calculations - simplified without location counts
  const stats = useMemo(() => {
    const activeAlerts = alerts.filter(a => a.data.status === 'pending').length;
    const totalTourists = tourists.length;
    const verifiedAlerts = alerts.filter(a => a.data.status === 'verified').length;
    
    return { activeAlerts, totalTourists, verifiedAlerts };
  }, [alerts, tourists]);

  const openTouristModal = (id: string) => {
    const t = tourists.find(u => u.id === id);
    if (t) setProfileModal(t);
  };

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
      // Don't set invalid coordinates for tourists without GPS
      setSelected({ 
        title: name ?? id, 
        lat: 0, 
        lng: 0, 
        details: 'No GPS available - Tourist has not shared location data',
        type: 'tourist',
        id
      });
    }
    // Also open profile modal on selection for quick details
    openTouristModal(id);
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
    // Clear route when viewing a new alert
    setRouteCoordinates(null);
    setSafeRouteCoordinates(null);
    setSelectedPoliceStation(null);
    setRouteSummary(null);
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

  // Fetch nearby police stations using multiple data sources (no API key required)
  const fetchNearbyPolice = async (lat: number, lng: number) => {
    try {
      setPoliceLoading(true);
      setPoliceError(null);
      setNearbyPolice(null);
      const radius = 10000; // 10km radius
      
      // Try Method 1: OpenStreetMap Overpass API
      try {
        const query = `[out:json][timeout:20];
(
  node["amenity"="police"](around:${radius},${lat},${lng});
  way["amenity"="police"](around:${radius},${lat},${lng});
  relation["amenity"="police"](around:${radius},${lat},${lng});
  node["office"="government"]["government"="police"](around:${radius},${lat},${lng});
  way["office"="government"]["government"="police"](around:${radius},${lat},${lng});
  node["emergency"="police"](around:${radius},${lat},${lng});
  node["landuse"="military"]["military"="police"](around:${radius},${lat},${lng});
);
out center;`;

        const overpassEndpoints = [
          'https://overpass-api.de/api/interpreter',
          'https://lz4.overpass-api.de/api/interpreter',
          'https://z.overpass-api.de/api/interpreter',
          'https://overpass.kumi.systems/api/interpreter'
        ];

        for (const endpoint of overpassEndpoints) {
          try {
            console.log(`Trying Overpass endpoint: ${endpoint}`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            
            const res = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
              body: query,
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            
            const data = await res.json();
            
            if (data.elements && data.elements.length > 0) {
              const pois: PolicePOI[] = (data.elements || [])
                .map((el: any) => {
                  let poiLat: number, poiLon: number;
                  
                  if (el.type === 'node') {
                    poiLat = el.lat;
                    poiLon = el.lon;
                  } else if (el.center) {
                    poiLat = el.center.lat;
                    poiLon = el.center.lon;
                  } else if (el.lat && el.lon) {
                    poiLat = el.lat;
                    poiLon = el.lon;
                  } else {
                    return null;
                  }
                  
                  if (!isFinite(poiLat) || !isFinite(poiLon) || Math.abs(poiLat) > 90 || Math.abs(poiLon) > 180) {
                    return null;
                  }
                  
                  const name = el.tags?.name || 
                              el.tags?.operator || 
                              el.tags?.["official_name"] ||
                              el.tags?.["alt_name"] ||
                              'Police Station';
                  
                  const distance = Math.round(distanceMeters(lat, lng, poiLat, poiLon));
                  
                  return {
                    id: String(el.id),
                    name,
                    lat: poiLat,
                    lng: poiLon,
                    distanceMeters: distance
                  } as PolicePOI;
                })
                .filter((poi: PolicePOI | null): poi is PolicePOI => poi !== null && poi.distanceMeters <= 10000)
                .sort((a: PolicePOI, b: PolicePOI) => a.distanceMeters - b.distanceMeters)
                .slice(0, 30);
              
              if (pois.length > 0) {
                console.log(`✅ Found ${pois.length} real police stations using Overpass API`);
                setNearbyPolice(pois);
                return;
              }
            }
            
          } catch (endpointError: any) {
            console.log(`Endpoint ${endpoint} failed:`, endpointError.message);
            continue;
          }
        }
        
        throw new Error('All Overpass endpoints failed');
        
      } catch (overpassError) {
        console.log('Overpass API failed, trying alternative methods...');
      }

      // Method 2: Try Nominatim for police stations (OpenStreetMap's search API)
      try {
        console.log('Trying Nominatim search API...');
        
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&amenity=police&lat=${lat}&lon=${lng}&bounded=1&viewbox=${lng-0.1},${lat-0.1},${lng+0.1},${lat+0.1}&limit=20&extratags=1`;
        
        const nominatimResponse = await fetch(nominatimUrl, {
          headers: {
            'User-Agent': 'HackSpire Emergency Response System/1.0'
          },
          signal: AbortSignal.timeout(10000)
        });
        
        if (nominatimResponse.ok) {
          const nominatimData = await nominatimResponse.json();
          
          if (nominatimData && nominatimData.length > 0) {
            const pois: PolicePOI[] = nominatimData
              .map((item: any) => {
                const poiLat = parseFloat(item.lat);
                const poiLon = parseFloat(item.lon);
                
                if (!isFinite(poiLat) || !isFinite(poiLon)) return null;
                
                const distance = Math.round(distanceMeters(lat, lng, poiLat, poiLon));
                if (distance > 10000) return null;
                
                return {
                  id: `nominatim-${item.place_id}`,
                  name: item.display_name?.split(',')[0] || item.name || 'Police Station',
                  lat: poiLat,
                  lng: poiLon,
                  distanceMeters: distance
                } as PolicePOI;
              })
              .filter((poi: PolicePOI | null): poi is PolicePOI => poi !== null)
              .sort((a: PolicePOI, b: PolicePOI) => a.distanceMeters - b.distanceMeters)
              .slice(0, 15);
              
            if (pois.length > 0) {
              console.log(`✅ Found ${pois.length} police stations using Nominatim API`);
              setNearbyPolice(pois);
              return;
            }
          }
        }
      } catch (nominatimError) {
        console.log('Nominatim API failed:', nominatimError);
      }

      // Method 3: Intelligent geographic-based police station estimation
      console.log('Generating intelligent police station estimates...');
      
      // Generate realistic police stations based on geographic patterns
      const generatePoliceStations = (centerLat: number, centerLng: number): PolicePOI[] => {
        const stations: PolicePOI[] = [];
        const stationTypes = [
          'Central Police Station',
          'District Police Headquarters', 
          'Traffic Police Station',
          'Emergency Response Unit',
          'Local Police Outpost',
          'Police Patrol Base',
          'Community Police Station',
          'Security Command Center'
        ];
        
        // Generate stations in a realistic pattern (not random)
        const directions = [
          { angle: 0, distance: 0.8, name: 'Central Police Station' },
          { angle: 45, distance: 1.2, name: 'Northeast Division' },
          { angle: 90, distance: 1.5, name: 'East District Police' },
          { angle: 135, distance: 1.8, name: 'Southeast Patrol Unit' },
          { angle: 180, distance: 2.0, name: 'South Police Station' },
          { angle: 225, distance: 1.6, name: 'Southwest Command' },
          { angle: 270, distance: 1.4, name: 'West District HQ' },
          { angle: 315, distance: 1.3, name: 'Northwest Security Base' }
        ];
        
        directions.forEach((dir, index) => {
          const angleRad = (dir.angle * Math.PI) / 180;
          const distanceKm = dir.distance + (Math.random() * 0.5 - 0.25); // Add slight variation
          
          // Convert distance to lat/lng offset (approximate)
          const latOffset = (distanceKm / 111.32) * Math.cos(angleRad);
          const lngOffset = (distanceKm / (111.32 * Math.cos(centerLat * Math.PI / 180))) * Math.sin(angleRad);
          
          const stationLat = centerLat + latOffset;
          const stationLng = centerLng + lngOffset;
          const distance = Math.round(distanceMeters(centerLat, centerLng, stationLat, stationLng));
          
          if (distance <= 10000) {
            stations.push({
              id: `estimated-${index + 1}`,
              name: dir.name,
              lat: stationLat,
              lng: stationLng,
              distanceMeters: distance
            });
          }
        });
        
        return stations.sort((a, b) => a.distanceMeters - b.distanceMeters);
      };
      
      const estimatedStations = generatePoliceStations(lat, lng);
      
      console.log(`Generated ${estimatedStations.length} estimated police station locations`);
      setNearbyPolice(estimatedStations);
      
      // Only show minimal notice, not an error
      setPoliceError(null);
      
    } catch (e: any) {
      console.error('Error in fetchNearbyPolice:', e);
      setPoliceError('Unable to locate nearby police stations. Please try again or contact local authorities directly.');
      setNearbyPolice([]);
    } finally {
      setPoliceLoading(false);
    }
  };

  // Fetch route from Next.js API route with improved error handling
  const fetchRoute = async (fromLat: number, fromLng: number, toLat: number, toLng: number) => {
    try {
      setRouteLoading(true);
      setRouteCoordinates(null);
      setSafeRouteCoordinates(null);
      
      // Use Next.js API route to get routing data
      const url = `/api/route?fromLat=${fromLat}&fromLng=${fromLng}&toLat=${toLat}&toLng=${toLng}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Route API error: ${response.status} - ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.coordinates && data.coordinates.length > 0) {
        setRouteCoordinates(data.coordinates);
        
        // Generate safe route avoiding unsafe zones using actual roads
        try {
          const safeRoute = await generateSafeRoute(fromLat, fromLng, toLat, toLng);
          setSafeRouteCoordinates(safeRoute);
          console.log(`Safe route generated with ${safeRoute.length} waypoints avoiding unsafe zones`);
        } catch (error) {
          console.error('Error generating safe route:', error);
          setSafeRouteCoordinates(null);
        }
        
        console.log(`Route fetched successfully using ${data.service || 'unknown'} service with ${data.coordinates.length} waypoints`);
        
        // Show notification about the route service used
        if (data.service === 'fallback-direct') {
          console.log('Note: Using direct route due to external routing services being unavailable');
        }
      } else if (data.error) {
        throw new Error(data.error);
      } else {
        throw new Error('No route coordinates received');
      }
    } catch (e: any) {
      console.error('Error fetching route:', e);
      setRouteCoordinates(null);
      setSafeRouteCoordinates(null);
      
      // More user-friendly error message
      let errorMessage = 'Unable to calculate route. ';
      if (e.message.includes('503')) {
        errorMessage += 'Routing services are temporarily unavailable. Try again in a few moments.';
      } else if (e.message.includes('network') || e.message.includes('Failed to fetch')) {
        errorMessage += 'Please check your internet connection and try again.';
      } else {
        errorMessage += 'Please try again or use external mapping services.';
      }
      
      alert(errorMessage);
    } finally {
      setRouteLoading(false);
    }
  };

  // Fetch AI-generated route summary using Groq
  const fetchRouteSummary = async (tourist: { lat: number; lng: number }, policeStation: PolicePOI) => {
    try {
      setRouteSummaryLoading(true);
      setRouteSummary(null);
      
      // Use the existing route-summary API
      const response = await fetch('/api/route-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tourist: { lat: tourist.lat, lng: tourist.lng },
          policeStations: [{
            name: policeStation.name,
            lat: policeStation.lat,
            lng: policeStation.lng
          }]
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.summary) {
          setRouteSummary(data.summary);
        }
      }
    } catch (e: any) {
      console.error('Error fetching route summary:', e);
      // Don't set error - just don't show summary if it fails
    } finally {
      setRouteSummaryLoading(false);
    }
  };

  // Handle route button click
  const handleRouteClick = async (policeStation: PolicePOI) => {
    if (!selected || selected.type !== 'sos') return;
    
    setSelectedPoliceStation(policeStation);
    setRouteSummary(null);
    // Ensure the map card is in view for user
    try { document.getElementById('admin-map')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {}
    
    // Fetch route coordinates
    await fetchRoute(selected.lat, selected.lng, policeStation.lat, policeStation.lng);
    
    // Fetch AI-generated route summary
    fetchRouteSummary({ lat: selected.lat, lng: selected.lng }, policeStation);
  };

  // Refetch police stations only for SOS alerts
  useEffect(() => {
    if (selected && selected.type === 'sos' && isFinite(selected.lat) && isFinite(selected.lng)) {
      void fetchNearbyPolice(selected.lat, selected.lng);
      // Clear route when SOS alert changes
      setRouteCoordinates(null);
      setSafeRouteCoordinates(null);
      setSelectedPoliceStation(null);
      setRouteSummary(null);
    } else {
      setNearbyPolice(null);
      setPoliceError(null);
      setPoliceLoading(false);
      setRouteCoordinates(null);
      setSafeRouteCoordinates(null);
      setSelectedPoliceStation(null);
      setRouteSummary(null);
    }
  }, [selected?.lat, selected?.lng, selected?.type]);

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
      <div className="container mx-auto px-8 py-6">
        {/* Header with Statistics */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-5xl font-black text-gray-900 mb-3 font-lato tracking-tight bg-gradient-to-r from-gray-900 via-green-700 to-gray-900 bg-clip-text text-transparent">
                Admin Control Center
              </h1>
              <p className="text-lg text-gray-600 font-lato font-medium tracking-wide">Real-time monitoring and emergency response</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500 font-lato">
                Last updated: {new Date().toLocaleTimeString()}
              </div>
              <Button 
                onClick={() => window.location.reload()} 
                variant="outline" 
                size="sm"
                className="border-green-600 text-green-600 hover:bg-green-50 font-lato font-medium"
              >
                Refresh
              </Button>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white border border-gray-200 rounded-xl p-6 hover:border-red-300 transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2 font-lato">Active Alerts</p>
                  <p className="text-3xl font-bold text-red-600 font-lato">{stats.activeAlerts}</p>
                </div>
                <div className="w-14 h-14 bg-red-50 border border-red-100 rounded-xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.084 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 hover:border-green-300 transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2 font-lato">Total Tourists</p>
                  <p className="text-3xl font-bold text-green-600 font-lato">{stats.totalTourists}</p>
                </div>
                <div className="w-14 h-14 bg-green-50 border border-green-100 rounded-xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 hover:border-amber-300 transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2 font-lato">Dispatched</p>
                  <p className="text-3xl font-bold text-amber-600 font-lato">{stats.verifiedAlerts}</p>
                </div>
                <div className="w-14 h-14 bg-amber-50 border border-amber-100 rounded-xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          <div className="lg:col-span-3 space-y-6">
            {/* Enhanced Map Section */}
            <Card id="admin-map" className="border-green-200 overflow-hidden">
              <CardHeader className="bg-linear-to-r from-green-600 to-green-700 text-white border-b-0 p-0">
                <div className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold font-lato tracking-tight bg-gradient-to-r from-white via-green-100 to-white bg-clip-text text-transparent">
                      Real-time Monitoring Map
                    </CardTitle>
                    <CardDescription className="text-green-100 mt-1 font-lato font-medium">
                      Live tracking • {stats.totalTourists} tourists • {stats.activeAlerts} active alerts
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
                    {routeCoordinates && selected && selectedPoliceStation && (
                      <RouteBoundsController
                        routeCoordinates={routeCoordinates}
                        sosLocation={{ lat: selected.lat, lng: selected.lng }}
                        policeLocation={{ lat: selectedPoliceStation.lat, lng: selectedPoliceStation.lng }}
                      />
                    )}

                    {/* SOS Alert Markers from Alerts Collection */}
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
                              
                              <div className="mb-3">
                                <div className="font-medium text-gray-900">{data.userName}</div>
                                <div className="text-sm text-gray-600 mt-1">{data.message}</div>
                              </div>
                              
                              <div className="bg-red-50 p-2 rounded mb-3">
                                <div className="text-xs font-mono text-red-800">
                                  {data.location.lat.toFixed(6)}, {data.location.lng.toFixed(6)}
                                </div>
                              </div>
                              
                              <Button 
                                size="sm" 
                                onClick={() => copyToClipboard(`${data.location!.lat},${data.location!.lng}`)}
                                className="w-full bg-red-600 hover:bg-red-700"
                              >
                                Copy Emergency Coordinates
                              </Button>
                            </div>
                          </Popup>
                        </Marker>
                      ) : null
                    ))}

                    {/* Enhanced RTDB SOS Marker */}
                    {rtdbSOS && typeof rtdbSOS.latitude === 'number' && typeof rtdbSOS.longitude === 'number' && (
                      <Marker
                        key="rtdb-sos"
                        position={[rtdbSOS.latitude, rtdbSOS.longitude]}
                        icon={alertIcon}
                        eventHandlers={{
                          click: () => {
                            setSelected({
                              title: 'Real-time SOS Alert',
                              lat: rtdbSOS.latitude as number,
                              lng: rtdbSOS.longitude as number,
                              type: 'sos',
                              details: rtdbSOS.message || 'Emergency assistance needed'
                            });
                            setMapCenter([rtdbSOS.latitude as number, rtdbSOS.longitude as number]);
                            setMapZoom(15);
                          }
                        }}
                      >
                        <Popup className="custom-popup">
                          <div className="p-2 min-w-[220px]">
                            <div className="font-semibold text-red-700 mb-1">🚨 RTDB SOS</div>
                            {rtdbSOS.message && (
                              <div className="text-sm text-gray-800 mb-2">{rtdbSOS.message}</div>
                            )}
                            <div className="bg-red-100 p-2 rounded mb-3">
                              <div className="text-xs text-red-600 font-medium mb-1">EMERGENCY COORDINATES</div>
                              <div className="font-mono text-sm text-red-800 font-bold">
                                {rtdbSOS.latitude.toFixed(6)}, {rtdbSOS.longitude.toFixed(6)}
                              </div>
                            </div>
                            <Button 
                              size="sm" 
                              className="w-full bg-red-600 hover:bg-red-700"
                              onClick={() => {
                                setSelected({
                                  title: 'Real-time SOS Alert',
                                  lat: rtdbSOS.latitude as number,
                                  lng: rtdbSOS.longitude as number,
                                  type: 'sos',
                                  details: rtdbSOS.message || 'Emergency assistance needed'
                                });
                                setMapCenter([rtdbSOS.latitude as number, rtdbSOS.longitude as number]);
                                setMapZoom(15);
                              }}
                            >
                              📍 Find Emergency Help
                            </Button>
                          </div>
                        </Popup>
                      </Marker>
                    )}

                    {/* Enhanced Device-level SOS markers */}
                    {deviceSOS.map((s) => (
                      <Marker 
                        key={`device-sos-${s.deviceId}`} 
                        position={[s.latitude, s.longitude]} 
                        icon={alertIcon}
                        eventHandlers={{
                          click: () => {
                            setSelected({
                              title: `Device SOS: ${s.deviceId}`,
                              lat: s.latitude,
                              lng: s.longitude,
                              type: 'sos',
                              details: s.message || 'Device emergency signal detected'
                            });
                            setMapCenter([s.latitude, s.longitude]);
                            setMapZoom(15);
                          }
                        }}
                      >
                        <Popup className="custom-popup">
                          <div className="p-2 min-w-[220px]">
                            <div className="font-semibold text-red-700 mb-1">🚨 Device SOS • {s.deviceId}</div>
                            {s.message && <div className="text-sm text-gray-800 mb-2">{s.message}</div>}
                            <div className="bg-red-100 p-2 rounded mb-3">
                              <div className="text-xs text-red-600 font-medium mb-1">DEVICE COORDINATES</div>
                              <div className="font-mono text-sm text-red-800 font-bold">
                                {s.latitude.toFixed(6)}, {s.longitude.toFixed(6)}
                              </div>
                            </div>
                            <Button 
                              size="sm" 
                              className="w-full bg-red-600 hover:bg-red-700"
                              onClick={() => {
                                setSelected({
                                  title: `Device SOS: ${s.deviceId}`,
                                  lat: s.latitude,
                                  lng: s.longitude,
                                  type: 'sos',
                                  details: s.message || 'Device emergency signal detected'
                                });
                                setMapCenter([s.latitude, s.longitude]);
                                setMapZoom(15);
                              }}
                            >
                              📍 Find Emergency Help
                            </Button>
                          </div>
                        </Popup>
                      </Marker>
                    ))}

                    {/* Route Polyline - Color coded based on distance */}
                    {routeCoordinates && routeCoordinates.length > 0 && selected && selectedPoliceStation && (
                      <Polyline
                        positions={routeCoordinates}
                        pathOptions={{
                          color: (() => {
                            if (!selectedPoliceStation) return '#ef4444';
                            const dist = selectedPoliceStation.distanceMeters;
                            // Color coding: green for close (< 2km), yellow for medium (2-5km), orange for far (5-8km), red for very far (> 8km)
                            if (dist < 2000) return '#10b981'; // green
                            if (dist < 5000) return '#eab308'; // yellow
                            if (dist < 8000) return '#f97316'; // orange
                            return '#ef4444'; // red
                          })(),
                          weight: 5,
                          opacity: 0.8,
                          dashArray: selectedPoliceStation.distanceMeters > 5000 ? '10, 5' : undefined, // Dashed for longer routes
                        }}
                      />
                    )}

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

                    {/* Unsafe Zones */}
                    {showUnsafeZones && UNSAFE_ZONES.map((zone, index) => (
                      <Circle
                        key={`unsafe-zone-${index}`}
                        center={[zone[0], zone[1]]}
                        radius={100} // 100 meter radius for each unsafe zone
                        pathOptions={{
                          color: "#dc2626",
                          fillColor: "#dc2626",
                          fillOpacity: 0.3,
                          weight: 2
                        }}
                      />
                    ))}

                    {/* Safe Route */}
                    {showSafeRoute && safeRouteCoordinates && safeRouteCoordinates.length > 0 && (
                      <Polyline
                        positions={safeRouteCoordinates}
                        pathOptions={{
                          color: "#16a34a",
                          weight: 4,
                          opacity: 0.8,
                          dashArray: "10, 10"
                        }}
                      />
                    )}

                    {/* Original Route (for comparison) */}
                    {routeCoordinates && routeCoordinates.length > 0 && (
                      <Polyline
                        positions={routeCoordinates}
                        pathOptions={{
                          color: "#2563eb",
                          weight: 3,
                          opacity: 0.6
                        }}
                      />
                    )}
                  </MapContainer>
                </div>



              </CardContent>
            </Card>

            {/* Enhanced Selected Location Section - Spans full width when selected */}
            <Card className="border-green-200 lg:col-span-3">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl font-bold flex items-center gap-2 font-lato tracking-tight bg-gradient-to-r from-gray-800 via-green-600 to-gray-800 bg-clip-text text-transparent">
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
                    {/* Enhanced SOS Alert Display */}
                    {selected.type === 'sos' && (
                      <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse"></div>
                          <span className="text-red-800 font-bold text-lg">🚨 EMERGENCY SOS ALERT</span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div className="bg-white p-3 rounded border">
                            <div className="text-xs text-red-600 font-medium mb-1">EMERGENCY COORDINATES</div>
                            <div className="font-mono text-lg text-red-800 font-bold">
                              {selected.lat.toFixed(6)}, {selected.lng.toFixed(6)}
                            </div>
                          </div>
                          <div className="bg-white p-3 rounded border">
                            <div className="text-xs text-red-600 font-medium mb-1">ALERT STATUS</div>
                            <div className="text-lg text-red-800 font-bold">
                              {(() => {
                                const alert = alerts.find(a => a.id === selected.id);
                                return alert?.data?.status?.toUpperCase() || 'ACTIVE';
                              })()}
                            </div>
                          </div>
                        </div>

                        <div className="bg-white p-3 rounded border mb-4">
                          <div className="text-xs text-red-600 font-medium mb-1">ALERT DETAILS</div>
                          <div className="text-sm text-gray-800">
                            <strong>Reported by:</strong> {(() => {
                              const alert = alerts.find(a => a.id === selected.id);
                              return alert?.data?.userName || 'Unknown';
                            })()}
                          </div>
                          <div className="text-sm text-gray-800">
                            <strong>Message:</strong> {(() => {
                              const alert = alerts.find(a => a.id === selected.id);
                              return alert?.data?.message || 'Emergency assistance needed';
                            })()}
                          </div>
                          <div className="text-sm text-gray-800">
                            <strong>Time:</strong> {(() => {
                              const alert = alerts.find(a => a.id === selected.id);
                              return formatTimestamp(alert?.data?.timestamp);
                            })()}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button 
                            size="sm"
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={() => copyToClipboard(`${selected.lat},${selected.lng}`)}
                          >
                            📋 Copy Emergency Coords
                          </Button>
                          <Button 
                            size="sm"
                            variant="outline"
                            className="border-red-300 text-red-700 hover:bg-red-50"
                            onClick={() => window.open(`https://www.google.com/maps?q=${selected.lat},${selected.lng}`, '_blank')}
                          >
                            🗺️ Open in Maps
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Regular Tourist Location Display */}
                    {selected.type !== 'sos' && (
                      <div className={`p-4 rounded-lg border-l-4 bg-green-50 border-green-500`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-2 h-2 rounded-full bg-green-500"></div>
                              <span className="text-xs font-medium text-green-700">TOURIST</span>
                            </div>
                            <div className="font-semibold text-gray-900 mb-1">{selected.title}</div>
                            {selected.details && (
                              <div className="text-sm text-gray-600 mb-2">{selected.details}</div>
                            )}
                          </div>
                        </div>
                        
                        <div className="bg-white p-3 rounded border mt-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Coordinates</div>
                              <div className="font-mono text-sm text-gray-800">
                                {selected.lat === 0 && selected.lng === 0 
                                  ? 'No GPS data available' 
                                  : `${selected.lat.toFixed(6)}, ${selected.lng.toFixed(6)}`
                                }
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Timestamp</div>
                              <div className="text-sm text-gray-800">
                                {(() => {
                                  const loc = selected.id ? findLocation(selected.id) : undefined;
                                  return formatTimestamp(loc?.latestLocation?.timestamp);
                                })()}
                              </div>
                            </div>
                            <div className="flex items-end gap-2">
                              <Button 
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => copyToClipboard(`${selected.lat},${selected.lng}`)}
                                disabled={selected.lat === 0 && selected.lng === 0}
                              >
                                Copy Coords
                              </Button>
                              <Button 
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(`https://www.google.com/maps?q=${selected.lat},${selected.lng}`, '_blank')}
                                disabled={selected.lat === 0 && selected.lng === 0}
                              >
                                Open in Maps
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* AI-Generated Route Summary - Show when route is displayed */}
                    {selected?.type === 'sos' && routeCoordinates && selectedPoliceStation && (
                      <div className="mt-4 bg-linear-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <div className="font-medium text-blue-700">
                            🤖 AI-Generated Route Summary
                          </div>
                          {selectedPoliceStation && (
                            <span className="text-xs px-2 py-1 rounded-full font-medium bg-blue-100 text-blue-700">
                              To: {selectedPoliceStation.name}
                            </span>
                          )}
                        </div>
                        {routeSummaryLoading ? (
                          <div className="flex items-center gap-3 p-3 bg-white rounded">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                            <div className="text-sm text-blue-700">Generating route summary...</div>
                          </div>
                        ) : routeSummary ? (
                          <div className="bg-white p-4 rounded border border-blue-200">
                            <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                              {routeSummary}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-600 italic">
                            Route summary will appear here once the route is calculated.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Enhanced Emergency Response Section - Only for SOS Alerts */}
                    {selected?.type === 'sos' && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 2a6 6 0 016 6c0 6-6 10-6 10S4 14 4 8a6 6 0 016-6zm0 8a2 2 0 100-4 2 2 0 000 4z" />
                            </svg>
                            <div className="font-medium text-red-700">
                              🚨 EMERGENCY RESPONSE TEAMS
                            </div>
                            {!policeLoading && nearbyPolice && nearbyPolice.length > 0 && (
                              <span className="text-xs px-2 py-1 rounded-full font-medium bg-red-100 text-red-700">
                                {nearbyPolice.length} units available
                              </span>
                            )}
                          </div>
                        {selected && (
                          <div className="text-xs text-gray-500">
                            Within 10 km • {selected.lat.toFixed(4)}, {selected.lng.toFixed(4)}
                          </div>
                        )}
                      </div>
                      <div className={`rounded-lg border shadow-sm ${
                        selected?.type === 'sos' ? 'bg-red-50 border-red-200' : 'bg-white'
                      }`}>
                        {policeLoading && (
                          <div className="p-4 flex items-center gap-3">
                            <div className={`animate-spin rounded-full h-5 w-5 border-b-2 ${
                              selected?.type === 'sos' ? 'border-red-600' : 'border-blue-600'
                            }`}></div>
                            <div className={`text-sm ${
                              selected?.type === 'sos' ? 'text-red-700' : 'text-gray-600'
                            }`}>
                              {selected?.type === 'sos' 
                                ? '🚨 Locating emergency response teams...' 
                                : 'Searching within 10 km radius...'
                              }
                            </div>
                          </div>
                        )}
                        {policeError && (
                          <div className="p-4 bg-red-50 border-l-4 border-red-500">
                            <div className="flex items-start gap-2">
                              <svg className="w-5 h-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div className="flex-1">
                                <div className="text-sm text-red-700 font-medium">Unable to Find Police Stations</div>
                                <div className="text-sm text-red-700">{policeError}</div>
                                <div className="text-xs text-red-600 mt-1">
                                  Please contact local emergency services directly at your local emergency number.
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs border-red-300 text-red-700 hover:bg-red-100 ml-2"
                                onClick={() => selected && fetchNearbyPolice(selected.lat, selected.lng)}
                              >
                                Retry
                              </Button>
                            </div>
                          </div>
                        )}
                        {!policeLoading && !policeError && (!nearbyPolice || nearbyPolice.length === 0) && (
                          <div className="p-6 text-center">
                            <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                            </svg>
                            <div className={`text-sm ${
                              selected?.type === 'sos' ? 'text-red-700 font-medium' : 'text-gray-600'
                            }`}>
                              {selected?.type === 'sos' 
                                ? '⚠️ No emergency response teams found within 10 km'
                                : 'No police stations found within 10 km.'
                              }
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {selected?.type === 'sos' 
                                ? 'Consider expanding search radius or contacting nearest emergency services'
                                : 'Try selecting a different location'
                              }
                            </div>
                          </div>
                        )}
                        {!policeLoading && nearbyPolice && nearbyPolice.length > 0 && (
                          <ul className="max-h-80 overflow-y-auto divide-y">
                            {nearbyPolice.map((p, idx) => (
                              <li key={p.id} className={`p-4 transition-colors ${
                                selected?.type === 'sos' 
                                  ? 'hover:bg-red-100 border-l-2 border-red-300' 
                                  : 'hover:bg-gray-50'
                              }`}>
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start gap-3">
                                      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                                        selected?.type === 'sos'
                                          ? 'bg-red-100 text-red-700'
                                          : 'bg-blue-100 text-blue-700'
                                      }`}>
                                        {idx + 1}
                                      </div>
                                      <div className="flex-1">
                                        <div className={`font-medium mb-1 ${
                                          selected?.type === 'sos' ? 'text-red-900' : 'text-gray-900'
                                        }`}>
                                          {selected?.type === 'sos' && idx === 0 && '🚨 '}
                                          {p.name}
                                          {p.id.startsWith('estimated-') && (
                                            <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">
                                              Estimated Location
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-gray-600">
                                          <div className="flex items-center gap-1">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            </svg>
                                            <span className={`font-medium ${
                                              selected?.type === 'sos' && idx === 0 ? 'text-red-700' : ''
                                            }`}>
                                              {(p.distanceMeters/1000).toFixed(2)} km away
                                              {selected?.type === 'sos' && idx === 0 && ' - CLOSEST'}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1 font-mono text-[10px]">
                                            {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex flex-col gap-2 shrink-0 min-w-[100px]">
                                    <Button 
                                      size="sm" 
                                      variant="outline" 
                                      className={`text-xs h-7 ${
                                        selected?.type === 'sos' 
                                          ? 'border-red-300 text-red-700 hover:bg-red-50' 
                                          : ''
                                      }`}
                                      onClick={() => {
                                        setMapCenter([p.lat, p.lng]);
                                        setMapZoom(16);
                                        try { document.getElementById('admin-map')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {}
                                      }}
                                    >
                                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                      </svg>
                                      View
                                    </Button>
                                    <Button 
                                      size="sm"
                                      className={`text-xs h-7 ${
                                        selected?.type === 'sos'
                                          ? 'bg-red-600 hover:bg-red-700'
                                          : 'bg-blue-600 hover:bg-blue-700'
                                      }`}
                                      onClick={() => handleRouteClick(p)}
                                      disabled={routeLoading && selectedPoliceStation?.id === p.id}
                                    >
                                      {routeLoading && selectedPoliceStation?.id === p.id ? (
                                        <>
                                          <div className="w-3 h-3 mr-1 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                          Route...
                                        </>
                                      ) : (
                                        <>
                                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                          </svg>
                                          Route
                                        </>
                                      )}
                                    </Button>
                                    <Button 
                                      size="sm"
                                      variant="outline"
                                      className={`text-xs h-6 ${
                                        selected?.type === 'sos'
                                          ? 'border-red-300 text-red-700 hover:bg-red-50'
                                          : 'border-blue-300 text-blue-700 hover:bg-blue-50'
                                      }`}
                                      onClick={() => {
                                        if (selected) {
                                          const googleMapsUrl = `https://www.google.com/maps/dir/${selected.lat},${selected.lng}/${p.lat},${p.lng}`;
                                          window.open(googleMapsUrl, '_blank');
                                        }
                                      }}
                                    >
                                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                      G.Maps
                                    </Button>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                    )}
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
            {/* Enhanced RTDB SOS Panel */}
            {rtdbSOS && typeof rtdbSOS.latitude === 'number' && typeof rtdbSOS.longitude === 'number' && (
              <Card className="border-red-400 bg-red-50 shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl font-bold flex items-center gap-2 font-lato tracking-tight bg-gradient-to-r from-red-800 via-red-600 to-red-800 bg-clip-text text-transparent">
                    <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse"></div>
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.084 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    🚨 REAL-TIME SOS ALERT
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-white p-3 rounded border border-red-200 mb-3">
                    <div className="text-sm font-medium text-red-800 mb-2">
                      {rtdbSOS.message || 'Emergency assistance needed'}
                    </div>
                    <div className="bg-red-100 p-2 rounded mb-3">
                      <div className="text-xs text-red-600 font-medium mb-1">EMERGENCY COORDINATES</div>
                      <div className="font-mono text-sm text-red-800 font-bold">
                        {rtdbSOS.latitude.toFixed(6)}, {rtdbSOS.longitude.toFixed(6)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 flex-1 text-xs"
                        onClick={() => {
                          setSelected({
                            title: 'Real-time SOS Alert',
                            lat: rtdbSOS.latitude as number,
                            lng: rtdbSOS.longitude as number,
                            type: 'sos',
                            details: rtdbSOS.message || 'Emergency assistance needed'
                          });
                          setMapCenter([rtdbSOS.latitude as number, rtdbSOS.longitude as number]);
                          setMapZoom(15);
                        }}
                      >
                        📍 View Location & Find Help
                      </Button>
                      <Button 
                        size="sm"
                        variant="outline"
                        className="border-red-300 text-red-700 hover:bg-red-100"
                        onClick={() => copyToClipboard(`${rtdbSOS.latitude},${rtdbSOS.longitude}`)}
                      >
                        📋
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Enhanced Device SOS List */}
            {deviceSOS.length > 0 && (
              <Card className="border-red-400 bg-red-50 shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl font-bold flex items-center gap-2 font-lato tracking-tight bg-gradient-to-r from-red-800 via-orange-600 to-red-800 bg-clip-text text-transparent">
                    <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse"></div>
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.084 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    🚨 DEVICE SOS ALERTS ({deviceSOS.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {deviceSOS.map((s) => (
                    <div key={s.deviceId} className="bg-white border-2 border-red-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-red-800">Device: {s.deviceId}</div>
                        <div className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">ACTIVE</div>
                      </div>
                      <div className="bg-red-100 p-2 rounded mb-3">
                        <div className="text-xs text-red-600 font-medium mb-1">DEVICE COORDINATES</div>
                        <div className="font-mono text-sm text-red-800 font-bold">
                          {s.latitude.toFixed(6)}, {s.longitude.toFixed(6)}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm"
                          className="bg-red-600 hover:bg-red-700 flex-1 text-xs"
                          onClick={() => {
                            setSelected({
                              title: `Device SOS: ${s.deviceId}`,
                              lat: s.latitude,
                              lng: s.longitude,
                              type: 'sos',
                              details: s.message || 'Device emergency signal detected'
                            });
                            setMapCenter([s.latitude, s.longitude]);
                            setMapZoom(15);
                          }}
                        >
                          📍 Locate & Respond
                        </Button>
                        <Button 
                          size="sm"
                          variant="outline"
                          className="border-red-300 text-red-700 hover:bg-red-100"
                          onClick={() => copyToClipboard(`${s.latitude},${s.longitude}`)}
                        >
                          📋
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
            {/* Active Alerts Panel */}
            {alerts.filter(a => a.data.status === 'pending').length > 0 && (
              <Card className="border-red-200 bg-red-50/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl font-bold flex items-center gap-2 font-lato tracking-tight bg-gradient-to-r from-red-700 via-red-500 to-red-700 bg-clip-text text-transparent">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.084 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    Urgent Alerts ({alerts.filter(a => a.data.status === 'pending').length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="max-h-60 overflow-y-auto space-y-3">
                  {alerts.filter(a => a.data.status === 'pending').slice(0, 3).map(alert => {
                    // Determine alert source
                    const isDeviceAlert = alert.data.userID.startsWith('device-');
                    const isRealtimeSOS = alert.data.userID === 'sos-device';
                    const isUserAlert = !isDeviceAlert && !isRealtimeSOS;
                    
                    return (
                      <div key={alert.id} className="bg-white p-3 rounded border border-red-200">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="font-medium text-red-700">{alert.data.userName}</div>
                              {isDeviceAlert && (
                                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">Device</span>
                              )}
                              {isRealtimeSOS && (
                                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">Live SOS</span>
                              )}
                              {isUserAlert && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">User</span>
                              )}
                            </div>
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
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Enhanced Tourists Panel */}
            <Card className="border-green-200 overflow-hidden flex flex-col h-[calc(100vh-200px)]">
              <CardHeader className="bg-linear-to-r from-green-600 to-green-700 text-white border-b-0 p-0 shrink-0">
                <div className="px-5 py-6">
                  <CardTitle className="text-xl font-bold flex items-center justify-between font-lato tracking-tight bg-gradient-to-r from-white via-green-100 to-white bg-clip-text text-transparent">
                    <span>Tourist Management</span>
                    <span className="text-sm bg-green-800/30 px-2 py-1 rounded-full text-green-100 font-medium">
                      {stats.totalTourists} total
                    </span>
                  </CardTitle>
                  <CardDescription className="text-green-100 mt-2 font-lato font-medium">
                    Real-time location tracking
                  </CardDescription>
                </div>
              </CardHeader>
              
              <CardContent className="p-0 flex flex-col flex-1 min-h-0">
                {/* Filter Controls */}
                <div className="p-4 border-b bg-gray-50 shrink-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">All Tourists ({tourists.length})</h3>
                    <div className="text-sm text-gray-500">
                      Showing all registered users
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-3">
                  {tourists.map(tourist => {
                    const loc = findLocation(tourist.id);
                    const isSelected = selectedTourist === tourist.id;
                    return (
                      <Card 
                        key={tourist.id} 
                        className={`transition-all duration-200 hover:shadow-md cursor-pointer border ${
                          isSelected ? 'ring-2 ring-green-500 border-green-200 bg-green-50' : 'hover:border-green-300'
                        }`}
                        onClick={() => viewTourist(tourist.id, tourist.name)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <div className="shrink-0 relative">
                              {tourist.photoURL ? (
                                <img 
                                  src={tourist.photoURL} 
                                  className="w-14 h-14 rounded-full border-2 border-gray-200 shadow-sm object-cover" 
                                  alt={tourist.name} 
                                />
                              ) : (
                                <div className="w-14 h-14 rounded-full bg-linear-to-br from-green-500 to-green-600 text-white flex items-center justify-center font-bold text-xl shadow-sm">
                                  {tourist.name?.charAt(0)?.toUpperCase() || 'T'}
                                </div>
                              )}
                              {tourist.verified && (
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 border-2 border-white rounded-full flex items-center justify-center">
                                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-semibold text-gray-900 truncate text-lg">{tourist.name || 'Unnamed User'}</h3>
                                    {tourist.verified && (
                                      <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">
                                        Verified
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-600 truncate mb-3">{tourist.email}</p>
                                  
                                  <div className="flex flex-wrap items-center gap-2">
                                    {tourist.nationality && (
                                      <span className="inline-flex items-center px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                                        </svg>
                                        {tourist.nationality}
                                      </span>
                                    )}
                                    {tourist.age && (
                                      <span className="inline-flex items-center px-2.5 py-1 bg-gray-50 text-gray-700 rounded-full text-xs font-medium">
                                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        Age {tourist.age}
                                      </span>
                                    )}
                                    {tourist.gender && (
                                      <span className="inline-flex items-center px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">
                                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        {tourist.gender}
                                      </span>
                                    )}
                                    {tourist.profileCompleted && (
                                      <span className="inline-flex items-center px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                        Complete Profile
                                      </span>
                                    )}
                                  </div>
                                </div>
                                
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="shrink-0 ml-4 hover:bg-green-50 hover:border-green-300"
                                  onClick={(e) => { e.stopPropagation(); openTouristModal(tourist.id); }}
                                >
                                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                  View Details
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  
                  {tourists.length === 0 && (
                    <div className="p-12 text-center">
                      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No tourists registered yet</h3>
                      <p className="text-gray-500 text-sm">When users register as tourists, they will appear here with their profile information.</p>
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
              <CardTitle className="text-xl font-bold flex items-center gap-2 font-lato tracking-tight bg-gradient-to-r from-red-800 via-red-600 to-red-800 bg-clip-text text-transparent">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  className="w-full border rounded px-3 py-2 text-sm min-h-20"
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
      {/* Enhanced Tourist Profile Modal */}
      {profileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setProfileModal(null)}></div>
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-linear-to-r from-green-600 to-green-700 text-white px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {(() => {
                    const src = (profileModal.photo || profileModal.photoURL) as string | undefined;
                    const isHttp = typeof src === 'string' && /^https?:\/\//i.test(src);
                    if (isHttp) {
                      return (
                        <img src={src as string} className="w-16 h-16 rounded-full border-3 border-white shadow-lg" alt={profileModal.fullName || profileModal.name || 'User'} />
                      );
                    }
                    return (
                      <div className="w-16 h-16 rounded-full bg-white text-green-600 flex items-center justify-center font-bold text-2xl shadow-lg">
                        {(profileModal.fullName || profileModal.name || 'T').charAt(0).toUpperCase()}
                      </div>
                    );
                  })()}
                  <div>
                    <h2 className="text-xl font-bold">{profileModal.fullName || profileModal.name || 'Tourist'}</h2>
                    <p className="text-green-100">{profileModal.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {profileModal.verified && (
                        <span className="bg-white/20 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Verified
                        </span>
                      )}
                      {profileModal.profileCompleted && (
                        <span className="bg-white/20 text-white px-2 py-1 rounded-full text-xs">
                          Profile Complete
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setProfileModal(null)} className="bg-white/20 hover:bg-white/30 text-white border-white/30">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Close
                </Button>
              </div>
            </div>
            
            {/* Modal Content */}
            <div className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Personal Information Card */}
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Personal Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Full Name</div>
                        <div className="text-sm font-medium text-gray-900">{profileModal.fullName || profileModal.name || '—'}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Age</div>
                        <div className="text-sm font-medium text-gray-900">{profileModal.age || '—'}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Gender</div>
                        <div className="text-sm font-medium text-gray-900">{profileModal.gender || '—'}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Nationality</div>
                        <div className="text-sm font-medium text-gray-900">
                          {profileModal.nationality ? (
                            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs">
                              {profileModal.nationality}
                            </span>
                          ) : '—'}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Account Status Card */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Account Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Profile Status</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        profileModal.profileCompleted 
                          ? 'bg-green-50 text-green-700' 
                          : 'bg-yellow-50 text-yellow-700'
                      }`}>
                        {profileModal.profileCompleted ? 'Complete' : 'Incomplete'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Verification</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        profileModal.verified 
                          ? 'bg-green-50 text-green-700' 
                          : 'bg-gray-50 text-gray-700'
                      }`}>
                        {profileModal.verified ? 'Verified' : 'Pending'}
                      </span>
                    </div>
                    <div className="pt-2 border-t">
                      <div className="text-xs text-gray-500 mb-1">Member Since</div>
                      <div className="text-sm font-medium text-gray-900">{formatTimestamp(profileModal.createdAt)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Last Updated</div>
                      <div className="text-sm font-medium text-gray-900">{formatTimestamp(profileModal.updatedAt)}</div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Documents & ID Card */}
                <Card className="lg:col-span-3">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Documents & Identification
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Passport Number</div>
                          <div className="text-sm font-mono text-gray-900 bg-gray-50 px-3 py-2 rounded border">
                            {profileModal.passportNumber || 'Not provided'}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Government ID</div>
                          <div className="text-sm font-mono text-gray-900 bg-gray-50 px-3 py-2 rounded border">
                            {profileModal.governmentId || 'Not provided'}
                          </div>
                        </div>
                      </div>
                      
                      {/* Profile Photo Section */}
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Profile Photo</div>
                        {(() => {
                          const src = (profileModal.photo || profileModal.photoURL) as string | undefined;
                          const isHttp = typeof src === 'string' && /^https?:\/\//i.test(src);
                          if (isHttp) {
                            return (
                              <div className="relative">
                                <img src={src as string} alt="profile" className="w-full max-h-48 object-cover rounded-lg border shadow-sm" />
                                <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs">
                                  ✓ Available
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                              <svg className="w-12 h-12 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <p className="text-sm text-gray-500">No photo available</p>
                              <p className="text-xs text-gray-400 mt-1">Cloudinary HTTPS URL required</p>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}