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
    <div className="rounded-lg border bg-white shadow-sm p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${
          status === 'open' ? 'bg-green-500' : 
          status === 'connecting' ? 'bg-yellow-500' : 
          status === 'failed' ? 'bg-red-500' : 'bg-gray-400'
        }`}></div>
        <h2 className="font-semibold text-lg">Emergency Mesh Network</h2>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          status === 'open' ? 'bg-green-100 text-green-700' :
          status === 'connecting' ? 'bg-yellow-100 text-yellow-700' :
          status === 'failed' ? 'bg-red-100 text-red-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {status}
        </span>
      </div>

      {/* Room Controls */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <input 
            value={roomId} 
            onChange={(e) => setRoomId(e.target.value)} 
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500" 
            placeholder="Enter room ID (e.g., room_help_1)" 
          />
          <div className="flex gap-2">
            <button 
              onClick={createRoom} 
              className="flex-1 sm:flex-none rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 transition-colors font-medium"
            >
              Create Room
            </button>
            <button 
              onClick={joinRoom} 
              className="flex-1 sm:flex-none rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 transition-colors font-medium"
            >
              Join Room
            </button>
          </div>
        </div>
      </div>

      {/* Connection Status */}
      {connectionInfo && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <h4 className="text-sm font-medium text-blue-900 mb-2">Connection Status</h4>
          <div className="text-xs text-blue-800 font-mono bg-white p-2 rounded border">
            {connectionInfo}
          </div>
        </div>
      )}

      {/* Message Controls */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-medium text-red-900 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          Emergency SOS Message
        </h4>
        <div className="flex flex-col sm:flex-row gap-2">
          <input 
            value={message} 
            onChange={(e) => setMessage(e.target.value)} 
            className="flex-1 rounded-md border border-red-300 px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
            placeholder="Enter your emergency message..."
          />
          <button 
            onClick={sendMsg} 
            className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            Send SOS
          </button>
        </div>
      </div>

      {/* Debug Controls */}
      <div className="flex flex-col sm:flex-row gap-2">
        <button 
          onClick={testConnection} 
          className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 transition-colors font-medium"
        >
          Test Connection
        </button>
      </div>

      {/* Message Log */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-900">Message Log</h4>
        <div className="rounded-md border border-gray-300 bg-gray-50 p-3 max-h-48 sm:max-h-64 overflow-auto">
          {log.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-4">
              No messages yet. Create or join a room to start.
            </div>
          ) : (
            <div className="space-y-1">
              {log.map((l, i) => (
                <div 
                  key={i} 
                  className={`text-xs p-2 rounded ${
                    l.includes('Error') || l.includes('failed') ? 'bg-red-100 text-red-800' :
                    l.includes('✅') || l.includes('Connected') ? 'bg-green-100 text-green-800' :
                    l.includes('You:') ? 'bg-blue-100 text-blue-800' :
                    l.includes('Peer:') ? 'bg-purple-100 text-purple-800' :
                    'bg-white text-gray-800'
                  }`}
                >
                  {l}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


