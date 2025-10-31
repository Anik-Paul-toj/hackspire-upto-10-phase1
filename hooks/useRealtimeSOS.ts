"use client";
import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { getFirebase } from '@/lib/firebase';

type SOSData = { latitude?: number; longitude?: number; message?: string } | null;

export function useRealtimeSOS() {
  const { rtdb } = getFirebase();
  const [data, setData] = useState<SOSData>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Back-compat: read root SOS first
    const rRoot = ref(rtdb, 'SOS');
    const offRoot = onValue(rRoot, (snap) => {
      const val = snap.val();
      if (val) {
        setData(val ?? null);
        setLoading(false);
      }
    });

    // Also listen under /devices/*/SOS; use the first found as primary
    const rDevices = ref(rtdb, 'devices');
    const offDevices = onValue(rDevices, (snap) => {
      let found: SOSData = null;
      snap.forEach((child) => {
        const sos = child.child('SOS').val();
        if (!found && sos && typeof sos.latitude === 'number' && typeof sos.longitude === 'number') {
          found = sos as SOSData;
        }
      });
      if (found) {
        setData(found);
        setLoading(false);
      }
    });

    return () => { offRoot(); offDevices(); };
  }, [rtdb]);

  return { data, loading };
}


