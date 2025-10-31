"use client";
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirebase } from './firebase';

// Flag to prevent multiple concurrent popup requests
let isPopupOpen = false;

export async function signInWithGoogle(): Promise<{ user: User; role: string }> {
  // Prevent multiple simultaneous popup requests
  if (isPopupOpen) {
    throw new Error('Authentication popup is already open. Please complete or close it first.');
  }

  try {
    isPopupOpen = true;
    const { auth, db } = getFirebase();
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const user = cred.user;

    // Provision minimal profile if not exists
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    let role = 'tourist';
    
    if (!snap.exists()) {
      await setDoc(ref, {
        name: user.displayName ?? '',
        email: user.email ?? '',
        role: 'tourist',
        photoURL: user.photoURL ?? '',
        blockchainID: '',
        qrCodeURL: '',
        verified: false,
        createdAt: serverTimestamp(),
        lastActive: serverTimestamp(),
      }, { merge: true });
    } else {
      await setDoc(ref, { lastActive: serverTimestamp() }, { merge: true });
      const userData = snap.data();
      role = userData?.role || 'tourist';
    }

    return { user, role };
  } finally {
    // Always reset the flag, even if an error occurs
    isPopupOpen = false;
  }
}

export async function signOutUser(): Promise<void> {
  const { auth } = getFirebase();
  await signOut(auth);
}

export function observeAuthState(callback: (user: User | null) => void) {
  const { auth } = getFirebase();
  return onAuthStateChanged(auth, callback);
}


