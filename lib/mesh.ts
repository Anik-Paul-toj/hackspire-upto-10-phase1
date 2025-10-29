import { getFirebase } from './firebase';
import { doc, getDoc, onSnapshot, setDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';

type MeshCallbacks = {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (e: any) => void;
  onMessage?: (msg: string) => void;
  onStatus?: (s: string) => void;
};

export class MeshRoom {
  private pc: RTCPeerConnection;
  private dc?: RTCDataChannel;
  private unsub?: () => void;
  private roomId: string;
  private callbacks: MeshCallbacks;

  constructor(roomId: string, callbacks: MeshCallbacks = {}) {
    this.roomId = roomId;
    this.callbacks = callbacks;
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }],
    });

    this.pc.onicecandidate = async (event) => {
      if (event.candidate) {
        try {
          const { db } = getFirebase();
          await updateDoc(doc(db, 'mesh_network', this.roomId), {
            candidates: arrayUnion({ ...event.candidate.toJSON(), from: 'caller' }),
          });
        } catch (_) {}
      }
    };

    this.pc.onconnectionstatechange = () => {
      this.callbacks.onStatus?.(this.pc.connectionState);
      if (this.pc.connectionState === 'disconnected' || this.pc.connectionState === 'failed' || this.pc.connectionState === 'closed') {
        this.callbacks.onClose?.();
      }
    };
  }

  get open() {
    return this.dc?.readyState === 'open';
  }

  async create(): Promise<void> {
    const { db } = getFirebase();
    await setDoc(doc(db, 'mesh_network', this.roomId), {
      participants: [],
      messages: [],
      active: true,
      createdAt: serverTimestamp(),
      // signaling fields
      offer: null,
      answer: null,
      candidates: [],
    }, { merge: true });

    this.dc = this.pc.createDataChannel('mesh');
    this.dc.onopen = () => this.callbacks.onOpen?.();
    this.dc.onclose = () => this.callbacks.onClose?.();
    this.dc.onerror = (e) => this.callbacks.onError?.(e);
    this.dc.onmessage = (e) => this.callbacks.onMessage?.(String(e.data));

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    await updateDoc(doc(db, 'mesh_network', this.roomId), { offer: { type: offer.type, sdp: offer.sdp } });

    // Listen for answer and remote candidates
    this.unsub = onSnapshot(doc(db, 'mesh_network', this.roomId), async (snap) => {
      const data = snap.data() as any;
      if (data?.answer && this.pc.signalingState !== 'stable') {
        await this.pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
      if (Array.isArray(data?.candidates)) {
        for (const c of data.candidates) {
          if (c.from === 'callee') {
            try { await this.pc.addIceCandidate(c); } catch {}
          }
        }
      }
    });
  }

  async join(): Promise<void> {
    const { db } = getFirebase();
    const roomRef = doc(db, 'mesh_network', this.roomId);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) throw new Error('Room not found');
    const data = snap.data() as any;
    if (!data.offer) throw new Error('No offer');

    this.pc.ondatachannel = (evt) => {
      this.dc = evt.channel;
      this.dc.onopen = () => this.callbacks.onOpen?.();
      this.dc.onclose = () => this.callbacks.onClose?.();
      this.dc.onerror = (e) => this.callbacks.onError?.(e);
      this.dc.onmessage = (e) => this.callbacks.onMessage?.(String(e.data));
    };

    await this.pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await updateDoc(roomRef, { answer: { type: answer.type, sdp: answer.sdp } });

    // Push our ICE candidates
    this.pc.onicecandidate = async (event) => {
      if (event.candidate) {
        try {
          await updateDoc(roomRef, {
            candidates: arrayUnion({ ...event.candidate.toJSON(), from: 'callee' }),
          });
        } catch (_) {}
      }
    };

    // Listen for new caller candidates (optional since we already added in constructor)
    this.unsub = onSnapshot(roomRef, async (fresh) => {
      const d = fresh.data() as any;
      if (Array.isArray(d?.candidates)) {
        for (const c of d.candidates) {
          if (c.from === 'caller') {
            try { await this.pc.addIceCandidate(c); } catch {}
          }
        }
      }
    });
  }

  send(message: string) {
    if (this.dc && this.dc.readyState === 'open') {
      this.dc.send(message);
    } else {
      throw new Error('DataChannel not open');
    }
  }

  async logMessage(sender: string, message: string) {
    try {
      const { db } = getFirebase();
      await updateDoc(doc(db, 'mesh_network', this.roomId), {
        messages: arrayUnion({ sender, message, timestamp: new Date() }),
      });
    } catch (_) {}
  }

  close() {
    try { this.unsub?.(); } catch {}
    try { this.dc?.close(); } catch {}
    try { this.pc.close(); } catch {}
  }
}


