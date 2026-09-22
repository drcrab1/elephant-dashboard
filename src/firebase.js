import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';
import 'firebase/compat/messaging';
import 'firebase/compat/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
export const db = firebase.firestore();
export const storage = firebase.storage();
export const functions = firebase.app().functions('asia-northeast3');
// 푸시 알림(FCM)은 https 환경 + 서비스워커를 지원하는 브라우저에서만 사용 가능해서,
// 지원하지 않는 환경(예: 일부 인앱 브라우저)에서는 messaging이 null일 수 있습니다.
export const messaging = (() => {
  try {
    return firebase.messaging();
  } catch (e) {
    console.warn('이 브라우저는 푸시 알림을 지원하지 않습니다.', e);
    return null;
  }
})();
export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';
export const ADMIN_EMAIL = 's01025144826@gmail.com';
export default firebase;

