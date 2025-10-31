import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const fromLat = searchParams.get('fromLat');
    const fromLng = searchParams.get('fromLng');
    const toLat = searchParams.get('toLat');
    const toLng = searchParams.get('toLng');

    if (!fromLat || !fromLng || !toLat || !toLng) {
      return NextResponse.json(
        { error: 'Missing required parameters: fromLat, fromLng, toLat, toLng' },
        { status: 400 }
      );
    }

    // Validate coordinates
    const fromLatNum = parseFloat(fromLat);
    const fromLngNum = parseFloat(fromLng);
    const toLatNum = parseFloat(toLat);
    const toLngNum = parseFloat(toLng);

    if (
      !isFinite(fromLatNum) || !isFinite(fromLngNum) ||
      !isFinite(toLatNum) || !isFinite(toLngNum) ||
      Math.abs(fromLatNum) > 90 || Math.abs(fromLngNum) > 180 ||
      Math.abs(toLatNum) > 90 || Math.abs(toLngNum) > 180
    ) {
      return NextResponse.json(
        { error: 'Invalid coordinates' },
        { status: 400 }
      );
    }

    // Try OSRM first (fast and free) - Fixed URL and improved error handling
    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${fromLngNum},${fromLatNum};${toLngNum},${toLatNum}?overview=full&geometries=geojson&alternatives=false`;
      
      const osrmResponse = await fetch(osrmUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'HackSpire Emergency Response System/1.0',
        },
        signal: AbortSignal.timeout(12000), // Increased timeout
      });

      if (osrmResponse.ok) {
        const osrmData = await osrmResponse.json();
        
        if (osrmData.code === 'Ok' && osrmData.routes && osrmData.routes.length > 0 && osrmData.routes[0].geometry) {
          // Extract coordinates from GeoJSON format [lng, lat] and convert to [lat, lng]
          const coordinates = osrmData.routes[0].geometry.coordinates.map(
            (coord: number[]) => [coord[1], coord[0]] as [number, number]
          );

          return NextResponse.json({
            success: true,
            coordinates,
            distance: osrmData.routes[0].distance,
            duration: osrmData.routes[0].duration,
            service: 'osrm',
          });
        }
      }
    } catch (osrmError) {
      console.log('OSRM failed, trying alternative services...', osrmError);
    }

    // Fallback: Simple direct route with waypoints (when external APIs fail)
    console.log('External routing services unavailable, generating direct route...');
    
    // Calculate bearing for a more realistic path
    const lat1Rad = (fromLatNum * Math.PI) / 180;
    const lat2Rad = (toLatNum * Math.PI) / 180;
    const deltaLon = ((toLngNum - fromLngNum) * Math.PI) / 180;
    
    const y = Math.sin(deltaLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLon);
    const bearing = (Math.atan2(y, x) * 180) / Math.PI;
    
    // Calculate distance using Haversine formula
    const R = 6371000; // Earth's radius in meters
    const dLat = lat2Rad - lat1Rad;
    const dLon = deltaLon;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + 
              Math.cos(lat1Rad) * Math.cos(lat2Rad) * 
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    // Create intermediate waypoints for a more realistic route
    const numWaypoints = Math.max(3, Math.min(10, Math.floor(distance / 1000))); // 1 waypoint per km, min 3, max 10
    const coordinates: [number, number][] = [];
    
    for (let i = 0; i <= numWaypoints; i++) {
      const fraction = i / numWaypoints;
      const lat = fromLatNum + (toLatNum - fromLatNum) * fraction;
      const lng = fromLngNum + (toLngNum - fromLngNum) * fraction;
      
      // Add slight curve for realism (roads are rarely perfectly straight)
      const curveFactor = Math.sin(fraction * Math.PI) * 0.001; // Small curve
      const adjustedLat = lat + curveFactor * Math.cos(bearing * Math.PI / 180);
      const adjustedLng = lng + curveFactor * Math.sin(bearing * Math.PI / 180);
      
      coordinates.push([adjustedLat, adjustedLng]);
    }

    return NextResponse.json({
      success: true,
      coordinates,
      distance: Math.round(distance),
      duration: Math.round(distance / 13.89), // Assume ~50 km/h average speed
      service: 'fallback-direct',
      note: 'Direct route generated - external routing services unavailable'
    });


  } catch (e: any) {
    console.error('Error in route API:', e);
    return NextResponse.json(
      { error: e?.message || 'Failed to fetch route from routing services' },
      { status: 500 }
    );
  }
}
