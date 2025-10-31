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

    // Try OSRM first (fast and free)
    try {
      const osrmUrl = `https://router.projectosrm.org/route/v1/driving/${fromLngNum},${fromLatNum};${toLngNum},${toLatNum}?overview=full&geometries=geojson&alternatives=false`;
      
      const osrmResponse = await fetch(osrmUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
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
      console.log('OSRM failed, trying GraphHopper...', osrmError);
    }

    // Fallback to GraphHopper API (also free, no key required for basic use)
    try {
      const graphhopperUrl = `https://graphhopper.com/api/1/route?point=${fromLatNum},${fromLngNum}&point=${toLatNum},${toLngNum}&profile=car&type=json&instructions=false&key=demo_key&calc_points=true&points_encoded=false`;
      
      const ghResponse = await fetch(graphhopperUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (ghResponse.ok) {
        const ghData = await ghResponse.json();
        
        if (ghData.paths && ghData.paths.length > 0 && ghData.paths[0].points && ghData.paths[0].points.coordinates) {
          // GraphHopper with points_encoded=false returns GeoJSON format [lng, lat]
          const coordinates = ghData.paths[0].points.coordinates.map(
            (coord: number[]) => [coord[1], coord[0]] as [number, number] // Convert [lng, lat] to [lat, lng]
          );

          return NextResponse.json({
            success: true,
            coordinates,
            distance: ghData.paths[0].distance,
            duration: ghData.paths[0].time / 1000, // Convert ms to seconds
            service: 'graphhopper',
          });
        }
      }
    } catch (ghError) {
      console.log('GraphHopper failed, trying OpenRouteService...', ghError);
    }

    // Last fallback: OpenRouteService (free tier with API key, but we can try public endpoint)
    try {
      // OpenRouteService format: /v2/directions/{profile}?api_key={api_key}&start={lon},{lat}&end={lon},{lat}
      const orsUrl = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=5b3ce3597851110001cf6248${encodeURIComponent('')}&start=${fromLngNum},${fromLatNum}&end=${toLngNum},${toLatNum}`;
      
      const orsResponse = await fetch(orsUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (orsResponse.ok) {
        const orsData = await orsResponse.json();
        
        if (orsData.features && orsData.features.length > 0 && orsData.features[0].geometry && orsData.features[0].geometry.coordinates) {
          // OpenRouteService returns GeoJSON coordinates as [lng, lat]
          const coordinates = orsData.features[0].geometry.coordinates.map(
            (coord: number[]) => [coord[1], coord[0]] as [number, number]
          );

          const props = orsData.features[0].properties;
          return NextResponse.json({
            success: true,
            coordinates,
            distance: props.segments?.[0]?.distance || null,
            duration: props.segments?.[0]?.duration || null,
            service: 'openrouteservice',
          });
        }
      }
    } catch (orsError) {
      console.log('All routing services failed', orsError);
    }

    // If all routing services fail, return error instead of straight line
    return NextResponse.json(
      { 
        error: 'Unable to calculate road-based route. All routing services unavailable.',
        fallback: true 
      },
      { status: 503 }
    );
  } catch (e: any) {
    console.error('Error in route API:', e);
    return NextResponse.json(
      { error: e?.message || 'Failed to fetch route from routing services' },
      { status: 500 }
    );
  }
}
