import { initializeApp, type FirebaseApp, getApps, getApp } from 'firebase/app';
import { getAuth, type Auth, connectAuthEmulator, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, type Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAnalytics, type Analytics, isSupported } from 'firebase/analytics';

type FirebaseClients = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  analytics?: Analytics;
};

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let clients: FirebaseClients | undefined;

export function getFirebase(): FirebaseClients {
  if (clients) return clients;

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
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

  clients = { app, auth, db, analytics };
  return clients;
}


