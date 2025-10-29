"use client";
import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import type { AlertDoc } from '@/lib/alerts';

export function useAlerts(status: 'all' | 'pending' | 'verified' | 'resolved' = 'all') {
  const { db } = getFirebase();
  const [items, setItems] = useState<Array<{ id: string; data: AlertDoc }>>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const base = collection(db, 'alerts');
    // Temporary: avoid composite index while it's building by skipping orderBy for filtered queries
    const q = status === 'all'
      ? query(base, orderBy('timestamp', 'desc'))
      : query(base, where('status', '==', status));
    const unsub = onSnapshot(q, (snap) => {
      const next: Array<{ id: string; data: AlertDoc }> = [];
      snap.forEach((d) => next.push({ id: d.id, data: d.data() as AlertDoc }));
      setItems(next);
      setLoading(false);
    });
    return () => unsub();
  }, [db, status]);

  return useMemo(() => ({ items, loading }), [items, loading]);
}


