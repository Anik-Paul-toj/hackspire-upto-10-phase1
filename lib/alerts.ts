import { addDoc, collection, doc, onSnapshot, serverTimestamp, updateDoc, setDoc } from 'firebase/firestore';
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
  dispatchedBy?: string;
  dispatchedAt?: unknown;
  dispatchClassification?: string;
  dispatchNotes?: string;
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

export async function dispatchAlert(params: {
  alertId: string;
  adminId: string;
  classification: string;
  notes?: string;
}): Promise<void> {
  const { db } = getFirebase();
  const alertRef = doc(db, 'alerts', params.alertId);
  
  await updateDoc(alertRef, {
    status: 'verified',
    dispatchedBy: params.adminId,
    dispatchedAt: serverTimestamp(),
    dispatchClassification: params.classification,
    dispatchNotes: params.notes || '',
  });
  
  // Create a dispatch record
  await addDoc(collection(db, 'dispatches'), {
    alertId: params.alertId,
    adminId: params.adminId,
    classification: params.classification,
    notes: params.notes || '',
    timestamp: serverTimestamp(),
  });
}

export async function resolveAlert(alertId: string): Promise<void> {
  const { db } = getFirebase();
  const alertRef = doc(db, 'alerts', alertId);
  
  await updateDoc(alertRef, {
    status: 'resolved',
  });
}


