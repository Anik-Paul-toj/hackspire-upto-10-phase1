# Route Summary Service

A standalone Express service that summarizes the route from a tourist location to the nearest police station using Google Gemini.

## API

POST /summary

Body:
```json
{
  "tourist": { "lat": 12.34, "lng": 56.78 },
  "policeStations": [
    { "name": "Station A", "lat": 12.4, "lng": 56.9 },
    { "name": "Station B", "lat": 12.5, "lng": 56.7 }
  ]
}
```

Returns:
```json
{
  "nearest": {
    "name": "Station A",
    "lat": 12.4,
    "lng": 56.9,
    "distanceMeters": 1234,
    "bearingDegrees": 78,
    "cardinal": "E"
  },
  "summary": "..."
}
```

## Environment

- Place your key in `.env.local` at the repository root:
  - `GEMINI_API_KEY=...`

The service loads local `.env` first and falls back to `../../.env.local` to avoid changing the main app.

## Run locally

```
cd services/route-summary
npm install
npm start
```
Service runs on http://localhost:4010

## Docker

```
cd services/route-summary
docker build -t route-summary-service .
docker run --rm -p 4010:4010 -e GEMINI_API_KEY=$Env:GEMINI_API_KEY route-summary-service
```

This container is independent and does not alter the existing Next.js workflow.
