import * as admin from 'firebase-admin';
import { ServiceAccount } from 'firebase-admin';

let firebaseAdmin: admin.app.App | null = null;

/**
 * Check if Firebase Admin is configured
 */
export const isFirebaseConfigured = (): boolean => {
  return !!(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    (process.env.FIREBASE_PROJECT_ID && 
     process.env.FIREBASE_CLIENT_EMAIL && 
     process.env.FIREBASE_PRIVATE_KEY)
  );
};

/**
 * Initialize Firebase Admin SDK
 * Supports two methods:
 * 1. Full service account JSON (recommended)
 * 2. Individual environment variables
 */
export const initializeFirebaseAdmin = (): admin.app.App => {
  if (firebaseAdmin) {
    return firebaseAdmin;
  }

  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured. Please set FIREBASE_SERVICE_ACCOUNT_JSON or individual Firebase environment variables.');
  }

  try {
    let credential: admin.credential.Credential;

    // Method 1: Use service account JSON (recommended)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON) as ServiceAccount;
      credential = admin.credential.cert(serviceAccount);
    } 
    // Method 2: Use individual environment variables
    else {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY;

      if (!projectId || !clientEmail || !privateKey) {
        throw new Error('Missing required Firebase environment variables');
      }

      // Process the private key to handle various formats and common issues
      const processedKey = privateKey
        .trim()
        .replace(/^["']|["']$/g, '')  // Remove surrounding quotes
        .replace(/\\n/g, '\n');        // Replace escaped newlines with actual newlines

      credential = admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: processedKey,
      });
    }

    firebaseAdmin = admin.initializeApp({
      credential,
    });

    console.log('✅ Firebase Admin initialized successfully');
    return firebaseAdmin;
  } catch (error: any) {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    throw new Error(`Firebase initialization failed: ${error.message}`);
  }
};

/**
 * Verify Firebase ID token
 */
export const verifyFirebaseToken = async (idToken: string): Promise<admin.auth.DecodedIdToken> => {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase authentication is not configured');
  }

  const app = initializeFirebaseAdmin();
  
  try {
    const decodedToken = await admin.auth(app).verifyIdToken(idToken);
    return decodedToken;
  } catch (error: any) {
    console.error('❌ Firebase token verification failed:', error.message);
    throw new Error('Invalid or expired Firebase ID token');
  }
};

/**
 * Get Firebase Admin app instance (may return null if not initialized)
 */
export const getFirebaseAdmin = (): admin.app.App | null => {
  return firebaseAdmin;
};