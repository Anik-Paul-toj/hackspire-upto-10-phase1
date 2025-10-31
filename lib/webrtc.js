// Minimal WebRTC mesh manager with WebSocket signaling and IndexedDB caching
export class WebRTCMesh {
  constructor({ roomId = 'sos_room', signalingUrl, onPeersChange, onSOS, iceServers } = {}) {
    this.roomId = roomId;
    // Default to same host as the page, port 8080 (works on LAN IPs like 192.168.x.x)
    if (!signalingUrl) {
      const host = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : 'localhost';
      this.signalingUrl = `ws://${host}:8080`;
    } else {
      this.signalingUrl = signalingUrl;
    }
    this.socket = null;
    this.clientId = null;
    this.peers = new Map(); // id -> { pc, dc }
    this.onPeersChange = onPeersChange || (() => {});
    this.onSOS = onSOS || (() => {});
    this.iceServers = iceServers || [{ urls: ['stun:stun.l.google.com:19302'] }];
  }

  connect() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) return;
    this.socket = new WebSocket(this.signalingUrl);
    this.socket.onopen = () => {
      this.socket.send(JSON.stringify({ type: 'join', roomId: this.roomId }));
    };
    this.socket.onmessage = async (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.type === 'hello') {
        this.clientId = msg.clientId;
      } else if (msg.type === 'peers') {
        const others = msg.peers.filter((id) => id !== this.clientId);
        for (const id of others) {
          // Simple glare avoidance: only the higher id initiates
          const shouldInitiate = this.clientId && Number(this.clientId) > Number(id);
          if (shouldInitiate && !this.peers.has(id)) await this._createOfferTo(id);
        }
        this.onPeersChange(this.getPeerCount());
      } else if (msg.type === 'signal') {
        await this._handleSignal(msg.from, msg.payload);
      }
    };
  }

  async _ensurePeer(id) {
    if (this.peers.has(id)) return this.peers.get(id);
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const stateUpdate = () => this.onPeersChange(this.getPeerCount());
    pc.onconnectionstatechange = stateUpdate;
    pc.oniceconnectionstatechange = stateUpdate;
    pc.onicecandidate = (e) => {
      if (e.candidate) this._sendSignal(id, { type: 'candidate', candidate: e.candidate });
    };
    pc.ondatachannel = (evt) => {
      const dc = evt.channel;
      this._attachDC(id, pc, dc);
    };
    const entry = { pc, dc: null };
    this.peers.set(id, entry);
    return entry;
  }

  _attachDC(id, pc, dc) {
    dc.binaryType = 'arraybuffer';
    dc.onopen = () => this.onPeersChange(this.getPeerCount());
    dc.onclose = () => this.onPeersChange(this.getPeerCount());
    dc.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.kind === 'sos') this.onSOS(msg.data);
      } catch {}
    };
    const entry = this.peers.get(id);
    if (entry) entry.dc = dc; else this.peers.set(id, { pc, dc });
  }

  async _createOfferTo(id) {
    const { pc } = await this._ensurePeer(id);
    const dc = pc.createDataChannel('sos');
    this._attachDC(id, pc, dc);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await this._sendSignal(id, { type: 'offer', sdp: offer });
  }

  async _handleSignal(from, payload) {
    const entry = await this._ensurePeer(from);
    const pc = entry.pc;
    if (payload.type === 'offer') {
      // Only accept offers when stable to avoid glare
      if (pc.signalingState !== 'stable') return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await this._sendSignal(from, { type: 'answer', sdp: answer });
      } catch {}
    } else if (payload.type === 'answer') {
      // Only set answer if we are in have-local-offer state
      if (pc.signalingState !== 'have-local-offer') return;
      try { await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp)); } catch {}
    } else if (payload.type === 'candidate') {
      // Add candidates only after remote description set
      if (!pc.remoteDescription) return;
      try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch {}
    }
  }

  async _sendSignal(to, payload) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ type: 'signal', roomId: this.roomId, to, payload }));
  }

  getPeerCount() {
    let count = 0;
    for (const { dc } of this.peers.values()) if (dc && dc.readyState === 'open') count++;
    return count;
  }

  broadcastSOS(sos) {
    const data = JSON.stringify({ kind: 'sos', data: sos });
    for (const { dc } of this.peers.values()) {
      if (dc && dc.readyState === 'open') {
        try { dc.send(data); } catch {}
      }
    }
  }
}

export const idb = {
  _db: null,
  _open() {
    return new Promise((resolve, reject) => {
      if (this._db) return resolve(this._db);
      const req = indexedDB.open('sos-db', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('pending')) db.createObjectStore('pending', { keyPath: 'id', autoIncrement: true });
      };
      req.onsuccess = () => { this._db = req.result; resolve(this._db); };
      req.onerror = () => reject(req.error);
    });
  },
  async addPending(alert) {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending', 'readwrite');
      tx.objectStore('pending').add(alert);
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });
  },
  async getAllPending() {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending', 'readonly');
      const req = tx.objectStore('pending').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async clearPending() {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending', 'readwrite');
      tx.objectStore('pending').clear();
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });
  }
};
