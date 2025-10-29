"use client";
import { useEffect, useRef, useState } from 'react';
import { useFirebaseUser } from '@/hooks/useFirebaseUser';
import { writeLatestLocation } from '@/lib/locations';

export type LocationSyncState = {
  enabled: boolean; // has geolocation
  permission: 'granted' | 'prompt' | 'denied' | 'unknown';
  error?: string;
};

export function useLocationSync(intervalMs: number = 15000, maxHistory: number = 20) {
  const { user } = useFirebaseUser();
  const timerRef = useRef<number | null>(null);
  const lastWriteRef = useRef<string | null>(null);
  const [state, setState] = useState<LocationSyncState>({ enabled: typeof window !== 'undefined' && 'geolocation' in navigator, permission: 'unknown' });

  useEffect(() => {
    if (!user) return;
    if (!('geolocation' in navigator)) {
      setState({ enabled: false, permission: 'unknown', error: 'Geolocation not supported' });
      return;
    }

    const writeFromPosition = (pos: GeolocationPosition) => {
      const { latitude, longitude } = pos.coords;
      const key = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
      if (lastWriteRef.current === key) return; // de-dupe same reading
      lastWriteRef.current = key;
      void writeLatestLocation({
        userId: user.uid,
        coords: { lat: latitude, lng: longitude },
        source: 'mobile',
        maxHistory,
      });
    };

    // initial snapshot
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState((s) => ({ ...s, permission: 'granted', error: undefined }));
        writeFromPosition(pos);
      },
      (err) => {
        const code = err.code === 1 ? 'denied' : 'prompt';
        setState({ enabled: true, permission: code as any, error: err.message });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );

    // interval updates
    timerRef.current = window.setInterval(() => {
      navigator.geolocation.getCurrentPosition(writeFromPosition, () => {}, { enableHighAccuracy: true, timeout: 10000 });
    }, intervalMs) as unknown as number;

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [user, intervalMs, maxHistory]);

  return state;
}


