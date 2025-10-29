"use client";
import { useEffect, useMemo, useState } from 'react';
import { useUserProfileContext } from '@/contexts/UserProfileProvider';
import { createAlert, observeAlert, type AlertDoc } from '@/lib/alerts';

export default function SOSPanel() {
  const { user, profile } = useUserProfileContext();
  const [message, setMessage] = useState('Immediate assistance needed.');
  const [sending, setSending] = useState(false);
  const [alertId, setAlertId] = useState<string | null>(null);
  const [alertDoc, setAlertDoc] = useState<AlertDoc | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    if (!alertId) return;
    const unsub = observeAlert(alertId, setAlertDoc);
    return () => unsub();
  }, [alertId]);

  const polygonscanUrl = useMemo(() => {
    if (!alertDoc?.blockchainTX) return null;
    return `https://mumbai.polygonscan.com/tx/${alertDoc.blockchainTX}`;
  }, [alertDoc?.blockchainTX]);

  const qrUrl = useMemo(() => {
    const id = profile?.blockchainID || '';
    if (!id) return null;
    return `https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=${encodeURIComponent(id)}`;
  }, [profile?.blockchainID]);

  const handleSend = async () => {
    if (!user) return;
    setSending(true);
    setGeoError(null);

    const finalize = async (coords: { lat: number; lng: number } | null) => {
      try {
        const id = await createAlert({
          userId: user.uid,
          userName: profile?.name || user.displayName || user.email || 'User',
          coords,
          message,
        });
        setAlertId(id);
      } catch (e: any) {
        setGeoError(e?.message || 'Failed to send alert');
      } finally {
        setSending(false);
      }
    };

    if (!('geolocation' in navigator)) {
      setGeoError('Geolocation not supported');
      await finalize(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await finalize({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      async () => {
        setGeoError('Location permission denied; sending without GPS');
        await finalize(null);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="fixed right-4 bottom-4 z-[1000] w-[320px] rounded-xl border bg-white shadow-lg">
      <div className="p-4 border-b">
        <h3 className="font-semibold">Emergency SOS</h3>
        <p className="text-xs text-gray-500">Sends an alert to authorities with your latest GPS.</p>
      </div>
      <div className="p-4 space-y-3">
        <textarea
          className="w-full rounded-md border px-3 py-2 text-sm"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe your situation"
        />
        <button
          onClick={handleSend}
          disabled={sending || !user}
          className="w-full rounded-md bg-red-600 px-3 py-2 text-white hover:bg-red-700 disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Send SOS'}
        </button>

        {geoError && <p className="text-xs text-red-600">{geoError}</p>}

        {alertId && (
          <div className="rounded-md border p-3 text-sm">
            <div className="font-medium mb-1">Alert ID: {alertId}</div>
            <div>Status: {alertDoc?.status ?? 'pending'}</div>
            <div className="mt-1">
              {alertDoc?.blockchainTX ? (
                <a href={polygonscanUrl || '#'} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                  View on PolygonScan
                </a>
              ) : (
                <span className="text-gray-600">Awaiting blockchain verification…</span>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <div className="text-xs text-gray-600">Your Blockchain ID QR</div>
          {qrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrUrl} alt="QR" width={64} height={64} className="rounded" />
          ) : (
            <span className="text-xs text-gray-500">No blockchainID</span>
          )}
        </div>
      </div>
    </div>
  );
}


