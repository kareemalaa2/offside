// Data: Firebase project settings. The apiKey is a public identifier, not a secret:
// access is protected by Firestore security rules (only allow-listed staff emails).
export const firebaseConfig = {
  apiKey: 'AIzaSyCKpFBI2BR4xjU8C7ahpMjJWDiSzN0FWoQ',
  authDomain: 'offside-shop.firebaseapp.com',
  projectId: 'offside-shop',
  storageBucket: 'offside-shop.firebasestorage.app',
  messagingSenderId: '585514452007',
  appId: '1:585514452007:web:97d76514a75462cc25ba02',
};

/** All devices share this one shop document. */
export const SHOP_ID = 'main';
