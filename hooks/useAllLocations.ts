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
    const unsub = onSnapshot(collection(db, 'locations'), (snap) => {
      const next: Array<{ id: string; data: LocationDoc }> = [];
      snap.forEach((d) => next.push({ id: d.id, data: d.data() as LocationDoc }));
      setItems(next);
      setLoading(false);
    });
    return () => unsub();
  }, [db]);

  return useMemo(() => ({ items, loading }), [items, loading]);
}


