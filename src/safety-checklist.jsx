import { notify, confirmDialog } from './ui-feedback';
import React, { useState, useEffect } from 'react';
import firebase, { db } from './firebase';
import { SAFETY_RECURRING_TASKS, PERIOD_LABEL, FREQ_META, getPeriodKey, getDaysLeftInPeriod, URGENT_THRESHOLD, getTodaysTbmTopic } from './safety-constants';

// 마지막으로 입력한 차량번호를 이 기기에 기억해 둡니다. (다음 점검 때 다시 치지 않도록)
const vehicleNumberKey = (email) => `elephant:lastVehicleNumber:${email}`;
const readSavedVehicleNumber = (email) => { try { return localStorage.getItem(vehicleNumberKey(email)) || ''; } catch { return ''; } };
const saveVehicleNumber = (email, value) => { try { if (value) localStorage.setItem(vehicleNumberKey(email), value); } catch { /* 저장 불가 환경은 무시 */ } };

const PerUserTaskRow = ({ task, user, allLogs, onLogged }) => {
    const freq = task.freq;
    const now = new Date();
    const currentPeriod = getPeriodKey(freq, now);
    const tbmTopic = task.id === 'tbm' ? getTodaysTbmTopic() : null;
    const [note, setNote] = useState(() => tbmTopic ? `${tbmTopic.target}: ${tbmTopic.hazard.split('\n')[0]}` : '');
    const [saving, setSaving] = useState(false);

    const myLog = allLogs.find(l => l.taskId === task.id && l.periodKey === currentPeriod && l.email === user.email);
    const otherNames = allLogs.filter(l => l.taskId === task.id && l.periodKey === currentPeriod && l.email !== user.email).map(l => l.name);
    const daysLeft = getDaysLeftInPeriod(freq, now);
    const isUrgent = !myLog && daysLeft <= URGENT_THRESHOLD[freq];
    const periodLabel = PERIOD_LABEL[freq];

    const handleCheck = async () => {
        setSaving(true);
        const todayStr = new Date().toISOString().split('T')[0];
        const docId = `${currentPeriod}_${task.id}_${user.email}`;
        const entry = { taskId: task.id, freq, periodKey: currentPeriod, date: todayStr, email: user.email, name: user.name, note: note.trim(), timestamp: new Date().toISOString() };
        try {
            await db.collection('safetyChecklistLogs').doc(docId).set(entry);
            onLogged(entry);
        } catch (e) {
            console.error(e);
            notify('저장 실패: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleUndo = async () => {
        if (!myLog) return;
        if (!await confirmDialog('완료 체크를 취소하시겠습니까? 잘못 누르셨을 때만 사용해주세요.')) return;
        setSaving(true);
        try {
            const docId = `${currentPeriod}_${task.id}_${user.email}`;
            await db.collection('safetyChecklistLogs').doc(docId).delete();
            // allLogs는 실시간 구독 중이라 별도 처리 없이도 곧 자동 반영됩니다.
        } catch (e) {
            console.error(e);
            notify('취소 실패: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={`rounded-xl p-3 border ${myLog ? 'bg-green-50/60 border-green-100' : isUrgent ? 'bg-red-50/70 border-red-200' : 'bg-white border-gray-100'}`}>
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <p className={`text-[15px] font-bold leading-tight ${myLog ? 'text-green-700' : isUrgent ? 'text-red-600' : 'text-gray-800'}`}>{task.title}</p>
                    <p className="text-[13px] text-gray-400 font-medium mt-1 leading-snug">{task.desc}</p>
                    {tbmTopic && (
                        <div className="mt-2 p-2 rounded-lg bg-blue-50 border border-blue-100">
                            <p className="text-[12px] font-extrabold text-blue-600">오늘의 안전 주제 · {tbmTopic.target}</p>
                            <p className="text-[13px] text-gray-700 font-medium mt-0.5 leading-snug whitespace-pre-line">{tbmTopic.hazard}</p>
                        </div>
                    )}
                    {myLog ? (
                        <div className="mt-1.5">
                            <p className="text-[12px] text-gray-500 font-bold">내가 {periodLabel} {myLog.date} {myLog.timestamp.slice(11, 16)}에 완료</p>
                            {myLog.note && <p className="text-[12.5px] text-gray-600 mt-1 bg-white/70 rounded px-2 py-1 border border-green-100">📝 {myLog.note}</p>}
                        </div>
                    ) : (
                        <input
                            type="text"
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder={`${periodLabel} 전달사항 (선택)`}
                            className="mt-2 w-full text-[14px] border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-blue-400 bg-white"
                        />
                    )}
                    {otherNames.length > 0 && (
                        <p className="text-[12px] text-gray-400 font-bold mt-1.5">{periodLabel} 완료한 다른 사람: {otherNames.join(', ')}</p>
                    )}
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1.5">
                    <button
                        onClick={handleCheck}
                        disabled={!!myLog || saving}
                        className={`px-3.5 py-2.5 rounded-xl text-[13.5px] font-extrabold shadow-sm min-w-[84px] transition-colors ${myLog ? 'bg-green-100 text-green-700 cursor-default' : 'bg-brand text-white hover:bg-blue-700'}`}
                    >
                        {myLog ? '✓ 완료' : (saving ? '저장중...' : '완료 체크')}
                    </button>
                    {myLog && (
                        <button onClick={handleUndo} disabled={saving} className="text-[12px] font-bold text-gray-400 hover:text-red-500 underline decoration-dotted">
                            잘못 눌렀어요, 취소
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- 일일 자동차 안전점검표 (법정 서식) ---
const VEHICLE_INSPECTION_ITEMS = [
    { category: '외관점검', label: '번호판, 전면유리, 후사경 등의 청결상태' },
    { category: '외관점검', label: '후미등, 차폭등 등 등화장치 작동상태' },
    { category: '외관점검', label: '창닦이기 작동상태' },
    { category: '외관점검', label: '적재함(보조지지대 포함), 측면 보호대, 후부반사판, 트레일러 연결장치의 부착상태 및 훼손 여부' },
    { category: '상태점검', label: '타이어 손상 및 마모(1.6mm 이상) 여부' },
    { category: '상태점검', label: '화물, 적재함 지지대(판스프링) 등의 고정상태' },
    { category: '상태점검', label: '바퀴 너트 등 균열 여부' },
    { category: '상태점검', label: '냉각수, 공기압, 엔진오일 등 차량 이상 여부(계기판 확인)' },
    { category: '기타', label: '좌석안전띠 상태' },
    { category: '기타', label: '소화기 비치 여부' },
    { category: '기타', label: '안전삼각대 등 비치 여부' }
];
const RESULT_OPTS = [
    { v: 'O', label: '양호', cls: 'bg-green-600 text-white border-green-600' },
    { v: 'X', label: '불량', cls: 'bg-red-600 text-white border-red-600' },
    { v: '미', label: '미운행', cls: 'bg-gray-500 text-white border-gray-500' }
];

const VehicleInspectionModal = ({ user, defaultVehicleNumber, onClose, onSubmit }) => {
    const [vehicleNumber, setVehicleNumber] = useState(defaultVehicleNumber || '');
    const [results, setResults] = useState(() => VEHICLE_INSPECTION_ITEMS.map(() => 'O'));
    const [actionNote, setActionNote] = useState('');
    const [saving, setSaving] = useState(false);

    const hasDefect = results.some(r => r === 'X');
    const okCount = results.filter(r => r === 'O').length;
    const defectCount = results.filter(r => r === 'X').length;
    const skipCount = results.filter(r => r === '미').length;

    const setResult = (idx, v) => setResults(prev => prev.map((r, i) => i === idx ? v : r));

    const handleSubmit = async () => {
        if (!vehicleNumber.trim()) return notify('차량번호를 입력해주세요.');
        if (hasDefect && !actionNote.trim()) return notify('불량 항목이 있어요. 조치 기록을 입력해주세요.');
        setSaving(true);
        try {
            await onSubmit({ vehicleNumber: vehicleNumber.trim(), results, actionNote: actionNote.trim(), okCount, defectCount, skipCount });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 ui-overlay">
            <div className="bg-white rounded-[24px] w-full max-w-[520px] max-h-[90vh] overflow-hidden shadow-2xl animate-fade-in flex flex-col">
                <div className="px-6 py-5 border-b border-gray-100 bg-soft flex justify-between items-start shrink-0">
                    <div>
                        <h3 className="text-[18px] font-extrabold text-ink">일일 자동차 안전점검표</h3>
                        <p className="text-[13.5px] text-gray-500 font-medium mt-1">기본값은 전부 "양호"예요. 문제 있는 항목만 눌러서 바꿔주세요.</p>
                    </div>
                    <button type="button" aria-label="닫기" onClick={onClose} className="ui-close">&times;</button>
                </div>

                <div className="px-6 py-4 border-b border-gray-100 shrink-0">
                    <label className="text-[13.5px] font-bold text-gray-600 mb-1.5 block">차량번호</label>
                    <input type="text" value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} placeholder="예: 12가 3456" className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-[14px] font-bold outline-none focus:border-blue-500 bg-gray-50" />
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5">
                    {VEHICLE_INSPECTION_ITEMS.map((item, idx) => (
                        <div key={idx} className={`rounded-xl border p-3 ${results[idx] === 'X' ? 'bg-red-50/60 border-red-200' : 'bg-soft border-gray-100'}`}>
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <span className="text-[12px] font-extrabold text-gray-400">{item.category}</span>
                                    <p className="text-[13.5px] font-bold text-gray-800 leading-snug">{item.label}</p>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                    {RESULT_OPTS.map(opt => (
                                        <button
                                            key={opt.v}
                                            onClick={() => setResult(idx, opt.v)}
                                            className={`w-11 h-8 rounded-lg text-[12.5px] font-extrabold border transition-colors ${results[idx] === opt.v ? opt.cls : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'}`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}

                    {hasDefect && (
                        <div className="mt-2">
                            <label className="text-[13.5px] font-bold text-red-600 mb-1.5 block">불량상태 조치 기록 <span className="text-red-500">*</span></label>
                            <textarea value={actionNote} onChange={e => setActionNote(e.target.value)} placeholder="예: 창닦이기 불량 → 9/22 교체 완료" className="w-full border border-red-200 rounded-xl px-3.5 py-2.5 text-[14px] font-medium outline-none focus:border-red-400 bg-red-50/30 min-h-[70px] resize-y" />
                        </div>
                    )}
                </div>

                <div className="p-5 border-t border-gray-100 bg-soft shrink-0 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl text-sm">취소</button>
                    <button onClick={handleSubmit} disabled={saving} className="flex-[2] py-3 bg-brand hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold rounded-xl text-sm shadow-sm transition-colors">
                        {saving ? '저장 중...' : `점검 완료 제출 (양호 ${okCount} · 불량 ${defectCount} · 미운행 ${skipCount})`}
                    </button>
                </div>
            </div>
        </div>
    );
};

const VehicleInspectionTaskRow = ({ task, user, allLogs, onLogged }) => {
    const currentPeriod = getPeriodKey('daily');
    const [showModal, setShowModal] = useState(false);
    const [showDetail, setShowDetail] = useState(false);

    const myLog = allLogs.find(l => l.taskId === task.id && l.periodKey === currentPeriod && l.email === user.email);
    const otherLogs = allLogs.filter(l => l.taskId === task.id && l.periodKey === currentPeriod && l.email !== user.email);
    const isUrgent = !myLog;

    // 마지막으로 입력했던 차량번호를 기본값으로 (편의성)
    const lastMyLog = allLogs.filter(l => l.taskId === task.id && l.email === user.email && l.vehicleNumber).sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))[0];

    const handleSubmit = async ({ vehicleNumber, results, actionNote, okCount, defectCount, skipCount }) => {
        const todayStr = new Date().toISOString().split('T')[0];
        const docId = `${currentPeriod}_${task.id}_${user.email}`;
        const note = defectCount > 0
            ? `차량 ${vehicleNumber} · 불량 ${defectCount}건: ${actionNote}`
            : `차량 ${vehicleNumber} · 전항목 양호 (${okCount}개${skipCount > 0 ? `, 미운행 ${skipCount}개` : ''})`;
        const entry = {
            taskId: task.id, freq: 'daily', periodKey: currentPeriod, date: todayStr,
            email: user.email, name: user.name, timestamp: new Date().toISOString(),
            note, vehicleNumber,
            items: VEHICLE_INSPECTION_ITEMS.map((item, idx) => ({ label: item.label, result: results[idx] })),
            actionNote, okCount, defectCount, skipCount
        };
        try {
            await db.collection('safetyChecklistLogs').doc(docId).set(entry);
            saveVehicleNumber(user.email, vehicleNumber);
            onLogged(entry);
            setShowModal(false);
        } catch (e) {
            console.error(e);
            notify('저장 실패: ' + e.message);
        }
    };

    return (
        <div className={`rounded-xl p-3 border ${myLog ? 'bg-green-50/60 border-green-100' : isUrgent ? 'bg-red-50/70 border-red-200' : 'bg-white border-gray-100'}`}>
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <p className={`text-[15px] font-bold leading-tight ${myLog ? 'text-green-700' : 'text-red-600'}`}>{task.title}</p>
                    <p className="text-[13px] text-gray-400 font-medium mt-1 leading-snug">{task.desc}</p>
                    {myLog ? (
                        <div className="mt-1.5">
                            <p className="text-[12px] text-gray-500 font-bold">내가 오늘 {myLog.timestamp.slice(11, 16)}에 완료</p>
                            <p className={`text-[12.5px] mt-1 rounded px-2 py-1 border ${myLog.defectCount > 0 ? 'bg-red-50 text-red-700 border-red-100' : 'bg-white/70 text-gray-600 border-green-100'}`}>📝 {myLog.note}</p>
                            {myLog.items && (
                                <button onClick={() => setShowDetail(v => !v)} className="text-[12px] text-blue-600 font-bold mt-1 hover:underline">{showDetail ? '상세 접기' : '11개 항목 상세보기'}</button>
                            )}
                            {showDetail && myLog.items && (
                                <div className="mt-1.5 bg-white rounded-lg border border-gray-100 divide-y divide-gray-50">
                                    {myLog.items.map((it, idx) => (
                                        <div key={idx} className="flex items-center justify-between gap-2 px-2 py-1.5">
                                            <span className="text-[12px] text-gray-600 leading-snug">{it.label}</span>
                                            <span className={`shrink-0 text-[12px] font-extrabold px-1.5 py-0.5 rounded ${it.result === 'X' ? 'bg-red-100 text-red-700' : it.result === '미' ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'}`}>{it.result === 'O' ? '양호' : it.result === 'X' ? '불량' : '미운행'}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-[12.5px] text-red-500 font-bold mt-1.5">오늘 아직 점검 전이에요</p>
                    )}
                    {otherLogs.length > 0 && (
                        <p className="text-[12px] text-gray-400 font-bold mt-1.5">오늘 완료한 다른 사람: {otherLogs.map(l => l.name).join(', ')}</p>
                    )}
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    disabled={!!myLog}
                    className={`shrink-0 px-3.5 py-2.5 rounded-xl text-[13.5px] font-extrabold shadow-sm min-w-[84px] transition-colors ${myLog ? 'bg-green-100 text-green-700 cursor-default' : 'bg-brand text-white hover:bg-blue-700'}`}
                >
                    {myLog ? '✓ 완료' : '점검하기'}
                </button>
            </div>
            {showModal && (
                <VehicleInspectionModal
                    user={user}
                    defaultVehicleNumber={lastMyLog?.vehicleNumber}
                    onClose={() => setShowModal(false)}
                    onSubmit={handleSubmit}
                />
            )}
        </div>
    );
};

const SafetyRecurringChecklist = ({ user }) => {
    const isAdmin = user && user.email === 's01025144826@gmail.com';
    const [lastDoneMap, setLastDoneMap] = useState({});
    const [allLogs, setAllLogs] = useState([]);
    const [historyTaskFilter, setHistoryTaskFilter] = useState('all');
    const [historyVisible, setHistoryVisible] = useState(10);
    const [allUsers, setAllUsers] = useState([]);
    const [historyLimit, setHistoryLimit] = useState(300); // 관리자 "지난 체크 기록"에서 불러오는 최근 기록 수
    const [hasOlderLogs, setHasOlderLogs] = useState(false);
    const [extraLogs, setExtraLogs] = useState(() => {
        const cached = readSavedVehicleNumber(user.email);
        return cached ? [{ taskId: 'vehicle_inspection', email: user.email, vehicleNumber: cached, periodKey: '', timestamp: '' }] : [];
    });
    // 오늘·이번 주·이번 달·올해를 가리키는 키 (날짜가 바뀌면 구독도 새로 맞춥니다)
    const periodKeysText = Array.from(new Set(['daily', 'weekly', 'monthly', 'yearly'].map(f => getPeriodKey(f)))).join('|');

    useEffect(() => {
        db.collection('settings').doc('safetyRecurringChecklist').get().then(doc => {
            if (doc.exists) setLastDoneMap(doc.data() || {});
        }).catch(() => {});

        // 체크 기록은 매일 쌓이므로 전체를 통째로 받지 않고 지금 필요한 것만 받습니다.
        // (1) 오늘·이번 주·이번 달·올해 기록(모든 사람) — 완료 여부 표시용, 다른 사람이 체크하면 바로 반영
        // (2) 관리자만: 최근 기록 — "지난 체크 기록" 표용
        const logsRef = db.collection('safetyChecklistLogs');
        let periodLogs = [];
        let recentLogs = [];
        const mergeLogs = () => {
            const merged = new Map();
            [...recentLogs, ...periodLogs].forEach(l => merged.set(`${l.periodKey}_${l.taskId}_${l.email}`, l));
            setAllLogs(Array.from(merged.values()));
        };
        const unsubLogs = logsRef.where('periodKey', 'in', periodKeysText.split('|')).onSnapshot(snap => {
            periodLogs = snap.docs.map(d => d.data());
            mergeLogs();
        }, e => console.error(e));

        let unsubRecent = null;
        let unsubUsers = null;
        if (isAdmin) {
            unsubRecent = logsRef.orderBy('timestamp', 'desc').limit(historyLimit).onSnapshot(snap => {
                recentLogs = snap.docs.map(d => d.data());
                setHasOlderLogs(snap.size >= historyLimit);
                mergeLogs();
            }, e => console.error(e));
            unsubUsers = db.collection('users').onSnapshot(snap => {
                setAllUsers(snap.docs.map(d => ({ email: d.id, ...d.data() })));
            }, e => console.error(e));
        }

        return () => { unsubLogs(); if (unsubRecent) unsubRecent(); if (unsubUsers) unsubUsers(); };
    }, [isAdmin, historyLimit, periodKeysText]);

    // 차량번호 기본값: 이 기기에 기억해 둔 번호가 있으면 그것을 쓰고, 없을 때만 내 지난 점검 기록에서 한 번 찾아옵니다.
    useEffect(() => {
        if (extraLogs.length > 0) return;
        db.collection('safetyChecklistLogs').where('email', '==', user.email).where('taskId', '==', 'vehicle_inspection').get()
            .then(snap => { if (!snap.empty) setExtraLogs(snap.docs.map(d => d.data())); })
            .catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user.email]);

    const addLog = (entry) => {
        setAllLogs(prev => [...prev.filter(l => !(l.taskId === entry.taskId && l.email === entry.email && l.periodKey === entry.periodKey)), entry]);
    };

    const markDone = async (taskId) => {
        const todayStr = new Date().toISOString().split('T')[0];
        const updated = { ...lastDoneMap, [taskId]: todayStr };
        setLastDoneMap(updated);
        try {
            await db.collection('settings').doc('safetyRecurringChecklist').set({ [taskId]: todayStr }, { merge: true });
        } catch (e) {
            console.error('체크리스트 저장 실패', e);
        }
    };

    const undoMarkDone = async (taskId) => {
        if (!await confirmDialog('완료 체크를 취소하시겠습니까? 잘못 누르셨을 때만 사용해주세요.')) return;
        const updated = { ...lastDoneMap };
        delete updated[taskId];
        setLastDoneMap(updated);
        try {
            await db.collection('settings').doc('safetyRecurringChecklist').set({ [taskId]: firebase.firestore.FieldValue.delete() }, { merge: true });
        } catch (e) {
            console.error('체크리스트 취소 실패', e);
        }
    };

    const now = new Date();
    const freqOrder = ['daily', 'weekly', 'monthly', 'yearly'];

    return (
        <div className="mb-8 bg-white rounded-[20px] border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-4 md:p-6">
            <div className="mb-3">
                <h3 className="text-[18px] font-extrabold text-ink">정기 안전보건 체크리스트</h3>
                <p className="text-[14px] text-gray-500 font-medium mt-0.5">해야 할 점검을 주기별로 모았습니다. 끝낸 것은 초록색으로 바뀝니다.</p>
            </div>
            {/* 매일 쓰는 화면이라 점검 항목이 먼저 보이도록, 안내 글은 한 줄로 줄이고 눌러서 펼칩니다 */}
            <details className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-4 group">
                <summary className="flex items-start gap-2 cursor-pointer list-none text-[14px] font-extrabold text-amber-800">
                    <span className="shrink-0" aria-hidden="true">⚠️</span>
                    <span className="flex-1">매일 점검은 법으로 정해진 의무이고, 사고가 났을 때 나를 지켜주는 기록입니다.</span>
                    <span className="shrink-0 text-[12.5px] font-bold text-amber-600 underline decoration-dotted whitespace-nowrap">자세히</span>
                </summary>
                <p className="text-[13.5px] text-amber-700/90 font-medium leading-relaxed mt-2">타이어 공기압, 브레이크, 전조등 같은 작은 이상도 운행 중 큰 사고로 이어질 수 있습니다. 일일 안전점검은 사업주와 운전자 모두에게 법으로 정해진 의무이기도 하고, 매일 남긴 기록은 만에 하나 사고가 났을 때 본인을 지켜주는 증빙 자료가 됩니다. 30초면 끝나니 절대 거르지 말아주세요.</p>
            </details>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {freqOrder.map(freq => {
                    const tasks = SAFETY_RECURRING_TASKS.filter(t => t.freq === freq);
                    const meta = FREQ_META[freq];
                    return (
                        <div key={freq} className="border border-gray-100 rounded-2xl p-4 bg-soft">
                            <span className={`inline-block px-2.5 py-1 rounded-lg text-[13px] font-extrabold border ${meta.color} mb-3`}>{meta.label}</span>
                            <div className="space-y-3">
                                {tasks.filter(t => t.perUser).map(task => (
                                    task.id === 'vehicle_inspection'
                                        ? <VehicleInspectionTaskRow key={task.id} task={task} user={user} allLogs={[...allLogs, ...extraLogs]} onLogged={addLog} />
                                        : <PerUserTaskRow key={task.id} task={task} user={user} allLogs={allLogs} onLogged={addLog} />
                                ))}
                                {/* 회사 단위로 한 번만 하면 되는 일(소방시설 점검, 위험성평가 등)은 관리자에게만 보입니다 */}
                                {isAdmin && tasks.filter(t => !t.perUser).map(task => {
                                    const currentPeriod = getPeriodKey(freq, now);
                                    const lastDone = lastDoneMap[task.id];
                                    const lastDonePeriod = lastDone ? getPeriodKey(freq, new Date(lastDone)) : null;
                                    const isDone = lastDonePeriod === currentPeriod;
                                    const daysLeft = getDaysLeftInPeriod(freq, now);
                                    const isUrgent = !isDone && daysLeft <= URGENT_THRESHOLD[freq];
                                    return (
                                        <div key={task.id} className={`rounded-xl p-3 border ${isDone ? 'bg-green-50/60 border-green-100' : isUrgent ? 'bg-red-50/70 border-red-200' : 'bg-white border-gray-100'}`}>
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className={`text-[15px] font-bold leading-tight ${isDone ? 'text-green-700' : isUrgent ? 'text-red-600' : 'text-gray-800'}`}>{task.title}</p>
                                                    <p className="text-[13px] text-gray-400 font-medium mt-1 leading-snug">{task.desc}</p>
                                                    <p className="text-[12px] text-gray-400 font-bold mt-1.5">{lastDone ? `최근 완료: ${lastDone}` : '완료 기록 없음'}</p>
                                                </div>
                                                <div className="shrink-0 flex flex-col items-end gap-1.5">
                                                    <button
                                                        onClick={() => markDone(task.id)}
                                                        disabled={isDone}
                                                        className={`px-3.5 py-2.5 rounded-xl text-[13.5px] font-extrabold shadow-sm min-w-[84px] transition-colors ${isDone ? 'bg-green-100 text-green-700 cursor-default' : 'bg-brand text-white hover:bg-blue-700'}`}
                                                    >
                                                        {isDone ? '✓ 완료' : '완료 체크'}
                                                    </button>
                                                    {isDone && (
                                                        <button onClick={() => undoMarkDone(task.id)} className="text-[12px] font-bold text-gray-400 hover:text-red-500 underline decoration-dotted">
                                                            잘못 눌렀어요, 취소
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {isAdmin && (() => {
                const healthYearKey = getPeriodKey('yearly', now);
                const healthCompletedEmails = new Set(allLogs.filter(l => l.taskId === 'yearly_health' && l.periodKey === healthYearKey).map(l => l.email));
                const healthCompleted = allUsers.filter(u => healthCompletedEmails.has(u.email));
                const healthNotCompleted = allUsers.filter(u => !healthCompletedEmails.has(u.email));
                return (
                    <div className="mt-6 pt-6 border-t border-gray-100">
                        <h4 className="text-[15px] font-extrabold text-ink mb-3">{healthYearKey}년 건강검진 현황 (관리자)</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="rounded-2xl border border-green-100 bg-green-50/50 p-4">
                                <p className="text-[14px] font-extrabold text-green-700 mb-2">✅ 완료자 ({healthCompleted.length}명)</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {healthCompleted.length === 0 ? <span className="text-[13px] text-gray-400 font-medium">아직 없습니다.</span> :
                                        healthCompleted.map(u => <span key={u.email} className="px-2.5 py-1 rounded-lg bg-white border border-green-200 text-green-700 text-[13px] font-bold">{u.name}</span>)}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-red-100 bg-red-50/50 p-4">
                                <p className="text-[14px] font-extrabold text-red-600 mb-2">⏳ 미완료자 ({healthNotCompleted.length}명)</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {healthNotCompleted.length === 0 ? <span className="text-[13px] text-gray-400 font-medium">전원 완료했습니다!</span> :
                                        healthNotCompleted.map(u => <span key={u.email} className="px-2.5 py-1 rounded-lg bg-white border border-red-200 text-red-600 text-[13px] font-bold">{u.name}</span>)}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {isAdmin && (
                <div className="mt-6 pt-6 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <h4 className="text-[15px] font-extrabold text-ink">지난 체크 기록 (관리자)</h4>
                        <select value={historyTaskFilter} onChange={e => { setHistoryTaskFilter(e.target.value); setHistoryVisible(10); }} className="border border-gray-200 rounded-lg px-3 py-1.5 text-[13.5px] font-bold bg-gray-50 outline-none focus:border-blue-500">
                            <option value="all">전체 항목</option>
                            {SAFETY_RECURRING_TASKS.filter(t => t.perUser).map(t => (
                                <option key={t.id} value={t.id}>{t.title}</option>
                            ))}
                        </select>
                    </div>
                    <div className="border border-gray-100 rounded-2xl overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-soft">
                                <tr>
                                    <th className="px-4 py-2.5 text-[13px] font-bold text-gray-500">날짜/시각</th>
                                    <th className="px-4 py-2.5 text-[13px] font-bold text-gray-500">항목</th>
                                    <th className="px-4 py-2.5 text-[13px] font-bold text-gray-500">이름</th>
                                    <th className="px-4 py-2.5 text-[13px] font-bold text-gray-500">전달사항</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {allLogs.length === 0 ? (
                                    <tr><td colSpan={4} className="py-10 text-center text-gray-400 font-bold text-sm">체크 기록이 없습니다.</td></tr>
                                ) : allLogs
                                    .filter(l => historyTaskFilter === 'all' || l.taskId === historyTaskFilter)
                                    .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
                                    .slice(0, historyVisible)
                                    .map((l, idx) => {
                                        const task = SAFETY_RECURRING_TASKS.find(t => t.id === l.taskId);
                                        return (
                                            <tr key={idx} className="hover:bg-blue-50/20">
                                                <td className="px-4 py-2.5 text-[13.5px] font-bold text-gray-700 whitespace-nowrap">{l.date} {l.timestamp ? l.timestamp.slice(11, 16) : ''}</td>
                                                <td className="px-4 py-2.5 text-[13.5px] font-bold text-gray-600">{task ? task.title : l.taskId}</td>
                                                <td className="px-4 py-2.5"><span className="bg-gray-100 px-2 py-0.5 rounded text-[13px] font-bold text-gray-700">{l.name}</span></td>
                                                <td className="px-4 py-2.5 text-[13.5px] text-gray-500">{l.note || '-'}</td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>
                    {(() => {
                        const total = allLogs.filter(l => historyTaskFilter === 'all' || l.taskId === historyTaskFilter).length;
                        if (total > historyVisible) {
                            return (
                                <button onClick={() => setHistoryVisible(v => v + 10)} className="mt-2 w-full py-2.5 text-[13.5px] font-bold text-blue-600 hover:bg-blue-50 rounded-xl border border-gray-100">
                                    더 보기 ({total - historyVisible}건 남음)
                                </button>
                            );
                        }
                        // 화면에는 최근 기록부터 불러옵니다. 더 오래된 기록이 있으면 이어서 불러올 수 있습니다.
                        return hasOlderLogs ? (
                            <button onClick={() => setHistoryLimit(n => n + 300)} className="mt-2 w-full py-2.5 text-[13.5px] font-bold text-gray-500 hover:bg-gray-50 rounded-xl border border-gray-100">
                                이전 기록 더 불러오기
                            </button>
                        ) : null;
                    })()}
                </div>
            )}
        </div>
    );
};

export { SafetyRecurringChecklist };
