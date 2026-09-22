import React, { useState, useEffect } from 'react';
import firebase, { db, messaging, functions, VAPID_KEY, ADMIN_EMAIL } from './firebase';
import { Icons } from './ui-components';

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
        <div className="fixed bottom-[80px] md:bottom-6 left-1/2 -translate-x-1/2 z-30 bg-[#0F172A] text-white rounded-2xl shadow-xl px-5 py-4 flex items-center gap-4 max-w-[92vw] w-[420px] animate-fade-in">
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
                    className="text-gray-400 hover:text-white text-[11px] font-bold"
                >
                    나중에
                </button>
            </div>
        </div>
    );
};

// --- 알림 관리 (관리자 전용): TBM 알림 시각 설정 + 중요 공지 템플릿 발송 ---
const NotificationManagement = ({ user }) => {
    const isAdmin = user && user.email === ADMIN_EMAIL;
    const [tbmHour, setTbmHour] = useState(21);
    const [tbmMinute, setTbmMinute] = useState(0);
    const [savingTime, setSavingTime] = useState(false);

    const [templates, setTemplates] = useState([]);
    const [newTitle, setNewTitle] = useState('');
    const [newBody, setNewBody] = useState('');
    const [sendingId, setSendingId] = useState(null);
    const [tokenCount, setTokenCount] = useState(null);
    const [members, setMembers] = useState([]);
    const [pickerTemplate, setPickerTemplate] = useState(null); // 선택 발송 대상 고르는 중인 템플릿
    const [selectedEmails, setSelectedEmails] = useState(new Set());
    const [memberSearch, setMemberSearch] = useState('');

    useEffect(() => {
        if (!isAdmin) return;
        db.collection('settings').doc('notificationSettings').get().then(doc => {
            if (doc.exists) {
                const d = doc.data();
                if (typeof d.tbmHour === 'number') setTbmHour(d.tbmHour);
                if (typeof d.tbmMinute === 'number') setTbmMinute(d.tbmMinute);
            }
        }).catch(() => {});

        const unsub = db.collection('notificationTemplates').orderBy('createdAt', 'desc').onSnapshot(snap => {
            setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, () => {});

        db.collection('users').get().then(snap => {
            const list = snap.docs.map(d => ({ email: d.id, name: d.data().name || d.id, hasToken: (d.data().fcmTokens || []).length > 0 }));
            list.sort((a, b) => a.name.localeCompare(b.name));
            setMembers(list);
            setTokenCount(list.filter(m => m.hasToken).length);
        }).catch(() => {});

        return () => unsub();
    }, [isAdmin]);

    if (!isAdmin) {
        return (
            <main className="md:ml-[260px] ml-0 px-4 md:px-10 py-6 md:py-12 flex-1 relative bg-[#F4F7FB] min-h-[100vh] flex items-center justify-center">
                <p className="text-gray-400 font-bold">이 화면은 관리자 전용입니다.</p>
            </main>
        );
    }

    const saveTbmTime = async () => {
        setSavingTime(true);
        try {
            await db.collection('settings').doc('notificationSettings').set({ tbmHour: Number(tbmHour), tbmMinute: Number(tbmMinute) }, { merge: true });
            alert('TBM 알림 시각이 저장되었습니다.');
        } catch (e) {
            alert('저장 실패: ' + e.message);
        } finally {
            setSavingTime(false);
        }
    };

    const addTemplate = async () => {
        if (!newTitle.trim() || !newBody.trim()) return alert('제목과 내용을 모두 입력해주세요.');
        try {
            await db.collection('notificationTemplates').add({
                title: newTitle.trim(),
                body: newBody.trim(),
                createdAt: new Date().toISOString()
            });
            setNewTitle('');
            setNewBody('');
        } catch (e) {
            alert('저장 실패: ' + e.message);
        }
    };

    const deleteTemplate = async (id) => {
        if (!window.confirm('이 공지 템플릿을 삭제하시겠습니까?')) return;
        try { await db.collection('notificationTemplates').doc(id).delete(); } catch (e) { alert('삭제 실패: ' + e.message); }
    };

    const sendTemplate = async (tpl, emails) => {
        const targetLabel = emails ? `선택한 ${emails.length}명에게` : '전체 가입자에게';
        if (!window.confirm(`"${tpl.title}" 공지를 ${targetLabel} 지금 발송할까요?`)) return;
        setSendingId(tpl.id);
        try {
            const fn = functions.httpsCallable('sendImportantNotice');
            const payload = emails ? { title: tpl.title, body: tpl.body, emails } : { title: tpl.title, body: tpl.body };
            const res = await fn(payload);
            alert(`발송 완료: ${res.data?.successCount ?? 0}명에게 전송됨`);
            setPickerTemplate(null);
            setSelectedEmails(new Set());
        } catch (e) {
            console.error(e);
            alert('발송 실패: ' + e.message + '\n(Cloud Functions 배포가 아직 안 되어 있을 수 있어요)');
        } finally {
            setSendingId(null);
        }
    };

    const openPicker = (tpl) => {
        setPickerTemplate(tpl);
        setSelectedEmails(new Set());
        setMemberSearch('');
    };

    const toggleMember = (email) => {
        setSelectedEmails(prev => {
            const next = new Set(prev);
            if (next.has(email)) next.delete(email); else next.add(email);
            return next;
        });
    };

    const filteredMembers = members.filter(m => !memberSearch.trim() || m.name.toLowerCase().includes(memberSearch.trim().toLowerCase()) || m.email.toLowerCase().includes(memberSearch.trim().toLowerCase()));

    return (
        <main className="md:ml-[260px] ml-0 px-4 md:px-10 py-6 md:py-12 flex-1 relative bg-[#F4F7FB] min-h-[100vh]">
            <header className="mb-8 w-full border-b pb-6 border-gray-200">
                <h2 className="text-[28px] font-extrabold mb-2 text-[#1E293B] flex items-center gap-2">🔔 알림 관리</h2>
                <p className="text-gray-500 text-[15px] font-medium">
                    출근일 기사님께 자동으로 가는 TBM 알림 시각을 설정하고, 중요 공지를 전체 가입자에게 보낼 수 있어요.
                    {tokenCount !== null && <span className="ml-2 text-blue-600 font-bold">(알림 등록된 인원: {tokenCount}명)</span>}
                </p>
            </header>

            <div className="max-w-[720px] space-y-8">
                {/* TBM 알림 시각 설정 */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="font-extrabold text-[16px] text-[#0F172A] mb-1">매일 자동 TBM 알림 시각</h3>
                    <p className="text-[13px] text-gray-500 font-medium mb-4">이 시각이 되면, 오늘 스케줄에 배차된 기사님께만 자동으로 TBM 체크 알림이 갑니다.</p>
                    <div className="flex flex-wrap items-center gap-3">
                        <select value={tbmHour} onChange={e => setTbmHour(e.target.value)} className="border border-gray-200 rounded-xl px-4 py-2.5 font-bold bg-gray-50 outline-none focus:border-blue-500">
                            {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}시</option>)}
                        </select>
                        <select value={tbmMinute} onChange={e => setTbmMinute(e.target.value)} className="border border-gray-200 rounded-xl px-4 py-2.5 font-bold bg-gray-50 outline-none focus:border-blue-500">
                            {[0, 10, 20, 30, 40, 50].map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}분</option>)}
                        </select>
                        <button onClick={saveTbmTime} disabled={savingTime} className="bg-[#2E68ED] hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-sm transition-colors">
                            {savingTime ? '저장 중...' : '저장'}
                        </button>
                    </div>
                </div>

                {/* 중요 공지 템플릿 */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="font-extrabold text-[16px] text-[#0F172A] mb-1">중요 공지 템플릿</h3>
                    <p className="text-[13px] text-gray-500 font-medium mb-4">자주 쓰는 공지를 미리 저장해두고, 필요할 때 눌러서 전체 가입자에게 즉시 발송하세요.</p>

                    <div className="space-y-3 mb-5">
                        <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="제목 (예: 폭우 주의)" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 font-bold outline-none focus:border-blue-500 bg-gray-50" />
                        <textarea value={newBody} onChange={e => setNewBody(e.target.value)} placeholder="내용 (예: 오늘 오후 폭우 예보로 서행 운전 부탁드립니다.)" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 font-medium outline-none focus:border-blue-500 bg-gray-50 min-h-[70px] resize-y" />
                        <button onClick={addTemplate} className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold px-4 py-2 rounded-xl text-sm shadow-sm">+ 템플릿 저장</button>
                    </div>

                    <div className="space-y-3">
                        {templates.length === 0 ? (
                            <p className="text-center text-gray-400 font-bold text-sm py-8">저장된 템플릿이 없습니다.</p>
                        ) : templates.map(tpl => (
                            <div key={tpl.id} className="border border-gray-100 rounded-xl p-4 flex items-start justify-between gap-3 bg-[#FAFBFC]">
                                <div className="min-w-0">
                                    <p className="font-bold text-[14px] text-gray-900">{tpl.title}</p>
                                    <p className="text-[12.5px] text-gray-500 mt-1 leading-snug whitespace-pre-line">{tpl.body}</p>
                                </div>
                                <div className="flex flex-col gap-2 shrink-0">
                                    <button onClick={() => sendTemplate(tpl)} disabled={sendingId === tpl.id} className="bg-red-600 hover:bg-red-700 text-white text-[12px] font-extrabold px-3.5 py-2 rounded-lg shadow-sm transition-colors whitespace-nowrap">
                                        {sendingId === tpl.id ? '발송 중...' : '📢 전체 발송'}
                                    </button>
                                    <button onClick={() => openPicker(tpl)} disabled={sendingId === tpl.id} className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[12px] font-extrabold px-3.5 py-2 rounded-lg shadow-sm transition-colors whitespace-nowrap">
                                        🎯 선택 발송
                                    </button>
                                    <button onClick={() => deleteTemplate(tpl.id)} className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-400 text-[12px] font-bold px-3 py-2 rounded-lg">삭제</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {pickerTemplate && (
                <div className="fixed inset-0 z-50 bg-[#0F172A]/40 backdrop-blur-sm flex justify-center items-center py-10 px-4">
                    <div className="bg-white rounded-[24px] w-full max-w-[440px] max-h-[85vh] overflow-hidden shadow-2xl animate-fade-in flex flex-col">
                        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-start bg-[#f8fafc] shrink-0">
                            <div>
                                <h3 className="text-[17px] font-extrabold text-[#0F172A]">받을 사람 선택</h3>
                                <p className="text-[12.5px] text-gray-500 font-medium mt-1">"{pickerTemplate.title}" 공지를 보낼 사람을 골라주세요.</p>
                            </div>
                            <button onClick={() => setPickerTemplate(null)} className="text-gray-400 hover:text-black font-extrabold text-2xl leading-none">&times;</button>
                        </div>
                        <div className="px-6 py-3 border-b border-gray-100 shrink-0">
                            <input
                                type="text"
                                value={memberSearch}
                                onChange={e => setMemberSearch(e.target.value)}
                                placeholder="이름, 이메일 검색"
                                className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-[13.5px] font-medium outline-none focus:border-blue-500 bg-gray-50"
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto px-3 py-2">
                            {filteredMembers.length === 0 ? (
                                <p className="text-center text-gray-400 font-bold text-sm py-8">가입자가 없습니다.</p>
                            ) : filteredMembers.map(m => (
                                <label key={m.email} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 cursor-pointer">
                                    <input type="checkbox" checked={selectedEmails.has(m.email)} onChange={() => toggleMember(m.email)} className="w-4 h-4 accent-blue-600" />
                                    <span className="font-bold text-[14px] text-gray-800">{m.name}</span>
                                    <span className="text-[11.5px] text-gray-400 truncate">{m.email}</span>
                                    {!m.hasToken && <span className="ml-auto text-[10px] text-amber-600 font-bold shrink-0">알림 미등록</span>}
                                </label>
                            ))}
                        </div>
                        <div className="p-5 pt-3 border-t border-gray-100 shrink-0 flex gap-3">
                            <button onClick={() => setPickerTemplate(null)} className="flex-1 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl text-sm">취소</button>
                            <button
                                onClick={() => sendTemplate(pickerTemplate, Array.from(selectedEmails))}
                                disabled={selectedEmails.size === 0 || sendingId === pickerTemplate.id}
                                className="flex-[2] py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-extrabold rounded-xl text-sm shadow-sm transition-colors"
                            >
                                {sendingId === pickerTemplate.id ? '발송 중...' : `선택한 ${selectedEmails.size}명에게 발송`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
};

export { NotificationPermissionPrompt, NotificationManagement };
