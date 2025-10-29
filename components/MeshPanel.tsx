"use client";
import { useEffect, useRef, useState } from 'react';
import { MeshRoom } from '@/lib/mesh';
import { useUserProfileContext } from '@/contexts/UserProfileProvider';

export default function MeshPanel() {
  const { user } = useUserProfileContext();
  const [roomId, setRoomId] = useState<string>("room_help_1");
  const [status, setStatus] = useState<string>('idle');
  const [log, setLog] = useState<string[]>([]);
  const [message, setMessage] = useState<string>('OFFLINE SOS: Need assistance.');
  const meshRef = useRef<MeshRoom | null>(null);

  const append = (s: string) => setLog((prev) => [s, ...prev].slice(0, 50));

  useEffect(() => {
    return () => { meshRef.current?.close(); };
  }, []);

  const createRoom = async () => {
    try {
      meshRef.current?.close();
      const m = new MeshRoom(roomId, {
        onOpen: () => { setStatus('open'); append('DataChannel open - Connected!'); },
        onClose: () => { setStatus('closed'); append('Connection closed'); },
        onError: (e) => { append(`Error: ${e?.message ?? e}`); },
        onMessage: (msg) => { append(`Peer: ${msg}`); },
        onStatus: (s) => { 
          setStatus(s); 
          append(`Status: ${s}`);
        },
      });
      meshRef.current = m;
      append('Creating room...');
      await m.create();
      append('Room created - waiting for peer to join');
    } catch (e: any) {
      append(`Create failed: ${e?.message ?? e}`);
      setStatus('failed');
    }
  };

  const joinRoom = async () => {
    try {
      meshRef.current?.close();
      const m = new MeshRoom(roomId, {
        onOpen: () => { setStatus('open'); append('DataChannel open - Connected!'); },
        onClose: () => { setStatus('closed'); append('Connection closed'); },
        onError: (e) => { append(`Error: ${e?.message ?? e}`); },
        onMessage: (msg) => { append(`Peer: ${msg}`); },
        onStatus: (s) => { 
          setStatus(s); 
          append(`Status: ${s}`);
        },
      });
      meshRef.current = m;
      append('Joining room...');
      await m.join();
      append('Join initiated - waiting for connection');
    } catch (e: any) {
      append(`Join failed: ${e?.message ?? e}`);
      setStatus('failed');
    }
  };

  const sendMsg = async () => {
    try {
      meshRef.current?.send(message);
      append(`You: ${message}`);
      if (user) await meshRef.current?.logMessage(user.uid, message);
    } catch (e: any) {
      append(`Send failed (channel closed).`);
    }
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <h2 className="font-semibold">Mesh Network</h2>
      <div className="flex flex-wrap items-center gap-2">
        <input value={roomId} onChange={(e) => setRoomId(e.target.value)} className="rounded-md border px-3 py-2 text-sm" placeholder="room id" />
        <button onClick={createRoom} className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50">Create</button>
        <button onClick={joinRoom} className="rounded-md bg-black px-3 py-2 text-sm text-white hover:bg-gray-800">Join</button>
        <span className="text-xs text-gray-600">Status: {status}</span>
      </div>

      <div className="flex items-center gap-2">
        <input value={message} onChange={(e) => setMessage(e.target.value)} className="flex-1 rounded-md border px-3 py-2 text-sm" />
        <button onClick={sendMsg} className="rounded-md bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700">Send Offline SOS</button>
      </div>

      <div className="rounded-md border p-2 max-h-48 overflow-auto text-xs text-gray-800 bg-gray-50">
        {log.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  );
}


