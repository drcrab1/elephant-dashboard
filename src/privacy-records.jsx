import React, { useState, useEffect, useMemo } from 'react';
import { db, ADMIN_EMAIL } from './firebase';
import { logAccess } from './audit';
import {
    serverTs, toDate, fmtDate, fmtDateTime, downloadBlob, reactToPdfBlob, maskEmail,
    PrivacyModal, SignaturePad, Paper, COMPANY, CHECK_STATUS, CHECKLISTS, CHECKLIST_KINDS, ACTION_LABEL, dueInfo, packSnapshot, rowCells,
} from './privacy-shared';

export const kindOf = (rec) => rec.kind || 'annual';

const card = 'bg-white rounded-2xl border border-gray-100 shadow-sm';
const btn = 'px-3.5 py-2 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50';
const btnPrimary = `${btn} bg-[#2E68ED] text-white hover:bg-blue-700`;
const btnGhost = `${btn} bg-gray-100 text-gray-700 hover:bg-gray-200`;
const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[14px] font-medium outline-none focus:border-blue-500 bg-white';

const Badge = ({ tone = 'gray', children }) => {
    const tones = {
        gray: 'bg-gray-100 text-gray-600 border-gray-200',
        green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        red: 'bg-red-50 text-red-600 border-red-200',
        amber: 'bg-amber-50 text-amber-700 border-amber-200',
    };
    return <span className={`inline-block px-2 py-0.5 rounded-lg border text-[12px] font-extrabold ${tones[tone]}`}>{children}</span>;
};

// ───────────────────────── 점검 기록 용지 (보기/PDF 공용) ─────────────────────────

