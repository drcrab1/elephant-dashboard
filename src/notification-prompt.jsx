import React, { useState, useEffect } from 'react';
import firebase, { db, messaging, VAPID_KEY } from './firebase';

// 푸시 알림 권한 안내 배너 — 첫 화면에 같이 뜨므로 알림 관리 화면(무거움)과 따로 둡니다.

// --- 알림 권한 요청 배너 (모든 사용자) ---
const NotificationPermissionPrompt = ({ user }) => {
    const [status, setStatus] = useState('idle'); // idle | asking | granted | denied | unsupported | dismissed
    const [dismissed, setDismissed] = useState(() => {
        try { return localStorage.getItem('notifPromptDismissed') === '1'; } catch (e) { return false; }
    });

    useEffect(() => {
        if (!messaging || typeof Notification === 'undefined') { setStatus('unsupported'); return; }
        if (Notification.permission === 'granted') setStatus('granted');
        else if (Notification.permission === 'denied') setStatus('denied');
    }, []);

    const registerToken = async () => {
        if (!messaging) return;
        setStatus('asking');
        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') { setStatus('denied'); return; }
            if (!VAPID_KEY) {
                console.warn('VITE_FIREBASE_VAPID_KEY가 설정되지 않아 알림 등록을 건너뜁니다.');
                setStatus('granted');
                return;
            }
            const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
            const token = await messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
            if (token) {
                await db.collection('users').doc(user.email).set({
                    fcmTokens: firebase.firestore.FieldValue.arrayUnion(token)
                }, { merge: true });
            }
            setStatus('granted');
        } catch (e) {
            console.error('알림 등록 실패', e);
            setStatus('denied');
        }
    };

    if (dismissed || status === 'granted' || status === 'unsupported') return null;

    return (
        <div className="fixed bottom-[80px] md:bottom-6 left-1/2 -translate-x-1/2 z-30 bg-ink text-white rounded-2xl shadow-xl px-5 py-4 flex items-center gap-4 max-w-[92vw] w-[420px] animate-fade-in">
            <span className="text-2xl shrink-0">🔔</span>
            <div className="flex-1 min-w-0">
                <p className="font-extrabold text-[14px]">알림을 받아보시겠어요?</p>
                <p className="text-[12px] text-gray-300 mt-0.5 leading-snug">TBM 체크 시간, 사고 보고, 중요 공지를 폰으로 바로 받을 수 있어요.</p>
            </div>
            <div className="flex flex-col gap-1.5 shrink-0">
                <button onClick={registerToken} disabled={status === 'asking'} className="bg-blue-600 hover:bg-blue-700 text-white text-[12.5px] font-extrabold px-3.5 py-2 rounded-xl transition-colors">
                    {status === 'asking' ? '요청 중...' : '알림 받기'}
                </button>
                <button
                    onClick={() => { setDismissed(true); try { localStorage.setItem('notifPromptDismissed', '1'); } catch (e) {} }}
                    className="text-gray-400 hover:text-white text-[12px] font-bold"
                >
                    나중에
                </button>
            </div>
        </div>
    );
};

export { NotificationPermissionPrompt };
