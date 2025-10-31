"use client";
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import type { AdminWithId } from '@/types/admin';

export function useAdmins() {
  const [admins, setAdmins] = useState<AdminWithId[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { db } = getFirebase();
    
    const q = query(
      collection(db, 'admin'),
      where('isActive', '==', true),
      orderBy('lastActive', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const adminsList: AdminWithId[] = [];
      snapshot.forEach((doc) => {
        adminsList.push({
          id: doc.id,
          ...doc.data()
        } as AdminWithId);
      });
      setAdmins(adminsList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { admins, loading };
}