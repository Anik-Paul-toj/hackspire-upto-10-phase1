"use client";
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirebase } from './firebase';

export async function signInWithGoogle(): Promise<User> {
  const { auth, db } = getFirebase();
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  const user = cred.user;

  // Provision minimal profile if not exists
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
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
  }

  return user;
}

export async function signOutUser(): Promise<void> {
  const { auth } = getFirebase();
  await signOut(auth);
}

export function observeAuthState(callback: (user: User | null) => void) {
  const { auth } = getFirebase();
  return onAuthStateChanged(auth, callback);
}


