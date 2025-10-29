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
  private pendingCandidates: any[] = [];
  private isCreator: boolean = false;

  constructor(roomId: string, callbacks: MeshCallbacks = {}) {
    this.roomId = roomId;
    this.callbacks = callbacks;
    this.pc = new RTCPeerConnection({
      iceServers: [
        { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
        { urls: 'stun:stun.l.google.com:19302' }
      ],
    });

    this.pc.onconnectionstatechange = () => {
      console.log('Connection state:', this.pc.connectionState);
      this.callbacks.onStatus?.(this.pc.connectionState);
      if (this.pc.connectionState === 'connected') {
        this.callbacks.onStatus?.('connected');
      }
      if (this.pc.connectionState === 'disconnected' || this.pc.connectionState === 'failed' || this.pc.connectionState === 'closed') {
        this.callbacks.onClose?.();
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', this.pc.iceConnectionState);
      if (this.pc.iceConnectionState === 'connected' || this.pc.iceConnectionState === 'completed') {
        this.callbacks.onStatus?.('connected');
      }
      if (this.pc.iceConnectionState === 'failed') {
        this.callbacks.onError?.(new Error('ICE connection failed'));
      }
    };
  }

  get open() {
    return this.dc?.readyState === 'open' && this.pc.connectionState === 'connected';
  }

  get connectionState() {
    return {
      peerConnection: this.pc.connectionState,
      iceConnection: this.pc.iceConnectionState,
      dataChannel: this.dc?.readyState || 'none',
      signalingState: this.pc.signalingState
    };
  }

  async create(): Promise<void> {
    this.isCreator = true;
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

    this.dc = this.pc.createDataChannel('mesh', { ordered: true });
    this.setupDataChannelHandlers();

    // Set up ICE candidate handling for the creator
    this.pc.onicecandidate = async (event) => {
      if (event.candidate) {
        console.log('Creator ICE candidate:', event.candidate);
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
          console.log('Setting remote description with answer');
          await this.pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          // Process any pending candidates
          await this.processPendingCandidates();
        } catch (e) {
          console.error('Failed to set remote description:', e);
          this.callbacks.onError?.(e);
        }
      }
      
      // Then handle ICE candidates
      if (Array.isArray(data?.candidates) && data.candidates.length > 0) {
        for (const c of data.candidates) {
          if (c.from === 'callee') {
            await this.addIceCandidate(c);
          }
        }
      }
    });
  }

  async join(): Promise<void> {
    this.isCreator = false;
    const { db } = getFirebase();
    const roomRef = doc(db, 'mesh_network', this.roomId);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) throw new Error('Room not found');
    const data = snap.data() as any;
    if (!data.offer) throw new Error('No offer available');

    this.pc.ondatachannel = (evt) => {
      this.dc = evt.channel;
      this.setupDataChannelHandlers();
    };

    try {
      console.log('Setting remote description with offer');
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
        console.log('Joiner ICE candidate:', event.candidate);
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
      if (Array.isArray(d?.candidates) && d.candidates.length > 0) {
        for (const c of d.candidates) {
          if (c.from === 'caller') {
            await this.addIceCandidate(c);
          }
        }
      }
    });

    // Process any existing candidates from the caller
    if (Array.isArray(data.candidates) && data.candidates.length > 0) {
      console.log('Processing existing candidates:', data.candidates.length);
      for (const c of data.candidates) {
        if (c.from === 'caller') {
          await this.addIceCandidate(c);
        }
      }
    }
  }

  send(message: string) {
    console.log('Attempting to send message:', message, 'DataChannel state:', this.dc?.readyState);
    if (this.dc && this.dc.readyState === 'open') {
      try {
        this.dc.send(message);
        console.log('Message sent successfully');
        return true;
      } catch (e) {
        console.error('Failed to send message:', e);
        throw new Error('Failed to send message');
      }
    } else {
      const state = this.dc ? this.dc.readyState : 'no datachannel';
      console.error('Cannot send message - DataChannel state:', state);
      throw new Error(`DataChannel not ready (state: ${state})`);
    }
  }

  async waitForConnection(timeoutMs: number = 10000): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.open) {
        resolve(true);
        return;
      }

      const timeout = setTimeout(() => {
        resolve(false);
      }, timeoutMs);

      const checkConnection = () => {
        if (this.open) {
          clearTimeout(timeout);
          resolve(true);
        } else {
          setTimeout(checkConnection, 100);
        }
      };

      checkConnection();
    });
  }

  private setupDataChannelHandlers() {
    if (!this.dc) return;
    
    this.dc.onopen = () => {
      console.log('DataChannel opened');
      this.callbacks.onOpen?.();
    };
    this.dc.onclose = () => {
      console.log('DataChannel closed');
      this.callbacks.onClose?.();
    };
    this.dc.onerror = (e) => {
      console.error('DataChannel error:', e);
      this.callbacks.onError?.(e);
    };
    this.dc.onmessage = (e) => {
      console.log('Message received:', e.data);
      this.callbacks.onMessage?.(String(e.data));
    };
  }

  private async addIceCandidate(candidate: any) {
    if (!this.pc.remoteDescription) {
      console.log('No remote description, queuing candidate');
      this.pendingCandidates.push(candidate);
      return;
    }

    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('ICE candidate added successfully');
    } catch (e) {
      console.error('Failed to add ICE candidate:', e);
    }
  }

  private async processPendingCandidates() {
    console.log('Processing', this.pendingCandidates.length, 'pending candidates');
    for (const candidate of this.pendingCandidates) {
      await this.addIceCandidate(candidate);
    }
    this.pendingCandidates = [];
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
    console.log('Closing mesh connection');
    try { this.unsub?.(); } catch (e) { console.error('Error unsubscribing:', e); }
    try { this.dc?.close(); } catch (e) { console.error('Error closing datachannel:', e); }
    try { this.pc.close(); } catch (e) { console.error('Error closing peer connection:', e); }
  }
}


