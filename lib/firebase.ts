import { initializeApp, type FirebaseApp, getApps, getApp } from 'firebase/app';
import { getAuth, type Auth, connectAuthEmulator, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, type Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getDatabase, type Database } from 'firebase/database';
import { getAnalytics, type Analytics, isSupported } from 'firebase/analytics';

type FirebaseClients = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  rtdb: Database;
  analytics?: Analytics;
};

const firebaseConfig = {
  apiKey: 'AIzaSyAsRDBT1_OkTOVJXa92Z4veoqRbra3-T2o',
  authDomain: 'guardio-500a0.firebaseapp.com',
  projectId: 'guardio-500a0',
  storageBucket: 'guardio-500a0.firebasestorage.app',
  messagingSenderId: '306632039905',
  appId: '1:306632039905:web:a05da0839bbd6425b8c6a0',
  measurementId: 'G-25GG6SNYS7',
  databaseURL: 'https://guardio-500a0-default-rtdb.firebaseio.com',
};

let clients: FirebaseClients | undefined;

export function getFirebase(): FirebaseClients {
  if (clients) return clients;

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const rtdb = getDatabase(app);
  let analytics: Analytics | undefined;

  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true') {
    try {
      connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    } catch {}
    try {
      connectFirestoreEmulator(db, 'localhost', 8080);
    } catch {}
  }

  // Ensure auth persists across reloads on the web
  if (typeof window !== 'undefined') {
    void setPersistence(auth, browserLocalPersistence).catch(() => {
      // ignore persistence errors (e.g., in private mode)
    });
    // Initialize Analytics only in supported environments (browsers)
    void isSupported().then((ok) => {
      if (ok) {
        try { analytics = getAnalytics(app); } catch {}
      }
    });
  }

  clients = { app, auth, db, rtdb, analytics };
  return clients;
}


