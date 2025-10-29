"use client";
import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { observeAuthState } from '@/lib/auth';

export function useFirebaseUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = observeAuthState((u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { user, loading };
}


