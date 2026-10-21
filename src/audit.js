import { functions } from './firebase';

// 접속·처리 기록(접속기록) 남기기 — 서버 함수가 계정·일시·접속지(IP)와 함께 저장합니다.
// 기록 실패가 화면 동작을 막지 않도록 조용히 처리하고, 같은 내용이 짧은 시간에 반복되면 한 번만 남깁니다.
const callLog = functions.httpsCallable('logAccess');
const recent = new Map();

export const logAccess = (action, detail = '', target = '') => {
    const key = `${action}|${detail}|${target}`;
    const now = Date.now();
    if (recent.has(key) && now - recent.get(key) < 5000) return;
    recent.set(key, now);
    callLog({ action, detail, target }).catch((e) => console.warn('접속기록 저장 실패', e && e.message));
};
