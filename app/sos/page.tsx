"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { getFirebase } from '@/lib/firebase';

export default function SOSPage() {
  const [peerCount, setPeerCount] = useState<number>(0);
  const [alerts, setAlerts] = useState<any[]>([]);
  // Initialize to a neutral value to avoid SSR/CSR mismatch, then set on client
  const [status, setStatus] = useState<string>('loading');
  const [roomId, setRoomId] = useState<string>('sos_room');
  const [sending, setSending] = useState<boolean>(false);

  const mesh = useMemo(() => {
    if (typeof window === 'undefined') return null as any;
    const { WebRTCMesh, idb } = require('@/lib/webrtc');
    const instance = new WebRTCMesh({
      roomId,
      signalingUrl: 'ws://192.168.83.160:8080',
      onPeersChange: (n: number) => setPeerCount(n),
      onSOS: (alert: any) => {
        setAlerts((prev) => [alert, ...prev].slice(0, 50));
        idb.addPending(alert).catch(() => {});
      }
    });
    return instance;
  }, [roomId]);

  useEffect(() => {
    if (!mesh) return;
    mesh.connect();
    // Determine initial status on client only
    setStatus(navigator.onLine ? 'online' : 'offline');
    const handleOnline = () => setStatus('online');
    const handleOffline = () => setStatus('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [mesh]);

  async function sendSOS() {
    setSending(true);
    try {
      const alert = await buildSOS();
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        await saveToFirebase(alert);
      } else {
        const { idb } = require('@/lib/webrtc');
        mesh?.broadcastSOS(alert);
        await idb.addPending(alert);
        setAlerts((prev) => [alert, ...prev].slice(0, 50));
      }
    } finally {
      setSending(false);
    }
  }

  async function buildSOS() {
    let coords: { lat: number; lng: number } | null = null;
    try {
      coords = await new Promise<any>((resolve) => {
        if (!('geolocation' in navigator)) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 3000 }
        );
      });
    } catch {}
    const userId = 'anonymous';
    return { userId, location: coords, time: Date.now() };
  }

  async function saveToFirebase(alert: any) {
    const { db } = getFirebase();
    const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
    await addDoc(collection(db, 'sos_alerts'), {
      userId: alert.userId,
      location: alert.location,
      time: serverTimestamp(),
      payloadTime: alert.time,
    });
  }

  async function trySync() {
    if (!(typeof navigator !== 'undefined' && navigator.onLine)) return;
    const { idb } = require('@/lib/webrtc');
    const pending = await idb.getAllPending();
    if (!pending.length) return;
    for (const p of pending) {
      try { await saveToFirebase(p); } catch {}
    }
    await idb.clearPending();
  }

  useEffect(() => { if (status === 'online') { void trySync(); } }, [status]);

  return (
    <main className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-semibold">SOS Mesh</h1>
      <div className="flex items-center gap-3">
        <span className={`px-2 py-1 rounded text-white text-xs ${status === 'online' ? 'bg-green-600' : status === 'offline' ? 'bg-red-600' : 'bg-gray-400'}`}>
          {status === 'loading' ? '...' : status}
        </span>
        <span className="text-sm">Connected Peers: {peerCount}</span>
        <input className="ml-auto border px-2 py-1 rounded text-sm" value={roomId} onChange={(e) => setRoomId(e.target.value)} />
      </div>
      <button onClick={sendSOS} disabled={sending} className="bg-red-600 text-white px-4 py-2 rounded">
        {sending ? 'Sending...' : 'Send SOS'}
      </button>
      <div className="border rounded p-3">
        <h2 className="font-medium mb-2">Incoming SOS</h2>
        <ul className="space-y-2">
          {alerts.map((a, i) => (
            <li key={i} className="p-2 bg-red-50 border border-red-200 rounded">
              <div className="text-sm">From: {a.userId}</div>
              <div className="text-xs text-gray-600">Loc: {a.location ? `${a.location.lat.toFixed(5)}, ${a.location.lng.toFixed(5)}` : 'unknown'}</div>
              <div className="text-xs text-gray-600">Time: {new Date(a.time).toLocaleString()}</div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
