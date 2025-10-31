"use client";
import { useEffect, useMemo, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { getFirebase } from '@/lib/firebase';

type LocationDoc = {
  latestLocation?: { lat: number; lng: number; timestamp?: unknown; source?: string };
};

export function useAllLocations() {
  const { rtdb } = getFirebase();
  const [items, setItems] = useState<Array<{ id: string; data: LocationDoc }>>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const r = ref(rtdb, 'locations');
    const off = onValue(r, (snap) => {
      const next: Array<{ id: string; data: LocationDoc }> = [];
      snap.forEach((child) => {
        const val = child.val() as any;
        const data: LocationDoc = val && val.latestLocation ? { latestLocation: val.latestLocation } : val;
        next.push({ id: child.key as string, data });
      });
      setItems(next);
      setLoading(false);
    });
    return () => off();
  }, [rtdb]);

  return useMemo(() => ({ items, loading }), [items, loading]);
}


