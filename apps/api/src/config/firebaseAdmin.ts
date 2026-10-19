import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

let isFirebaseConfigured = false;

try {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey && !privateKey.includes('example') && !privateKey.includes('...')) {
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey
        })
      });
    }
    isFirebaseConfigured = true;
    console.log('✅ Firebase Admin SDK initialized successfully');
  } else {
    console.log('ℹ️ Firebase credentials not provided or using placeholders; running in dev simulation mode');
  }
} catch (err) {
  console.warn('⚠️ Firebase Admin init warning, falling back to dev mode:', err);
}

export { admin, isFirebaseConfigured };
