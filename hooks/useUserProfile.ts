"use client";
import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import type { User } from 'firebase/auth';

export type UserProfile = {
  name: string;
  email: string;
  role: 'tourist' | 'admin';
  photoURL: string;
  blockchainID: string;
  qrCodeURL: string;
  verified: boolean;
  createdAt?: unknown;
  lastActive?: unknown;
};

export function useUserProfile(user: User | null) {
  const { db } = getFirebase();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const userId = user?.uid;

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const ref = doc(db, 'users', userId);
    const unsub = onSnapshot(ref, async (snap) => {
      if (!snap.exists()) {
        await setDoc(ref, {
          name: user?.displayName ?? '',
          email: user?.email ?? '',
          role: 'tourist',
          photoURL: user?.photoURL ?? '',
          blockchainID: '',
          qrCodeURL: '',
          verified: false,
          createdAt: serverTimestamp(),
          lastActive: serverTimestamp(),
        }, { merge: true });
        return;
      }
      setProfile(snap.data() as UserProfile);
      setLoading(false);
    });
    return () => unsub();
  }, [db, userId, user?.displayName, user?.email, user?.photoURL]);

  return useMemo(() => ({ profile, loading }), [profile, loading]);
}


