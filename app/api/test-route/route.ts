import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    // Test coordinates: New York to Boston (known working route)
    const testFromLat = 40.7128;
    const testFromLng = -74.0060;
    const testToLat = 42.3601;
    const testToLng = -71.0589;

    // Call our own route API for testing
    const testUrl = `${req.nextUrl.origin}/api/route?fromLat=${testFromLat}&fromLng=${testFromLng}&toLat=${testToLat}&toLng=${testToLng}`;
    
    const response = await fetch(testUrl);
    const data = await response.json();

    return NextResponse.json({
      status: response.ok ? 'success' : 'error',
      statusCode: response.status,
      testCoordinates: {
        from: `${testFromLat}, ${testFromLng} (New York)`,
        to: `${testToLat}, ${testToLng} (Boston)`
      },
      result: data,
      timestamp: new Date().toISOString()
    });

  } catch (e: any) {
    return NextResponse.json(
      { 
        status: 'error',
        error: e?.message || 'Test failed',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}