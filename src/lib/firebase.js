import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup,
  GoogleAuthProvider,
  signOut, 
  onAuthStateChanged,
  updateProfile,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { 
  getDatabase, 
  ref, 
  set, 
  get, 
  child, 
  update, 
  onValue, 
  serverTimestamp 
} from 'firebase/database';

import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  collection,
  onSnapshot
} from 'firebase/firestore';

// Read config from Environment Variables or localStorage (Self-hosted user configuration)
export function getFirebaseConfig() {
  try {
    const saved = localStorage.getItem('paper_trading_firebase_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.apiKey) return parsed;
    }
  } catch (e) {
    console.warn('Could not read saved Firebase config', e);
  }

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'paper-trader-001';
  const rawDbUrl = import.meta.env.VITE_FIREBASE_DATABASE_URL;
  // Only use databaseURL if explicitly provided and not the default placeholder
  const databaseURL = rawDbUrl && !rawDbUrl.includes('paper-trader-001-default-rtdb')
    ? rawDbUrl
    : undefined;

  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDBS6Fk6iL-PGEc8xHrU1rI_EMUjjJk47U',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'paper-trader-001.firebaseapp.com',
    projectId: projectId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'paper-trader-001.firebasestorage.app',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '402412229765',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:402412229765:web:bee9cbc1f488b0634c05ec',
  };

  if (databaseURL) {
    config.databaseURL = databaseURL;
  }

  return config;
}

let app = null;
let auth = null;
let database = null;
let firestore = null;
let googleProvider = null;

const initialConfig = getFirebaseConfig();
export const isFirebaseConfigured = Boolean(initialConfig.apiKey);

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(initialConfig) : getApp();
    auth = getAuth(app);
    setPersistence(auth, browserLocalPersistence).catch(() => {});
    firestore = getFirestore(app);
    
    // Only initialize RTDB if an explicit valid databaseURL is configured
    if (initialConfig.databaseURL) {
      try {
        database = getDatabase(app);
      } catch (rtdbErr) {
        console.warn('Realtime database not active, using Cloud Firestore:', rtdbErr?.message);
      }
    }
    
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });
  } catch (err) {
    console.error('Failed to initialize Firebase SDK:', err);
  }
}

export { 
  app, 
  auth, 
  firestore,
  database, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  collection,
  onSnapshot,
  googleProvider,
  signInWithPopup,
  GoogleAuthProvider,
  ref, 
  set, 
  get, 
  child, 
  update, 
  onValue, 
  serverTimestamp 
};
