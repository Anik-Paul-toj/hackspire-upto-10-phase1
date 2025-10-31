import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
// Using Groq OpenAI-compatible API via fetch

// Load env from local service .env or fall back to repo root .env.local
dotenv.config();
if (!process.env.GROQ_API_KEY) {
	const rootEnv = path.resolve(process.cwd(), '..', '..', '.env.local');
	dotenv.config({ path: rootEnv });
}

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT ? Number(process.env.PORT) : 4010;

function toRad(deg) {
	return (deg * Math.PI) / 180;
}

function haversineMeters(a, b) {
	const R = 6371000; // meters
	const dLat = toRad(b.lat - a.lat);
	const dLng = toRad(b.lng - a.lng);
	const lat1 = toRad(a.lat);
	const lat2 = toRad(b.lat);
	const sinDLat = Math.sin(dLat / 2);
	const sinDLng = Math.sin(dLng / 2);
	const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
	return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function bearingDegrees(a, b) {
	const lat1 = toRad(a.lat);
	const lat2 = toRad(b.lat);
	const dLng = toRad(b.lng - a.lng);
	const y = Math.sin(dLng) * Math.cos(lat2);
	const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
	const brng = Math.atan2(y, x) * (180 / Math.PI);
	return (brng + 360) % 360;
}

function cardinalFromBearing(b) {
	const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
	return dirs[Math.round(b / 45) % 8];
}

app.get('/health', (_req, res) => {
	res.json({ ok: true });
});

app.post('/summary', async (req, res) => {
	try {
		const apiKey = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY;
		if (!apiKey) {
			return res.status(500).json({ error: 'GROQ_API_KEY not configured' });
		}

		const { tourist, policeStations } = req.body || {};
		if (!tourist || typeof tourist.lat !== 'number' || typeof tourist.lng !== 'number') {
			return res.status(400).json({ error: 'Invalid tourist coordinates' });
		}
		if (!Array.isArray(policeStations) || policeStations.length === 0) {
			return res.status(400).json({ error: 'policeStations[] required' });
		}

		let nearest = null;
		for (const station of policeStations) {
			if (typeof station?.lat !== 'number' || typeof station?.lng !== 'number') continue;
			const d = haversineMeters(tourist, station);
			if (!nearest || d < nearest.distanceMeters) {
				nearest = { ...station, distanceMeters: d };
			}
		}

		if (!nearest) {
			return res.status(400).json({ error: 'No valid police station coordinates' });
		}

		const bearing = bearingDegrees(tourist, nearest);
		const cardinal = cardinalFromBearing(bearing);
		const distanceKm = (nearest.distanceMeters / 1000).toFixed(2);

		// Call Groq's OpenAI-compatible chat completions API
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
		if (!groqRes.ok) {
			return res.status(500).json({ error: `Groq error ${groqRes.status}` });
		}
		const groqJson = await groqRes.json();
		const text = String(groqJson?.choices?.[0]?.message?.content || '');

		return res.json({
			nearest: {
				name: nearest.name || null,
				lat: nearest.lat,
				lng: nearest.lng,
				distanceMeters: Math.round(nearest.distanceMeters),
				bearingDegrees: Math.round(bearing),
				cardinal,
			},
			summary: text,
		});
	} catch (err) {
		console.error('Error in /summary', err);
		res.status(500).json({ error: 'Internal server error' });
	}
});

app.listen(PORT, () => {
	console.log(`Route summary service listening on http://localhost:${PORT}`);
});
