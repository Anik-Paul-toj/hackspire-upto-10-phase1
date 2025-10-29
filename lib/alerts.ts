import { addDoc, collection, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { getFirebase } from './firebase';

export type AlertDoc = {
  userID: string;
  userName: string;
  message: string;
  location: { lat: number; lng: number } | null;
  imageURL: string;
  status: 'pending' | 'verified' | 'resolved';
  blockchainTX: string;
  verifiedByAI: boolean;
  timestamp: unknown;
  aiSummary: string;
};

export async function createAlert(params: {
  userId: string;
  userName: string;
  coords: { lat: number; lng: number } | null;
  message: string;
}): Promise<string> {
  const { db } = getFirebase();
  const ref = await addDoc(collection(db, 'alerts'), {
    userID: params.userId,
    userName: params.userName,
    message: params.message,
    location: params.coords,
    imageURL: '',
    status: 'pending',
    blockchainTX: '',
    verifiedByAI: false,
    timestamp: serverTimestamp(),
    aiSummary: '',
  } as AlertDoc);
  return ref.id;
}

export function observeAlert(alertId: string, cb: (data: AlertDoc | null) => void) {
  const { db } = getFirebase();
  const ref = doc(db, 'alerts', alertId);
  return onSnapshot(ref, (snap) => {
    cb((snap.exists() ? (snap.data() as AlertDoc) : null));
  });
}


