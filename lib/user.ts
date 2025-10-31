import { doc, setDoc, serverTimestamp, getDoc, collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { getFirebase } from './firebase';
import type { AdminDoc, AdminWithId } from '@/types/admin';

export async function setUserRole(userId: string, role: 'tourist' | 'admin') {
  const { db } = getFirebase();
  
  // Update the user's role in the users collection
  await setDoc(
    doc(db, 'users', userId),
    { role, lastActive: serverTimestamp() },
    { merge: true }
  );

  // If the role is admin, also create/update a document in the admin collection
  if (role === 'admin') {
    // Get the user's profile information from the users collection
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.data();
    
    await setDoc(
      doc(db, 'admin', userId),
      {
        userId,
        name: userData?.name || '',
        email: userData?.email || '',
        photoURL: userData?.photoURL || '',
        verified: userData?.verified || false,
        promotedAt: serverTimestamp(),
        lastActive: serverTimestamp(),
        isActive: true
      },
      { merge: true }
    );
  }
}

export async function promoteCurrentUserToAdmin(): Promise<void> {
  const { db, auth } = getFirebase();
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  
  // Update role in users collection
  await setDoc(
    doc(db, 'users', user.uid),
    { role: 'admin', lastActive: serverTimestamp() },
    { merge: true }
  );

  // Get the user's profile information
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  const userData = userDoc.data();
  
  // Create/update document in admin collection
  await setDoc(
    doc(db, 'admin', user.uid),
    {
      userId: user.uid,
      name: userData?.name || user.displayName || '',
      email: userData?.email || user.email || '',
      photoURL: userData?.photoURL || user.photoURL || '',
      verified: userData?.verified || false,
      promotedAt: serverTimestamp(),
      lastActive: serverTimestamp(),
      isActive: true
    },
    { merge: true }
  );
}

/**
 * Updates the last active timestamp for an admin in the admin collection
 */
export async function updateAdminActivity(userId: string): Promise<void> {
  const { db } = getFirebase();
  
  // Check if user is admin first
  const userDoc = await getDoc(doc(db, 'users', userId));
  const userData = userDoc.data();
  
  if (userData?.role === 'admin') {
    await setDoc(
      doc(db, 'admin', userId),
      { 
        lastActive: serverTimestamp(),
        isActive: true 
      },
      { merge: true }
    );
  }
}

/**
 * Gets all admin users from the admin collection
 */
export async function getAllAdmins(): Promise<AdminWithId[]> {
  const { db } = getFirebase();
  const q = query(
    collection(db, 'admin'),
    where('isActive', '==', true),
    orderBy('lastActive', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as AdminWithId[];
}

/**
 * Gets a specific admin by their user ID
 */
export async function getAdminById(userId: string): Promise<AdminDoc | null> {
  const { db } = getFirebase();
  const docRef = doc(db, 'admin', userId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return docSnap.data() as AdminDoc;
  }
  return null;
}


