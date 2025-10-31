import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const upstream = process.env.NEXT_PUBLIC_ROUTE_SUMMARY_URL || 'http://localhost:4010/summary';
		const url = normalize(upstream, req);

		// Try upstream container first
		try {
			const res = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
				// Don't cache, and set a short timeout via AbortController
				next: { revalidate: 0 },
				signal: AbortSignal.timeout ? AbortSignal.timeout(3500) : undefined
			} as any);
			if (res.ok) {
				const data = await res.json();
				return json(200, data);
			}
		} catch {}

		// Fallback: generate directly using Groq
		const { tourist, policeStations } = body || {};
		if (!tourist || typeof tourist.lat !== 'number' || typeof tourist.lng !== 'number') {
			return json(400, { error: 'Invalid tourist coordinates' });
		}
		if (!Array.isArray(policeStations) || policeStations.length === 0) {
			return json(400, { error: 'policeStations[] required' });
		}

		const nearest = getNearest(tourist, policeStations);
		if (!nearest) return json(400, { error: 'No valid police station coordinates' });

		const bearing = bearingDegrees(tourist, nearest);
		const cardinal = cardinalFromBearing(bearing);
		const distanceKm = (haversineMeters(tourist, nearest) / 1000).toFixed(2);

		// Support multiple env var names to reduce setup friction
		const apiKey =
			process.env.GROQ_API_KEY ||
			process.env.NEXT_PUBLIC_GROQ_API_KEY;
		if (!apiKey) return json(500, { error: 'GROQ_API_KEY not configured' });
		const prompt = `You are a safety assistant. Provide a concise, calm route summary from a tourist to the nearest police station based on straight-line distance and bearing. Include distance, general direction, and clear suggestions (major roads/landmarks optional if generic). Do not invent exact street-by-street steps.

Tourist location: lat ${tourist.lat}, lng ${tourist.lng}
Nearest station: ${nearest.name ?? 'Unknown station'}, lat ${nearest.lat}, lng ${nearest.lng}
Straight-line distance: ${distanceKm} km
Bearing: ${Math.round(bearing)}° (${cardinal})

Output 3-5 bullet points, max 80 words total.`;

		const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				model: 'llama-3.1-8b-instant',
				messages: [
					{ role: 'user', content: prompt }
				],
				max_tokens: 300,
				temperature: 0.4
			})
		});
		if (!groqRes.ok) return json(500, { error: `Groq error ${groqRes.status}` });
		const groqJson: any = await groqRes.json();
		const text = String(groqJson?.choices?.[0]?.message?.content || '');

		return json(200, {
			nearest: {
				name: nearest.name || null,
				lat: nearest.lat,
				lng: nearest.lng,
				distanceMeters: Math.round(haversineMeters(tourist, nearest)),
				bearingDegrees: Math.round(bearing),
				cardinal,
			},
			summary: text,
		});
	} catch (e: any) {
		return json(500, { error: e?.message || 'Proxy error' });
	}
}

function json(status: number, data: any) {
	return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function normalize(raw: string, req: NextRequest): string {
	if (raw.startsWith(':')) return `http://localhost${raw}`;
	if (raw.startsWith('/')) return `${req.nextUrl.origin}${raw}`;
	if (!/^https?:\/\//i.test(raw)) return `http://${raw}`;
	return raw;
}

function toRad(deg: number) { return (deg * Math.PI) / 180; }
function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
	const R = 6371000;
	const dLat = toRad(b.lat - a.lat);
	const dLng = toRad(b.lng - a.lng);
	const lat1 = toRad(a.lat);
	const lat2 = toRad(b.lat);
	const sinDLat = Math.sin(dLat / 2);
	const sinDLng = Math.sin(dLng / 2);
	const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
	return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
function bearingDegrees(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
	const lat1 = toRad(a.lat);
	const lat2 = toRad(b.lat);
	const dLng = toRad(b.lng - a.lng);
	const y = Math.sin(dLng) * Math.cos(lat2);
	const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
	const brng = Math.atan2(y, x) * (180 / Math.PI);
	return (brng + 360) % 360;
}
function cardinalFromBearing(b: number) {
	const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
	return dirs[Math.round(b / 45) % 8];
}
function getNearest(tourist: { lat: number; lng: number }, list: any[]) {
	let nearest: any = null;
	for (const s of list) {
		const lat = Number(s?.lat), lng = Number(s?.lng);
		if (!isFinite(lat) || !isFinite(lng)) continue;
		const d = haversineMeters(tourist, { lat, lng });
		if (!nearest || d < nearest.distanceMeters) nearest = { ...s, distanceMeters: d };
	}
	return nearest && { name: nearest.name, lat: Number(nearest.lat), lng: Number(nearest.lng) };
}

