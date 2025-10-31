"use client";
import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebase as getClients } from '@/lib/firebase';
import { getFirebase } from '@/lib/firebase';

export type DeviceSOS = { deviceId: string; latitude: number; longitude: number; message?: string };

export function useDevicesSOS() {
  const { rtdb } = getFirebase();
  const [items, setItems] = useState<DeviceSOS[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const r = ref(rtdb, 'devices');
    const off = onValue(r, (snap) => {
      const next: DeviceSOS[] = [];
      snap.forEach((child) => {
        const id = child.key as string;
        const sos = child.child('SOS').val();
        if (sos && typeof sos.latitude === 'number' && typeof sos.longitude === 'number') {
          next.push({ deviceId: id, latitude: sos.latitude, longitude: sos.longitude, message: sos.message });
        }
      });
      setItems(next);
      setLoading(false);
    });
    return () => off();
  }, [rtdb]);

  return { items, loading };
}

// Optional: helper to mirror device SOS into Firestore locations collection
export async function upsertDeviceSOSIntoFirestore(sos: DeviceSOS): Promise<void> {
  const { db } = getClients();
  const ref = doc(db, 'locations', sos.deviceId);
  await setDoc(ref, {
    latestLocation: {
      lat: sos.latitude,
      lng: sos.longitude,
      source: 'esp32',
      timestamp: serverTimestamp(),
    },
    sos: {
      active: true,
      message: sos.message ?? '',
      updatedAt: serverTimestamp(),
    },
  }, { merge: true });
}