export const RecordPaper = ({ rec }) => {
    const cfg = CHECKLISTS[kindOf(rec)];
    return (
        <Paper>
            <h1 style={{ fontSize: 22, fontWeight: 800, textAlign: 'center', marginBottom: 6 }}>{cfg.title}</h1>
            <div style={{ textAlign: 'center', color: '#555', fontSize: 13, marginBottom: 20 }}>{COMPANY} · {rec.year}년 · 점검일 {fmtDate(rec.createdAt)}{rec.subject ? ` · 대상: ${rec.subject}` : ''}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                    <tr>{['No', '점검 항목', '이행 여부', '메모'].map((h) => <th key={h} style={{ border: '1px solid #aaa', padding: '5px 6px', background: '#f3f4f6' }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                    {rec.items.map((it) => (
                        <tr key={it.no}>
                            <td style={{ border: '1px solid #ccc', padding: '5px 6px', textAlign: 'center' }}>{it.no}</td>
                            <td style={{ border: '1px solid #ccc', padding: '5px 6px' }}>{it.title}</td>
                            <td style={{ border: '1px solid #ccc', padding: '5px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>{it.status}</td>
                            <td style={{ border: '1px solid #ccc', padding: '5px 6px', whiteSpace: 'pre-wrap' }}>{it.memo || ''}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {rec.snapshot && rec.snapshot.rows && rec.snapshot.rows.length > 0 && (
                <div style={{ marginTop: 20 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>{rec.snapshot.title}</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                            <tr>{rec.snapshot.head.map((h) => <th key={h} style={{ border: '1px solid #aaa', padding: '4px 6px', background: '#f3f4f6' }}>{h}</th>)}</tr>
                        </thead>
                        <tbody>
                            {rec.snapshot.rows.map((r, i) => (
                                <tr key={i}>{rowCells(r).map((c, j) => <td key={j} style={{ border: '1px solid #ccc', padding: '4px 6px' }}>{c}</td>)}</tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <div style={{ marginTop: 28 }}>
                <div>점검일: {fmtDateTime(rec.createdAt)}</div>
                <div>점검자: {rec.inspector?.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
                    <span>서명:</span>
                    {rec.signature && <img src={rec.signature} alt="점검자 서명" style={{ height: 64, objectFit: 'contain' }} />}
                </div>
            </div>
        </Paper>
    );
};

const emptyItems = (items) => items.map((c) => ({ no: c.no, title: c.title, status: '', memo: '' }));

// 점검 시점의 계정·권한 현황 / 최근 30일 접속기록 요약을 자동으로 만들어 기록에 함께 저장
const buildSnapshot = async (type, members, user) => {
    if (type === 'accounts') {
        const rows = [[user.name || '대표자', '관리자(대표)', '-', '재직']];
        members.filter((m) => m.email !== ADMIN_EMAIL && m.role !== 'admin').forEach((m) => {
            rows.push([m.name || maskEmail(m.email), '기사', m.isHandler ? '취급자 지정' : '-', m.isActive === false ? '퇴사(비활성)' : '재직']);
        });
        return { title: `점검 시점 계정·권한 현황 (${rows.length}명)`, head: ['이름', '권한', '개인정보취급자', '계정 상태'], rows };
    }
    if (type === 'logs') {
        const since = new Date(Date.now() - 30 * 86400000);
        const snap = await db.collection('accessLogs').where('createdAt', '>=', since).orderBy('createdAt', 'desc').limit(3000).get();
        const logs = snap.docs.map((d) => d.data());
        const byAction = {};
        logs.forEach((l) => { byAction[l.action] = (byAction[l.action] || 0) + 1; });
        const adminLogs = logs.filter((l) => l.role === 'admin');
        const ips = {};
        adminLogs.forEach((l) => { if (l.ip) ips[l.ip] = (ips[l.ip] || 0) + 1; });
        const night = adminLogs.filter((l) => { const h = toDate(l.createdAt)?.getHours(); return h != null && h < 5; }).length;
        const rows = [['조회 대상 기간', '최근 30일'], ['접속기록 총 건수', String(logs.length)]];
        Object.entries(byAction).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => rows.push([ACTION_LABEL[k] || k, `${v}건`]));
        rows.push(['관리자 접속지(IP)', Object.entries(ips).map(([ip, n]) => `${ip} (${n})`).join(', ') || '-']);
        rows.push(['관리자 새벽(00~05시) 접속', `${night}건`]);
        return { title: '점검 시점 접속기록 요약 (최근 30일)', head: ['항목', '내용'], rows };
    }
    return null;
};

// ───────────────────────── 점검 기록 탭 ─────────────────────────

export const ChecklistTab = ({ user, members, checks, initialKind = 'annual' }) => {
    const [kind, setKind] = useState(initialKind);
    const [year, setYear] = useState(String(new Date().getFullYear()));
    const [form, setForm] = useState(null);
    const [starting, setStarting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [viewing, setViewing] = useState(null);
    const [busyPdf, setBusyPdf] = useState(false);
    const cfg = CHECKLISTS[kind];

    useEffect(() => { setKind(initialKind); }, [initialKind]);

    const ofKind = useMemo(() => checks.filter((r) => kindOf(r) === kind), [checks, kind]);
    const years = useMemo(() => {
        const set = new Set(ofKind.map((r) => String(r.year)));
        set.add(String(new Date().getFullYear()));
        return Array.from(set).sort().reverse();
    }, [ofKind]);
    const shown = ofKind.filter((r) => String(r.year) === year);

    const start = async () => {
        setStarting(true);
        try {
            const snapshot = cfg.snapshot ? await buildSnapshot(cfg.snapshot, members, user) : null;
            setForm({ items: emptyItems(cfg.items), inspector: user.name || '', signature: null, subject: '', snapshot });
        } catch (e) {
            alert('점검 시작 실패: ' + e.message);
        } finally {
            setStarting(false);
        }
    };

    const submit = async () => {
        if (form.items.some((i) => !i.status)) return alert(`${cfg.items.length}개 항목의 이행 여부를 모두 선택해주세요.`);
        if (cfg.subjectLabel && !form.subject.trim()) return alert('점검 대상을 입력해주세요.');
        if (!form.inspector.trim()) return alert('점검자 이름을 입력해주세요.');
        if (!form.signature) return alert('점검자 서명을 입력해주세요.');
        if (!window.confirm('점검 결과를 확정 저장할까요?\n저장하면 수정·삭제할 수 없고, 점검일은 오늘(실제 날짜)로 자동 기록됩니다.')) return;
        setSaving(true);
        try {
            await db.collection('privacyChecks').add({
                kind,
                year: new Date().getFullYear(),
                items: form.items,
                subject: form.subject.trim(),
                snapshot: packSnapshot(form.snapshot),
                inspector: { name: form.inspector.trim(), email: user.email },
                signature: form.signature,
                createdAt: serverTs(),
            });
            logAccess('privacy_record_save', `${cfg.label} 점검 저장`);
            setYear(String(new Date().getFullYear()));
            setForm(null);
        } catch (e) {
            alert('저장 실패: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const pdf = async (rec) => {
        setBusyPdf(true);
        try {
            logAccess('export', `${CHECKLISTS[kindOf(rec)].label} PDF`);
            downloadBlob(await reactToPdfBlob(<RecordPaper rec={rec} />), `${CHECKLISTS[kindOf(rec)].label}_${rec.year}_${fmtDate(rec.createdAt).replace(/\./g, '')}.pdf`);
        } catch (e) {
            alert('PDF 생성 실패: ' + e.message);
        } finally {
            setBusyPdf(false);
        }
    };

    const summary = (rec) => {
        const c = { 이행: 0, '부분 이행': 0, 미이행: 0, 해당없음: 0 };
        rec.items.forEach((i) => { c[i.status] = (c[i.status] || 0) + 1; });
        return c;
    };

    if (form) {
        return (
            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-extrabold text-[18px]">{cfg.label} 작성</h3>
                    <div className="flex gap-2">
                        <button className={btnGhost} onClick={() => setForm(null)}>취소</button>
                        <button className={btnPrimary} disabled={saving} onClick={submit}>{saving ? '저장 중...' : '점검 확정·저장'}</button>
                    </div>
                </div>
                <p className="text-[12.5px] text-gray-500 font-medium">점검일은 저장하는 날짜(실제 날짜)로 자동 기록되며 직접 입력하거나 바꿀 수 없습니다. 실제로 확인한 사실대로만 선택하세요.</p>
                {cfg.subjectLabel && (
                    <div className={`${card} p-4`}>
                        <p className="font-extrabold text-[14px] mb-1.5">{cfg.subjectLabel}</p>
                        <input className={inputCls} value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
                    </div>
                )}
                {form.snapshot && (
                    <div className={`${card} p-4`}>
                        <p className="font-extrabold text-[14px] mb-2">{form.snapshot.title} <span className="text-[12px] text-gray-400 font-medium">(저장 시 함께 기록됩니다)</span></p>
                        <div className="max-h-[200px] overflow-auto border border-gray-100 rounded-xl text-[12.5px]">
                            <table className="w-full"><thead className="bg-gray-50"><tr>{form.snapshot.head.map((h) => <th key={h} className="text-left px-3 py-1.5">{h}</th>)}</tr></thead>
                                <tbody className="divide-y divide-gray-50">{form.snapshot.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-3 py-1.5">{c}</td>)}</tr>)}</tbody></table>
                        </div>
                    </div>
                )}
                {form.items.map((it, i) => (
                    <div key={it.no} className={`${card} p-4`}>
                        <p className="font-extrabold text-[15px]">{it.no}. {it.title}</p>
                        <p className="text-[12.5px] text-gray-500 font-medium mb-2.5">{cfg.items[i].criteria}</p>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {CHECK_STATUS.map((st) => (
                                <button
                                    key={st}
                                    onClick={() => setForm((f) => { const arr = f.items.slice(); arr[i] = { ...arr[i], status: st }; return { ...f, items: arr }; })}
                                    className={`px-3.5 py-1.5 rounded-xl border text-[13px] font-bold ${it.status === st ? 'bg-[#2E68ED] border-[#2E68ED] text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                >{st}</button>
                            ))}
                        </div>
                        <input className={inputCls} placeholder="메모 (확인한 방법, 조치 내용, 특이사항)" value={it.memo} onChange={(e) => { const memo = e.target.value; setForm((f) => { const arr = f.items.slice(); arr[i] = { ...arr[i], memo }; return { ...f, items: arr }; }); }} />
                    </div>
                ))}
                <div className={`${card} p-4 space-y-3`}>
                    <div>
                        <p className="font-extrabold text-[14px] mb-1.5">점검자</p>
                        <input className={inputCls} value={form.inspector} onChange={(e) => setForm((f) => ({ ...f, inspector: e.target.value }))} />
                    </div>
                    <div>
                        <p className="font-extrabold text-[14px] mb-1.5">점검자 서명</p>
                        <SignaturePad onChange={(sig) => setForm((f) => ({ ...f, signature: sig }))} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
                {CHECKLIST_KINDS.map((k) => {
                    const last = checks.find((r) => kindOf(r) === k);
                    const due = dueInfo(last && last.createdAt, CHECKLISTS[k].cadenceMonths);
                    return (
                        <button key={k} onClick={() => setKind(k)} className={`px-3.5 py-2 rounded-xl border text-left transition-colors ${kind === k ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
                            <div className="text-[13.5px] font-extrabold">{CHECKLISTS[k].label}</div>
                            <div className={`text-[11px] font-bold ${kind === k ? 'text-gray-300' : due.state === 'overdue' || due.state === 'none' ? 'text-red-500' : 'text-emerald-600'}`}>{due.label}</div>
                        </button>
                    );
                })}
            </div>
            <p className="text-[13px] text-gray-500 font-medium">{cfg.intro}</p>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className="text-[14px] font-bold text-gray-500">연도</span>
                    <select className="border border-gray-200 rounded-xl px-3 py-2 text-[14px] font-bold bg-white" value={year} onChange={(e) => setYear(e.target.value)}>
                        {years.map((y) => <option key={y} value={y}>{y}년</option>)}
                    </select>
                </div>
                <button className={btnPrimary} disabled={starting} onClick={start}>{starting ? '준비 중...' : '+ 새 점검 시작'}</button>
            </div>
            {shown.length === 0 ? (
                <div className={`${card} p-10 text-center text-gray-400 font-bold`}>{year}년 {cfg.label} 이력이 없습니다.</div>
            ) : (
                <div className={`${card} overflow-hidden`}>
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-[13px] text-gray-500">
                            <tr><th className="px-4 py-3">점검일시</th><th className="px-4 py-3">점검자</th><th className="px-4 py-3">결과</th><th className="px-4 py-3 text-right">관리</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-[14px]">
                            {shown.map((r) => {
                                const s = summary(r);
                                return (
                                    <tr key={r.id}>
                                        <td className="px-4 py-3 font-bold">{fmtDateTime(r.createdAt)}{r.subject ? <div className="text-[11.5px] text-gray-400 font-medium">{r.subject}</div> : null}</td>
                                        <td className="px-4 py-3">{r.inspector?.name}</td>
                                        <td className="px-4 py-3 space-x-1">
                                            <Badge tone="green">이행 {s['이행']}</Badge>
                                            {s['부분 이행'] > 0 && <Badge tone="amber">부분 {s['부분 이행']}</Badge>}
                                            {s['미이행'] > 0 && <Badge tone="red">미이행 {s['미이행']}</Badge>}
                                        </td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                                            <button className={btnGhost} onClick={() => setViewing(r)}>보기</button>
                                            <button className={btnGhost} disabled={busyPdf} onClick={() => pdf(r)}>PDF</button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            {viewing && (
                <PrivacyModal title={`${CHECKLISTS[kindOf(viewing)].label} (${viewing.year}년)`} wide onClose={() => setViewing(null)}>
                    <div className="overflow-x-auto border border-gray-100 rounded-xl"><RecordPaper rec={viewing} /></div>
                </PrivacyModal>
            )}
        </div>
    );
};
