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

export async function promoteCurrentUserToAdmin(): Promise<void> {
  const { db, auth } = getFirebase();
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  await setDoc(
    doc(db, 'users', user.uid),
    { role: 'admin', lastActive: serverTimestamp() },
    { merge: true }
  );
}


