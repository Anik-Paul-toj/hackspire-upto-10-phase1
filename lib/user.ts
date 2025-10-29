import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebase } from './firebase';

export async function setUserRole(userId: string, role: 'tourist' | 'admin') {
  const { db } = getFirebase();
  await setDoc(
    doc(db, 'users', userId),
    { role, lastActive: serverTimestamp() },
    { merge: true }
  );
}


