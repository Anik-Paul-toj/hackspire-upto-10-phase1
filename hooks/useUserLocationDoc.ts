"use client";
import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { getFirebase } from '@/lib/firebase';
import type { User } from 'firebase/auth';

export function useUserLocationDoc(user: User | null) {
  const { rtdb } = getFirebase();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!user) {
      setData(null);
      setLoading(false);
      return;
    }
    const r = ref(rtdb, `locations/${user.uid}`);
    const off = onValue(r, (snap) => {
      setData(snap.exists() ? snap.val() : null);
      setLoading(false);
    });
    return () => off();
  }, [rtdb, user]);

  return { data, loading };
}


