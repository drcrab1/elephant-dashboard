import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from './firebase';
import { logAccess } from './audit';
import {
    serverTs, fmtDateTime, reactToPdfBlob, SignaturePad, PledgePaper,
    PLEDGE_TYPES, PLEDGE_TEXT, COMPANY,
} from './privacy-shared';

const card = 'bg-white rounded-2xl border border-gray-100 shadow-sm';

// ───────────────────────── 서약서 서명 (게이트/포털 공용) ─────────────────────────

const PledgeSigner = ({ user, type, onDone }) => {
    const [agree, setAgree] = useState(false);
    const [signature, setSignature] = useState(null);
    const [busy, setBusy] = useState(false);
    const t = PLEDGE_TYPES[type];

    const submit = async () => {
        if (!agree) return alert('서약 내용을 확인하고 동의 체크를 해주세요.');
        if (!signature) return alert('서명을 입력해주세요.');
        setBusy(true);
        try {
            const now = new Date();
            const signedAtText = fmtDateTime(now);
            const blob = await reactToPdfBlob(<PledgePaper type={type} name={user.name} email={user.email} signature={signature} signedAtText={signedAtText} />);
            const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${now.getTime()}`;
            const path = `privacy/pledges/${user.email}/${type}_${stamp}.pdf`;
            await storage.ref(path).put(blob, { contentType: 'application/pdf' });
            const pdfUrl = await storage.ref(path).getDownloadURL();
            await db.collection('pledges').add({
                email: user.email,
                name: user.name,
                type,
                pdfPath: path,
                pdfUrl,
                signedAt: serverTs(),
            });
            await db.collection('users').doc(user.email).set(
                type === 'join' ? { joinPledgeSignedAt: serverTs() } : { leavePledgeSignedAt: serverTs() },
                { merge: true }
            );
            logAccess('pledge_sign', `${PLEDGE_TYPES[type].label} 서명`);
            onDone && onDone(type);
        } catch (e) {
            console.error(e);
            alert('서명 저장에 실패했습니다. 잠시 후 다시 시도해주세요.\n' + e.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="border border-gray-200 rounded-xl bg-gray-50 p-4 max-h-[340px] overflow-y-auto">
                <p className="font-extrabold text-[15px] mb-2">{t.title}</p>
                <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-gray-800">{PLEDGE_TEXT[type]}</p>
            </div>
            <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" className="mt-1 w-5 h-5 accent-blue-600" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span className="text-[14.5px] font-bold text-gray-800">위 서약 내용을 모두 읽고 이해했으며, 이에 동의합니다. ({user.name})</span>
            </label>
            <div>
                <p className="font-extrabold text-[14px] mb-1.5">서명</p>
                <SignaturePad onChange={setSignature} />
            </div>
            <button onClick={submit} disabled={busy} className="w-full py-3.5 rounded-xl bg-[#2E68ED] text-white font-extrabold text-[15px] disabled:opacity-50">
                {busy ? '서명 저장 중...' : '서명 제출'}
            </button>
            <p className="text-[12px] text-gray-400 font-medium text-center">서명일은 제출하는 날짜(실제 날짜)로 자동 기록됩니다.</p>
        </div>
    );
};

// 서명 전까지 앱 사용을 막는 전체 화면
const PledgeGate = ({ user, type, onDone, onLogout }) => (
    <div className="min-h-screen bg-[#F8FAFC] py-8 px-4 font-sans">
        <div className="max-w-[560px] mx-auto">
            <div className="text-center mb-6">
                <img src="/logo.png" alt={COMPANY} className="w-14 h-14 rounded-2xl mx-auto mb-3 object-cover" />
                <h2 className="text-[22px] font-extrabold text-[#0F172A]">{PLEDGE_TYPES[type].label} 서명</h2>
                <p className="text-[14px] text-gray-500 font-medium mt-1.5">
                    {type === 'join' ? '앱을 사용하시려면 개인정보 보호 서약서에 먼저 서명해야 합니다.' : '퇴사(계약 종료)에 따른 개인정보 보호 서약서에 서명해 주세요.'}
                </p>
            </div>
            <div className={`${card} p-5`}>
                <PledgeSigner user={user} type={type} onDone={onDone} />
            </div>
            <button onClick={onLogout} className="block mx-auto mt-5 text-[13px] font-bold text-gray-400 hover:text-gray-600">로그아웃</button>
        </div>
    </div>
);

// 퇴사/비활성화된 계정
const AccountBlocked = ({ onLogout }) => (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-6 font-sans">
        <div className={`${card} p-8 max-w-[420px] text-center`}>
            <div className="text-[40px] mb-3">🔒</div>
            <h2 className="text-[20px] font-extrabold text-[#0F172A] mb-2">이용이 중지된 계정입니다</h2>
            <p className="text-[14px] text-gray-500 font-medium leading-relaxed mb-6">퇴사(계약 종료) 처리되어 앱을 사용할 수 없습니다.<br />문의가 있으시면 대표자에게 연락해 주세요.</p>
            <button onClick={onLogout} className="px-6 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-[14px]">로그아웃</button>
        </div>
    </div>
);

// ───────────────────────── 교육 시청 ─────────────────────────

const TrainingViewer = ({ user, training, onClose, onDone }) => {
    const [reachedEnd, setReachedEnd] = useState(false);
    const [opened, setOpened] = useState(false);
    const [confirmed, setConfirmed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const boxRef = useRef(null);
    const startedAt = useRef(Date.now());
    const isText = training.kind !== 'pdf';
    const minSeconds = training.minSeconds || 0;

    useEffect(() => {
        const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
        return () => clearInterval(id);
    }, []);
    const waitLeft = Math.max(0, minSeconds - elapsed);

    useEffect(() => {
        if (!isText) return;
        const el = boxRef.current;
        // 내용이 짧아 스크롤이 필요 없으면 바로 끝까지 본 것으로 처리
        if (el && el.scrollHeight <= el.clientHeight + 4) setReachedEnd(true);
    }, [isText]);

    const onScroll = () => {
        const el = boxRef.current;
        if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setReachedEnd(true);
    };

    const ready = (isText ? reachedEnd : (opened && confirmed)) && waitLeft === 0;

    const complete = async () => {
        setBusy(true);
        try {
            await db.collection('privacyTrainingLogs').doc(`${training.id}_${user.email}`).set({
                trainingId: training.id,
                trainingTitle: training.title,
                email: user.email,
                name: user.name,
                viewSeconds: Math.round((Date.now() - startedAt.current) / 1000),
                completedAt: serverTs(),
            });
            logAccess('training_complete', training.title, training.id);
            onDone();
        } catch (e) {
            alert('이수 확인 저장에 실패했습니다: ' + e.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-end md:items-center justify-center md:p-6">
            <div className="bg-white w-full md:max-w-[680px] rounded-t-2xl md:rounded-2xl flex flex-col max-h-[94vh]">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                    <h3 className="font-extrabold text-[16px] pr-3">{training.title}</h3>
                    <button onClick={onClose} className="text-gray-400 text-xl px-2">✕</button>
                </div>
                {isText ? (
                    <div ref={boxRef} onScroll={onScroll} className="px-5 py-4 overflow-y-auto flex-1 min-h-[200px]">
                        <p className="whitespace-pre-wrap text-[15px] leading-[1.85] text-gray-800">{training.content}</p>
                    </div>
                ) : (
                    <div className="px-5 py-4 flex-1 space-y-3">
                        <p className="text-[14px] text-gray-600 font-medium">교육자료(PDF)를 열어 끝까지 읽어주세요.</p>
                        <a href={training.fileUrl} target="_blank" rel="noreferrer" onClick={() => setOpened(true)} className="inline-block px-5 py-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-extrabold text-[14px]">📄 교육자료 PDF 열기</a>
                        {opened && (
                            <label className="flex items-start gap-2.5 cursor-pointer pt-2">
                                <input type="checkbox" className="mt-1 w-5 h-5 accent-blue-600" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                                <span className="text-[14px] font-bold text-gray-800">교육자료를 끝까지 확인했습니다.</span>
                            </label>
                        )}
                    </div>
                )}
                <div className="px-5 py-4 border-t border-gray-100 shrink-0">
                    {isText && !reachedEnd && <p className="text-[12.5px] text-amber-600 font-bold mb-2">⬇ 끝까지 아래로 스크롤하면 "이수 확인" 버튼이 활성화됩니다.</p>}
                    {waitLeft > 0 && <p className="text-[12.5px] text-gray-500 font-bold mb-2">⏱ 내용을 충분히 읽을 수 있도록 {Math.floor(waitLeft / 60)}분 {String(waitLeft % 60).padStart(2, '0')}초 후 이수 확인이 가능합니다.</p>}
                    <button onClick={complete} disabled={!ready || busy} className="w-full py-3.5 rounded-xl bg-[#2E68ED] text-white font-extrabold text-[15px] disabled:opacity-40">
                        {busy ? '저장 중...' : '이수 확인'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ───────────────────────── 기사용 포털: 내 서약서 · 교육 ─────────────────────────

const PrivacyPortal = ({ user, setUser }) => {
    const [trainings, setTrainings] = useState([]);
    const [logs, setLogs] = useState([]);
    const [pledges, setPledges] = useState([]);
    const [viewing, setViewing] = useState(null);
    const [signType, setSignType] = useState(null);

    useEffect(() => {
        const u1 = db.collection('privacyTrainings').where('active', '==', true).onSnapshot((s) => setTrainings(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
        const u2 = db.collection('privacyTrainingLogs').where('email', '==', user.email).onSnapshot((s) => setLogs(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
        const u3 = db.collection('pledges').where('email', '==', user.email).onSnapshot((s) => setPledges(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
        return () => { u1(); u2(); u3(); };
    }, [user.email]);

    const pledgeOf = (type) => pledges.filter((p) => p.type === type).sort((a, b) => (b.signedAt?.seconds || 0) - (a.signedAt?.seconds || 0))[0];
    const join = pledgeOf('join');
    const leave = pledgeOf('leave');

    return (
        <main className="md:ml-[260px] ml-0 px-4 md:px-10 py-6 md:py-12 flex-1 relative bg-[#F4F7FB] min-h-[100vh] w-full max-w-[100vw] md:max-w-[calc(100vw-260px)] overflow-x-hidden">
            <header className="mb-6 border-b pb-5 border-gray-200">
                <h2 className="text-[26px] font-extrabold mb-1.5 text-[#1E293B]">🔏 개인정보 서약·교육</h2>
                <p className="text-gray-500 text-[14.5px] font-medium">개인정보 보호 서약서 서명과 교육 이수 현황입니다.</p>
            </header>
            <div className="max-w-[760px] space-y-6">
                <section className="space-y-3">
                    <h3 className="font-extrabold text-[17px]">✍️ 내 서약서</h3>
                    <div className={`${card} p-4 flex items-center justify-between gap-3`}>
                        <div>
                            <p className="font-extrabold text-[15px]">입사 서약서</p>
                            <p className="text-[12.5px] text-gray-500 font-medium">{join ? `서명 완료 · ${fmtDateTime(join.signedAt)}` : '아직 서명하지 않았습니다.'}</p>
                        </div>
                        {join
                            ? <div className="flex items-center gap-2"><span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[12.5px] font-extrabold">완료</span>{join.pdfUrl && <a href={join.pdfUrl} target="_blank" rel="noreferrer" className="text-[12.5px] font-bold text-blue-600">PDF</a>}</div>
                            : <button onClick={() => setSignType('join')} className="px-4 py-2 rounded-xl bg-[#2E68ED] text-white font-bold text-[13px]">서명하기</button>}
                    </div>
                    {(user.leavePledgeRequired || leave) && (
                        <div className={`${card} p-4 flex items-center justify-between gap-3`}>
                            <div>
                                <p className="font-extrabold text-[15px]">퇴사 서약서</p>
                                <p className="text-[12.5px] text-gray-500 font-medium">{leave ? `서명 완료 · ${fmtDateTime(leave.signedAt)}` : '대표자가 서명을 요청했습니다.'}</p>
                            </div>
                            {leave
                                ? <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[12.5px] font-extrabold">완료</span>
                                : <button onClick={() => setSignType('leave')} className="px-4 py-2 rounded-xl bg-[#2E68ED] text-white font-bold text-[13px]">서명하기</button>}
                        </div>
                    )}
                </section>
                <section className="space-y-3">
                    <h3 className="font-extrabold text-[17px]">🎓 개인정보 보호 교육</h3>
                    {trainings.length === 0 && <div className={`${card} p-8 text-center text-gray-400 font-bold`}>진행 중인 교육이 없습니다.</div>}
                    {trainings.map((t) => {
                        const log = logs.find((l) => l.trainingId === t.id);
                        return (
                            <div key={t.id} className={`${card} p-4 flex items-center justify-between gap-3`}>
                                <div className="min-w-0">
                                    <p className="font-extrabold text-[15px]">{t.title}</p>
                                    <p className="text-[12.5px] text-gray-500 font-medium">{t.durationMin ? `약 ${t.durationMin}분 · ` : ''}{log ? `이수 완료 · ${fmtDateTime(log.completedAt)}` : '미이수'}</p>
                                </div>
                                {log
                                    ? <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[12.5px] font-extrabold shrink-0">이수</span>
                                    : <button onClick={() => setViewing(t)} className="px-4 py-2 rounded-xl bg-[#2E68ED] text-white font-bold text-[13px] shrink-0">교육 보기</button>}
                            </div>
                        );
                    })}
                </section>
            </div>
            {viewing && <TrainingViewer user={user} training={viewing} onClose={() => setViewing(null)} onDone={() => setViewing(null)} />}
            {signType && (
                <div className="fixed inset-0 z-[60] bg-black/50 flex items-end md:items-center justify-center md:p-6">
                    <div className="bg-white w-full md:max-w-[560px] rounded-t-2xl md:rounded-2xl p-5 max-h-[94vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-extrabold text-[17px]">{PLEDGE_TYPES[signType].label}</h3>
                            <button onClick={() => setSignType(null)} className="text-gray-400 text-xl px-2">✕</button>
                        </div>
                        <PledgeSigner user={user} type={signType} onDone={(type) => {
                            setSignType(null);
                            if (setUser) setUser((prev) => ({ ...prev, [type === 'join' ? 'joinPledgeSignedAt' : 'leavePledgeSignedAt']: new Date() }));
                        }} />
                    </div>
                </div>
            )}
        </main>
    );
};

export { PrivacyPortal, PledgeGate, AccountBlocked };
