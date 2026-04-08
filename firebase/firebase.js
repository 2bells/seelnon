// BYPASS MODE: Set to true to disable Firebase integration
export const BYPASS_FIREBASE = true;

// Mock objects for bypass mode
export const app = {};
export const db = {};
export const auth = { 
  currentUser: null, 
  onAuthStateChanged: (cb) => {
    if (typeof cb === 'function') cb(null);
    return () => {};
  },
  signOut: async () => {}
};
export const googleProvider = {};

// Export common Firestore functions (Mocks)
export const collection = () => ({});
export const addDoc = async () => ({});
export const query = () => ({});
export const where = () => ({});
export const orderBy = () => ({});
export const onSnapshot = () => (() => {});
export const serverTimestamp = () => new Date();
export const signInWithPopup = async () => ({});
export const signOut = async () => ({});
export const getDocFromServer = async () => ({});
export const doc = () => ({});

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
  console.warn('Firebase is bypassed. Error ignored:', error);
}
