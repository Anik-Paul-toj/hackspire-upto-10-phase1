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

    this.pc.onconnectionstatechange = () => {
      this.callbacks.onStatus?.(this.pc.connectionState);
      if (this.pc.connectionState === 'connected') {
        this.callbacks.onStatus?.('connected');
      }
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

    // Set up ICE candidate handling for the creator
    this.pc.onicecandidate = async (event) => {
      if (event.candidate) {
        try {
          await updateDoc(doc(db, 'mesh_network', this.roomId), {
            candidates: arrayUnion({ ...event.candidate.toJSON(), from: 'caller' }),
          });
        } catch (e) {
          console.error('Failed to add caller ICE candidate:', e);
        }
      }
    };

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    await updateDoc(doc(db, 'mesh_network', this.roomId), { offer: { type: offer.type, sdp: offer.sdp } });

    // Listen for answer and remote candidates
    this.unsub = onSnapshot(doc(db, 'mesh_network', this.roomId), async (snap) => {
      const data = snap.data() as any;
      
      // Handle answer first
      if (data?.answer && this.pc.signalingState === 'have-local-offer') {
        try {
          await this.pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          this.callbacks.onStatus?.('connected');
        } catch (e) {
          console.error('Failed to set remote description:', e);
          this.callbacks.onError?.(e);
        }
      }
      
      // Then handle ICE candidates
      if (Array.isArray(data?.candidates) && this.pc.remoteDescription) {
        for (const c of data.candidates) {
          if (c.from === 'callee') {
            try { 
              await this.pc.addIceCandidate(new RTCIceCandidate(c)); 
            } catch (e) {
              console.error('Failed to add ICE candidate:', e);
            }
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
    if (!data.offer) throw new Error('No offer available');

    this.pc.ondatachannel = (evt) => {
      this.dc = evt.channel;
      this.dc.onopen = () => this.callbacks.onOpen?.();
      this.dc.onclose = () => this.callbacks.onClose?.();
      this.dc.onerror = (e) => this.callbacks.onError?.(e);
      this.dc.onmessage = (e) => this.callbacks.onMessage?.(String(e.data));
    };

    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      await updateDoc(roomRef, { answer: { type: answer.type, sdp: answer.sdp } });
      
      this.callbacks.onStatus?.('negotiating');
    } catch (e) {
      console.error('Failed to create answer:', e);
      throw e;
    }

    // Set up ICE candidate handling for the joiner
    this.pc.onicecandidate = async (event) => {
      if (event.candidate) {
        try {
          await updateDoc(roomRef, {
            candidates: arrayUnion({ ...event.candidate.toJSON(), from: 'callee' }),
          });
        } catch (e) {
          console.error('Failed to add ICE candidate:', e);
        }
      }
    };

    // Listen for caller candidates
    this.unsub = onSnapshot(roomRef, async (fresh) => {
      const d = fresh.data() as any;
      if (Array.isArray(d?.candidates) && this.pc.remoteDescription) {
        for (const c of d.candidates) {
          if (c.from === 'caller') {
            try { 
              await this.pc.addIceCandidate(new RTCIceCandidate(c)); 
            } catch (e) {
              console.error('Failed to add caller ICE candidate:', e);
            }
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


