// BYPASS MODE: Set to true to disable Firebase integration
export const BYPASS_FIREBASE = true;

// Initialize Firebase (Conditional)
let app, db, auth, googleProvider;

if (!BYPASS_FIREBASE) {
  const { initializeApp } = await import('firebase/app');
  const { getAuth, GoogleAuthProvider } = await import('firebase/auth');
  const { getFirestore } = await import('firebase/firestore');
  const firebaseConfig = (await import('../firebase-applet-config.json')).default;

  app = initializeApp(firebaseConfig);
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
} else {
  // Mock objects for bypass mode
  app = {};
  db = {};
  auth = { currentUser: null, onAuthStateChanged: (cb) => cb(null) };
  googleProvider = {};
}

export { app, db, auth, googleProvider };

// Export common Firestore functions (Mocks if bypassed)
export const collection = BYPASS_FIREBASE ? () => ({}) : (await import('firebase/firestore')).collection;
export const addDoc = BYPASS_FIREBASE ? async () => ({}) : (await import('firebase/firestore')).addDoc;
export const query = BYPASS_FIREBASE ? () => ({}) : (await import('firebase/firestore')).query;
export const where = BYPASS_FIREBASE ? () => ({}) : (await import('firebase/firestore')).where;
export const orderBy = BYPASS_FIREBASE ? () => ({}) : (await import('firebase/firestore')).orderBy;
export const onSnapshot = BYPASS_FIREBASE ? () => (() => {}) : (await import('firebase/firestore')).onSnapshot;
export const serverTimestamp = BYPASS_FIREBASE ? () => new Date() : (await import('firebase/firestore')).serverTimestamp;
export const signInWithPopup = BYPASS_FIREBASE ? async () => ({}) : (await import('firebase/auth')).signInWithPopup;
export const signOut = BYPASS_FIREBASE ? async () => ({}) : (await import('firebase/auth')).signOut;
export const getDocFromServer = BYPASS_FIREBASE ? async () => ({}) : (await import('firebase/firestore')).getDocFromServer;
export const doc = BYPASS_FIREBASE ? () => ({}) : (await import('firebase/firestore')).doc;

// Test connection (Conditional)
if (!BYPASS_FIREBASE) {
  async function testConnection() {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error) {
      if(error instanceof Error && error.message.includes('the client is offline')) {
        console.error("Please check your Firebase configuration. ");
      }
    }
  }
  testConnection();
}

// Error handler helper
export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
};

export function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
