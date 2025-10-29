"use client";
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import type { User } from 'firebase/auth';

export function useUserLocationDoc(user: User | null) {
  const { db } = getFirebase();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!user) {
      setData(null);
      setLoading(false);
      return;
    }
    const ref = doc(db, 'locations', user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      setData(snap.exists() ? snap.data() : null);
      setLoading(false);
    });
    return () => unsub();
  }, [db, user]);

  return { data, loading };
}


