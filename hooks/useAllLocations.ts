"use client";
import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';

type LocationDoc = {
  latestLocation?: { lat: number; lng: number; timestamp?: unknown; source?: string };
};

export function useAllLocations() {
  const { db } = getFirebase();
  const [items, setItems] = useState<Array<{ id: string; data: LocationDoc }>>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const off = onSnapshot(collection(db, 'locations'), (snap) => {
      const next: Array<{ id: string; data: LocationDoc }>[] = [] as any;
      const acc: Array<{ id: string; data: LocationDoc }> = [];
      snap.forEach((d) => acc.push({ id: d.id, data: d.data() as LocationDoc }));
      setItems(acc);
      setLoading(false);
    });
    return () => off();
  }, [db]);

  return useMemo(() => ({ items, loading }), [items, loading]);
}


