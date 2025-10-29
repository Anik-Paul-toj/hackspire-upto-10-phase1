import { doc, serverTimestamp, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { getFirebase } from './firebase';

export type GeoPointLite = { lat: number; lng: number };

export async function writeLatestLocation(options: {
  userId: string;
  coords: GeoPointLite;
  source: 'mobile' | 'esp32';
  timestamp?: Date;
  maxHistory?: number; // keep last N entries (including latest)
}): Promise<void> {
  const { db } = getFirebase();
  const ref = doc(db, 'locations', options.userId);
  const entry = {
    lat: options.coords.lat,
    lng: options.coords.lng,
    timestamp: serverTimestamp(),
    source: options.source,
  };

  const maxHistory = options.maxHistory ?? 20;
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { latestLocation: entry, history: [] }, { merge: false });
      return;
    }

    // Build bounded history by taking existing history tail and appending a client timestamped copy
    const data = snap.data() as { history?: Array<{ lat: number; lng: number; timestamp: unknown; source: string }> };
    const newHistory = Array.isArray(data.history) ? data.history.slice(-Math.max(0, maxHistory - 1)) : [];
    newHistory.push({ lat: entry.lat, lng: entry.lng, timestamp: new Date(), source: entry.source });

    await updateDoc(ref, { latestLocation: entry, history: newHistory });
  } catch (err) {
    // fallback simple set if read/update fails
    await setDoc(ref, { latestLocation: entry }, { merge: true });
  }
}


