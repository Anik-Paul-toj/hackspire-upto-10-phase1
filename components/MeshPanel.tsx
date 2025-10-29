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
  const [connectionInfo, setConnectionInfo] = useState<string>('');
  const meshRef = useRef<MeshRoom | null>(null);

  const append = (s: string) => setLog((prev) => [s, ...prev].slice(0, 50));

  useEffect(() => {
    return () => { meshRef.current?.close(); };
  }, []);

  const updateConnectionInfo = () => {
    if (meshRef.current) {
      const info = meshRef.current.connectionState;
      setConnectionInfo(`PC: ${info.peerConnection} | ICE: ${info.iceConnection} | DC: ${info.dataChannel} | Signal: ${info.signalingState}`);
    }
  };

  useEffect(() => {
    const interval = setInterval(updateConnectionInfo, 1000);
    return () => clearInterval(interval);
  }, []);

  const createRoom = async () => {
    try {
      meshRef.current?.close();
      const m = new MeshRoom(roomId, {
        onOpen: () => { setStatus('open'); append('DataChannel open - Connected!'); updateConnectionInfo(); },
        onClose: () => { setStatus('closed'); append('Connection closed'); updateConnectionInfo(); },
        onError: (e) => { append(`Error: ${e?.message ?? e}`); updateConnectionInfo(); },
        onMessage: (msg) => { append(`Peer: ${msg}`); },
        onStatus: (s) => { 
          setStatus(s); 
          append(`Status: ${s}`);
          updateConnectionInfo();
          if (s === 'connected' && meshRef.current?.open) {
            append('✅ Ready to send messages!');
          }
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
        onOpen: () => { setStatus('open'); append('DataChannel open - Connected!'); updateConnectionInfo(); },
        onClose: () => { setStatus('closed'); append('Connection closed'); updateConnectionInfo(); },
        onError: (e) => { append(`Error: ${e?.message ?? e}`); updateConnectionInfo(); },
        onMessage: (msg) => { append(`Peer: ${msg}`); },
        onStatus: (s) => { 
          setStatus(s); 
          append(`Status: ${s}`);
          updateConnectionInfo();
          if (s === 'connected' && meshRef.current?.open) {
            append('✅ Ready to send messages!');
          }
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
      if (!meshRef.current) {
        append('No connection established');
        return;
      }
      
      if (!meshRef.current.open) {
        append('Connection not ready - waiting...');
        const connected = await meshRef.current.waitForConnection(5000);
        if (!connected) {
          append('Connection timeout - unable to send message');
          return;
        }
      }
      
      meshRef.current.send(message);
      append(`You: ${message}`);
      if (user) await meshRef.current.logMessage(user.uid, message);
    } catch (e: any) {
      append(`Send failed: ${e?.message ?? 'channel closed'}`);
    }
  };

  const testConnection = () => {
    if (meshRef.current) {
      const info = meshRef.current.connectionState;
      append(`🔍 Connection Test:`);
      append(`  Peer: ${info.peerConnection}`);
      append(`  ICE: ${info.iceConnection}`);
      append(`  DataChannel: ${info.dataChannel}`);
      append(`  Signaling: ${info.signalingState}`);
      append(`  Ready: ${meshRef.current.open ? 'YES' : 'NO'}`);
    } else {
      append('❌ No connection object');
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

      {connectionInfo && (
        <div className="text-xs text-gray-500 bg-gray-100 p-2 rounded font-mono">
          {connectionInfo}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input value={message} onChange={(e) => setMessage(e.target.value)} className="flex-1 rounded-md border px-3 py-2 text-sm" />
        <button onClick={sendMsg} className="rounded-md bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700">Send Offline SOS</button>
        <button onClick={testConnection} className="rounded-md bg-gray-500 px-3 py-2 text-sm text-white hover:bg-gray-600">Test</button>
      </div>

      <div className="flex justify-between">
        <button onClick={testConnection} className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700">Test Connection</button>
      </div>

      <div className="rounded-md border p-2 max-h-48 overflow-auto text-xs text-gray-800 bg-gray-50">
        {log.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  );
}


