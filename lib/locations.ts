import { ref, get, set, update, serverTimestamp } from 'firebase/database';
import { getFirebase } from './firebase';

export type GeoPointLite = { lat: number; lng: number };

export async function writeLatestLocation(options: {
  userId: string;
  coords: GeoPointLite;
  source: 'mobile' | 'esp32';
  timestamp?: Date;
  maxHistory?: number; // keep last N entries (including latest)
}): Promise<void> {
  const { rtdb } = getFirebase();
  const docRef = ref(rtdb, `locations/${options.userId}`);
  const entry = {
    lat: options.coords.lat,
    lng: options.coords.lng,
    timestamp: serverTimestamp(),
    source: options.source,
  };

  const maxHistory = options.maxHistory ?? 20;
  try {
    const snap = await get(docRef);
    if (!snap.exists()) {
      await set(docRef, { latestLocation: entry, history: [] });
      return;
    }
    const data = (snap.val() as { history?: Array<{ lat: number; lng: number; timestamp: unknown; source: string }> }) || {};
    const newHistory = Array.isArray(data.history) ? data.history.slice(-Math.max(0, maxHistory - 1)) : [];
    newHistory.push({ lat: options.coords.lat, lng: options.coords.lng, timestamp: Date.now(), source: options.source });
    await update(docRef, { latestLocation: entry, history: newHistory });
  } catch (err) {
    await update(docRef, { latestLocation: entry });
  }
}


