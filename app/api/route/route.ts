import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const fromLat = searchParams.get('fromLat');
    const fromLng = searchParams.get('fromLng');
    const toLat = searchParams.get('toLat');
    const toLng = searchParams.get('toLng');
    const waypoints = searchParams.get('waypoints'); // New parameter for waypoints

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
      // Build coordinates string for OSRM
      let coordinatesStr = `${fromLngNum},${fromLatNum}`;
      
      // Add waypoints if provided
      if (waypoints) {
        const waypointCoords = waypoints.split('|').map(wp => {
          const [lat, lng] = wp.split(',').map(Number);
          return `${lng},${lat}`; // OSRM expects lng,lat format
        });
        coordinatesStr += ';' + waypointCoords.join(';');
      }
      
      coordinatesStr += `;${toLngNum},${toLatNum}`;
      
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordinatesStr}?overview=full&geometries=geojson&alternatives=false`;
      
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
    
    // Parse waypoints if provided
    const waypointsList: [number, number][] = [];
    if (waypoints) {
      waypoints.split('|').forEach(wp => {
        const [lat, lng] = wp.split(',').map(Number);
        if (isFinite(lat) && isFinite(lng)) {
          waypointsList.push([lat, lng]);
        }
      });
    }
    
    // Build full route with waypoints
    const allPoints: [number, number][] = [
      [fromLatNum, fromLngNum],
      ...waypointsList,
      [toLatNum, toLngNum]
    ];
    
    const coordinates: [number, number][] = [];
    let totalDistance = 0;
    
    // Generate route segments between each pair of points
    for (let i = 0; i < allPoints.length - 1; i++) {
      const [startLat, startLng] = allPoints[i];
      const [endLat, endLng] = allPoints[i + 1];
      
      // Calculate distance for this segment
      const lat1Rad = (startLat * Math.PI) / 180;
      const lat2Rad = (endLat * Math.PI) / 180;
      const deltaLat = lat2Rad - lat1Rad;
      const deltaLon = ((endLng - startLng) * Math.PI) / 180;
      
      const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) + 
                Math.cos(lat1Rad) * Math.cos(lat2Rad) * 
                Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const segmentDistance = 6371000 * c; // Earth's radius in meters
      totalDistance += segmentDistance;
      
      // Calculate bearing for this segment
      const y = Math.sin(deltaLon) * Math.cos(lat2Rad);
      const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLon);
      const bearing = (Math.atan2(y, x) * 180) / Math.PI;
      
      // Create intermediate points for this segment
      const segmentWaypoints = Math.max(2, Math.min(5, Math.floor(segmentDistance / 1000))); // 1 waypoint per km
      
      for (let j = 0; j < segmentWaypoints; j++) {
        const fraction = j / segmentWaypoints;
        const lat = startLat + (endLat - startLat) * fraction;
        const lng = startLng + (endLng - startLng) * fraction;
        
        // Add slight curve for realism (roads are rarely perfectly straight)
        const curveFactor = Math.sin(fraction * Math.PI) * 0.0005; // Small curve
        const adjustedLat = lat + curveFactor * Math.cos(bearing * Math.PI / 180);
        const adjustedLng = lng + curveFactor * Math.sin(bearing * Math.PI / 180);
        
        coordinates.push([adjustedLat, adjustedLng]);
      }
    }
    
    // Add final destination
    coordinates.push([toLatNum, toLngNum]);

    return NextResponse.json({
      success: true,
      coordinates,
      distance: Math.round(totalDistance),
      duration: Math.round(totalDistance / 13.89), // Assume ~50 km/h average speed
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
