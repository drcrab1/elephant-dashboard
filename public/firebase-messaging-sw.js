/* eslint-disable no-undef */
// 백그라운드(앱을 안 보고 있을 때)에서도 푸시 알림을 받기 위한 서비스워커입니다.
// Firebase 웹 설정값은 비공개 키가 아니라 공개 식별자라서 여기 그대로 적어도 안전합니다.
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: 'AIzaSyASLqpX8LvjUHAAd9j9W_hn3u0_1mtRVtc',
    authDomain: 'elephant-logistics.firebaseapp.com',
    projectId: 'elephant-logistics',
    storageBucket: 'elephant-logistics.firebasestorage.app',
    messagingSenderId: '953117332232',
    appId: '1:953117332232:web:6d8f8bb95a9fa12e9e52bd'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || '코끼리물류 알림';
    const options = {
        body: payload.notification?.body || '',
        icon: '/favicon.svg',
        data: payload.data || {}
    };
    self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow('/');
        })
    );
});
