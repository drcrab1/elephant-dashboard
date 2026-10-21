import React, { useState, useEffect, useMemo } from 'react';
import { db, storage, functions, ADMIN_EMAIL } from './firebase';
import {
    serverTs, toDate, fmtDate, fmtDateTime, exportXlsx, downloadBlob, reactToPdfBlob,
    PrivacyModal, SignaturePad, Paper, COMPANY,
    DOC_TYPES, DOC_TEMPLATES, CHECK_ITEMS, CHECK_STATUS, PLEDGE_TYPES, PLEDGE_TEXT, DEFAULT_TRAINING,
} from './privacy-shared';

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
        blue: 'bg-blue-50 text-blue-700 border-blue-200',
    };
    return <span className={`inline-block px-2 py-0.5 rounded-lg border text-[12px] font-extrabold ${tones[tone]}`}>{children}</span>;
};

// ───────────────────────── 문서 용지 (보기/PDF 공용) ─────────────────────────

const DocPaper = ({ type, version, sections, contacts }) => (
    <Paper>
        <h1 style={{ fontSize: 24, fontWeight: 800, textAlign: 'center', marginBottom: 6 }}>{DOC_TYPES[type].label}</h1>
        <div style={{ textAlign: 'center', color: '#555', fontSize: 13, marginBottom: 28 }}>
            {COMPANY} · 버전 v{version.version} · 작성일 {fmtDate(version.createdAt)} · 작성자 {version.createdBy?.name || '-'}
            {version.note ? <div style={{ marginTop: 4 }}>변경 사유: {version.note}</div> : null}
        </div>
        {sections.map((s) => (
            <div key={s.key} style={{ marginBottom: 22 }}>
                <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 6, borderBottom: '1px solid #ddd', paddingBottom: 4 }}>{s.title}</h2>
                <div style={{ whiteSpace: 'pre-wrap' }}>{s.body}</div>
                {s.type === 'contacts' && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10, fontSize: 12.5 }}>
                        <thead>
                            <tr>{['구분', '이름', '직책/역할', '연락처'].map((h) => <th key={h} style={{ border: '1px solid #bbb', padding: '4px 6px', background: '#f3f4f6', textAlign: 'left' }}>{h}</th>)}</tr>
                        </thead>
                        <tbody>
                            {(contacts || []).map((c, i) => (
                                <tr key={i}>
                                    <td style={{ border: '1px solid #ccc', padding: '4px 6px' }}>{c.type === 'external' ? '외부기관' : '내부'}</td>
                                    <td style={{ border: '1px solid #ccc', padding: '4px 6px' }}>{c.name}</td>
                                    <td style={{ border: '1px solid #ccc', padding: '4px 6px' }}>{c.role || '-'}</td>
                                    <td style={{ border: '1px solid #ccc', padding: '4px 6px' }}>{c.phone || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        ))}
    </Paper>
);

const snapshotContacts = (contacts) => (contacts || []).map((c) => ({ type: c.type || 'internal', name: c.name || '', role: c.role || '', phone: c.phone || '' }));

// ───────────────────────── 탭 1: 문서 보관함 ─────────────────────────

const DocsTab = ({ user, contacts, setActivePage }) => {
    const [metas, setMetas] = useState({});
    const [openType, setOpenType] = useState(null);
    const [versions, setVersions] = useState([]);
    const [editing, setEditing] = useState(null); // {sections, note, baseVersion}
    const [viewing, setViewing] = useState(null);
    const [saving, setSaving] = useState(false);
    const [busyPdf, setBusyPdf] = useState(false);

    useEffect(() => db.collection('privacyDocs').onSnapshot((snap) => {
        const m = {};
        snap.docs.forEach((d) => { m[d.id] = d.data(); });
        setMetas(m);
    }), []);

    useEffect(() => {
        if (!openType) { setVersions([]); return undefined; }
        return db.collection('privacyDocs').doc(openType).collection('versions').orderBy('version', 'desc').onSnapshot((snap) => {
            setVersions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
    }, [openType]);

    const startEdit = (fromVersion) => {
        const base = fromVersion || versions[0];
        const sections = (base ? base.sections : DOC_TEMPLATES[openType]).map((s) => ({ ...s }));
        setEditing({ sections, note: '', baseVersion: base ? base.version : null });
    };

    const save = async () => {
        if (!window.confirm('새 버전으로 저장할까요?\n저장하면 수정·삭제할 수 없고, 작성일은 오늘(실제 작성일)로 자동 기록됩니다.')) return;
        setSaving(true);
        try {
            const ref = db.collection('privacyDocs').doc(openType);
            const last = await ref.collection('versions').orderBy('version', 'desc').limit(1).get();
            const next = last.empty ? 1 : last.docs[0].data().version + 1;
            const data = {
                version: next,
                sections: editing.sections,
                note: editing.note.trim(),
                createdAt: serverTs(),
                createdBy: { email: user.email, name: user.name },
            };
            if (editing.sections.some((s) => s.type === 'contacts')) data.contactsSnapshot = snapshotContacts(contacts);
            await ref.collection('versions').add(data);
            await ref.set({ title: DOC_TYPES[openType].label, latestVersion: next, updatedAt: serverTs() }, { merge: true });
            setEditing(null);
        } catch (e) {
            alert('저장 실패: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const downloadPdf = async (v) => {
        setBusyPdf(true);
        try {
            const sections = v.sections;
            const blob = await reactToPdfBlob(<DocPaper type={openType} version={v} sections={sections} contacts={v.contactsSnapshot || snapshotContacts(contacts)} />);
            downloadBlob(blob, `${DOC_TYPES[openType].label}_v${v.version}.pdf`);
        } catch (e) {
            alert('PDF 생성 실패: ' + e.message);
        } finally {
            setBusyPdf(false);
        }
    };

    if (editing) {
        return (
            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-extrabold text-[18px]">{DOC_TYPES[openType].label} — 새 버전 작성{editing.baseVersion ? ` (v${editing.baseVersion} 기반)` : ' (기본 초안)'}</h3>
                    <div className="flex gap-2">
                        <button className={btnGhost} onClick={() => setEditing(null)}>취소</button>
                        <button className={btnPrimary} disabled={saving} onClick={save}>{saving ? '저장 중...' : '새 버전으로 저장'}</button>
                    </div>
                </div>
                <p className="text-[12.5px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 font-medium">
                    [대괄호] 표시는 대표자가 확인·입력해야 하는 부분입니다. 날짜는 입력하지 않으며, 저장 시점의 실제 작성일이 자동 기록됩니다.
                </p>
                {editing.sections.map((s, i) => (
                    <div key={s.key} className={`${card} p-4`}>
                        <p className="font-extrabold text-[15px] mb-2">{s.title}</p>
                        <textarea
                            className={`${inputCls} leading-relaxed`}
                            rows={Math.min(18, Math.max(4, s.body.split('\n').length + 1))}
                            value={s.body}
                            onChange={(e) => {
                                const body = e.target.value;
                                setEditing((ed) => { const arr = ed.sections.slice(); arr[i] = { ...arr[i], body }; return { ...ed, sections: arr }; });
                            }}
                        />
                        {s.type === 'contacts' && (
                            <div className="mt-3">
                                <p className="text-[12.5px] font-bold text-gray-500 mb-1">비상연락망 미리보기 (실시간 연동 · {contacts.length}명)</p>
                                <div className="max-h-[180px] overflow-y-auto border border-gray-100 rounded-xl text-[12.5px] divide-y divide-gray-50">
                                    {contacts.map((c) => <div key={c.id} className="flex gap-3 px-3 py-1.5"><span className="w-[70px] text-gray-400 shrink-0">{c.type === 'external' ? '외부기관' : '내부'}</span><span className="font-bold w-[90px] shrink-0">{c.name}</span><span className="text-gray-500 flex-1">{c.role}</span><span>{c.phone}</span></div>)}
                                </div>
                                <button className="text-[12.5px] font-bold text-blue-600 mt-2" onClick={() => setActivePage('비상연락망')}>비상연락망 메뉴 열기 →</button>
                            </div>
                        )}
                    </div>
                ))}
                <div className={`${card} p-4`}>
                    <p className="font-extrabold text-[14px] mb-2">변경 사유 (선택)</p>
                    <input className={inputCls} value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} placeholder="예: 접속기록 점검 주기 변경" />
                </div>
            </div>
        );
    }

    if (openType) {
        const t = DOC_TYPES[openType];
        return (
            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <button className={btnGhost} onClick={() => setOpenType(null)}>← 목록</button>
                        <h3 className="font-extrabold text-[18px]">{t.icon} {t.label}</h3>
                    </div>
                    <button className={btnPrimary} onClick={() => startEdit()}>{versions.length ? '수정하여 새 버전 저장' : '기본 초안으로 작성 시작'}</button>
                </div>
                {versions.length === 0 ? (
                    <div className={`${card} p-10 text-center text-gray-400 font-bold`}>아직 저장된 버전이 없습니다. 위 버튼으로 기본 초안을 불러와 작성하세요.</div>
                ) : (
                    <div className={`${card} overflow-hidden`}>
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-[13px] text-gray-500">
                                <tr><th className="px-4 py-3">버전</th><th className="px-4 py-3">작성일시</th><th className="px-4 py-3">작성자</th><th className="px-4 py-3">변경 사유</th><th className="px-4 py-3 text-right">관리</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 text-[14px]">
                                {versions.map((v, idx) => (
                                    <tr key={v.id}>
                                        <td className="px-4 py-3 font-extrabold">v{v.version} {idx === 0 && <Badge tone="green">최신</Badge>}</td>
                                        <td className="px-4 py-3">{fmtDateTime(v.createdAt)}</td>
                                        <td className="px-4 py-3">{v.createdBy?.name || '-'}</td>
                                        <td className="px-4 py-3 text-gray-500">{v.note || '-'}</td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                                            <button className={btnGhost} onClick={() => setViewing(v)}>보기</button>
                                            <button className={btnGhost} disabled={busyPdf} onClick={() => downloadPdf(v)}>PDF</button>
                                            <button className={btnGhost} onClick={() => startEdit(v)}>이 버전으로 새 버전</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {viewing && (
                    <PrivacyModal title={`${t.label} v${viewing.version}`} wide onClose={() => setViewing(null)}>
                        <div className="overflow-x-auto border border-gray-100 rounded-xl">
                            <DocPaper type={openType} version={viewing} sections={viewing.sections} contacts={viewing.contactsSnapshot || snapshotContacts(contacts)} />
                        </div>
                    </PrivacyModal>
                )}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(DOC_TYPES).map(([key, t]) => {
                const m = metas[key];
                return (
                    <button key={key} onClick={() => setOpenType(key)} className={`${card} p-5 text-left hover:shadow-md transition-shadow`}>
                        <div className="text-[28px] mb-2">{t.icon}</div>
                        <p className="font-extrabold text-[17px] text-gray-900">{t.label}</p>
                        <p className="text-[13px] text-gray-500 font-medium mt-1 mb-3">{t.desc}</p>
                        {m ? <Badge tone="green">v{m.latestVersion} · {fmtDate(m.updatedAt)}</Badge> : <Badge tone="amber">미작성 (기본 초안 있음)</Badge>}
                    </button>
                );
            })}
        </div>
    );
};

// ───────────────────────── 탭 2: 연간 점검 ─────────────────────────

const CheckPaper = ({ rec }) => (
    <Paper>
        <h1 style={{ fontSize: 22, fontWeight: 800, textAlign: 'center', marginBottom: 6 }}>개인정보 보호 연간 점검 체크리스트</h1>
        <div style={{ textAlign: 'center', color: '#555', fontSize: 13, marginBottom: 20 }}>{COMPANY} · {rec.year}년 점검 · 점검일 {fmtDate(rec.createdAt)}</div>
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

const emptyItems = () => CHECK_ITEMS.map((c) => ({ no: c.no, title: c.title, status: '', memo: '' }));

const CheckTab = ({ user }) => {
    const [records, setRecords] = useState([]);
    const [year, setYear] = useState(String(new Date().getFullYear()));
    const [form, setForm] = useState(null); // {items, inspector, signature}
    const [saving, setSaving] = useState(false);
    const [viewing, setViewing] = useState(null);
    const [busyPdf, setBusyPdf] = useState(false);

    useEffect(() => db.collection('privacyChecks').orderBy('createdAt', 'desc').onSnapshot((snap) => {
        setRecords(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }), []);

    const years = useMemo(() => {
        const set = new Set(records.map((r) => String(r.year)));
        set.add(String(new Date().getFullYear()));
        return Array.from(set).sort().reverse();
    }, [records]);
    const shown = records.filter((r) => String(r.year) === year);

    const submit = async () => {
        if (form.items.some((i) => !i.status)) return alert('16개 항목의 이행 여부를 모두 선택해주세요.');
        if (!form.inspector.trim()) return alert('점검자 이름을 입력해주세요.');
        if (!form.signature) return alert('점검자 서명을 입력해주세요.');
        if (!window.confirm('점검 결과를 확정 저장할까요?\n저장하면 수정·삭제할 수 없고, 점검일은 오늘(실제 날짜)로 자동 기록됩니다.')) return;
        setSaving(true);
        try {
            await db.collection('privacyChecks').add({
                year: new Date().getFullYear(),
                items: form.items,
                inspector: { name: form.inspector.trim(), email: user.email },
                signature: form.signature,
                createdAt: serverTs(),
            });
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
            downloadBlob(await reactToPdfBlob(<CheckPaper rec={rec} />), `개인정보_연간점검_${rec.year}_${fmtDate(rec.createdAt).replace(/\./g, '')}.pdf`);
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
                    <h3 className="font-extrabold text-[18px]">{new Date().getFullYear()}년 연간 점검 작성</h3>
                    <div className="flex gap-2">
                        <button className={btnGhost} onClick={() => setForm(null)}>취소</button>
                        <button className={btnPrimary} disabled={saving} onClick={submit}>{saving ? '저장 중...' : '점검 확정·저장'}</button>
                    </div>
                </div>
                <p className="text-[12.5px] text-gray-500 font-medium">점검일은 저장하는 날짜(실제 날짜)로 자동 기록되며 직접 입력하거나 바꿀 수 없습니다.</p>
                {form.items.map((it, i) => (
                    <div key={it.no} className={`${card} p-4`}>
                        <p className="font-extrabold text-[15px]">{it.no}. {it.title}</p>
                        <p className="text-[12.5px] text-gray-500 font-medium mb-2.5">{CHECK_ITEMS[i].criteria}</p>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {CHECK_STATUS.map((st) => (
                                <button
                                    key={st}
                                    onClick={() => setForm((f) => { const arr = f.items.slice(); arr[i] = { ...arr[i], status: st }; return { ...f, items: arr }; })}
                                    className={`px-3.5 py-1.5 rounded-xl border text-[13px] font-bold ${it.status === st ? 'bg-[#2E68ED] border-[#2E68ED] text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                >{st}</button>
                            ))}
                        </div>
                        <input className={inputCls} placeholder="메모 (조치 내용, 특이사항)" value={it.memo} onChange={(e) => { const memo = e.target.value; setForm((f) => { const arr = f.items.slice(); arr[i] = { ...arr[i], memo }; return { ...f, items: arr }; }); }} />
                    </div>
                ))}
                <div className={`${card} p-4 space-y-3`}>
                    <div>
                        <p className="font-extrabold text-[14px] mb-1.5">점검자</p>
                        <input className={inputCls} value={form.inspector} onChange={(e) => setForm({ ...form, inspector: e.target.value })} />
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
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className="text-[14px] font-bold text-gray-500">연도</span>
                    <select className="border border-gray-200 rounded-xl px-3 py-2 text-[14px] font-bold bg-white" value={year} onChange={(e) => setYear(e.target.value)}>
                        {years.map((y) => <option key={y} value={y}>{y}년</option>)}
                    </select>
                </div>
                <button className={btnPrimary} onClick={() => setForm({ items: emptyItems(), inspector: user.name || '', signature: null })}>+ 새 점검 시작</button>
            </div>
            {shown.length === 0 ? (
                <div className={`${card} p-10 text-center text-gray-400 font-bold`}>{year}년 점검 이력이 없습니다.</div>
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
                                        <td className="px-4 py-3 font-bold">{fmtDateTime(r.createdAt)}</td>
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
                <PrivacyModal title={`${viewing.year}년 점검 결과`} wide onClose={() => setViewing(null)}>
                    <div className="overflow-x-auto border border-gray-100 rounded-xl"><CheckPaper rec={viewing} /></div>
                </PrivacyModal>
            )}
        </div>
    );
};

// ───────────────────────── 탭 3: 취급자 명단 ─────────────────────────

const HandlersTab = ({ members }) => {
    const [busy, setBusy] = useState(null);
    const [filter, setFilter] = useState('전체');
    const people = members.filter((m) => m.email !== ADMIN_EMAIL && m.role !== 'admin');

    const accountLabel = (m) => (m.isActive === false ? '퇴사(비활성)' : '재직(활성)');
    const rows = people.filter((m) => {
        if (filter === '취급자') return m.isHandler;
        if (filter === '퇴사') return m.isActive === false;
        return true;
    });

    const toggleHandler = async (m) => {
        setBusy(m.email);
        try {
            if (m.isHandler) {
                if (!window.confirm(`'${m.name}'님의 개인정보취급자 지정을 해제할까요?\n해제일이 기록됩니다.`)) return;
                await db.collection('users').doc(m.email).set({ isHandler: false, handlerReleasedAt: serverTs() }, { merge: true });
            } else {
                await db.collection('users').doc(m.email).set({ isHandler: true, handlerAssignedAt: serverTs(), handlerReleasedAt: null }, { merge: true });
            }
        } catch (e) {
            alert('처리 실패: ' + e.message);
        } finally {
            setBusy(null);
        }
    };

    const resign = async (m) => {
        const leaveSigned = !!m.leavePledgeSignedAt;
        const warn = leaveSigned ? '' : '\n\n⚠ 퇴사 서약서가 아직 서명되지 않았습니다. 계정을 비활성화하면 이후 서명할 수 없습니다.\n(먼저 [전자 서약서] 탭에서 "퇴사 서약 요청"을 보내고 서명을 받는 것을 권장합니다.)';
        if (!window.confirm(`'${m.name}'님을 퇴사 처리할까요?\n\n- 계정이 즉시 비활성화되어 로그인할 수 없게 됩니다.\n- 개인정보취급자였다면 해제일이 기록됩니다.${warn}`)) return;
        setBusy(m.email);
        try {
            const patch = { isActive: false, status: '퇴사', resignedAt: serverTs() };
            if (m.isHandler) { patch.isHandler = false; patch.handlerReleasedAt = serverTs(); }
            await db.collection('users').doc(m.email).set(patch, { merge: true });
            try {
                await functions.httpsCallable('setAccountDisabled')({ email: m.email, disabled: true });
            } catch (fe) {
                alert('퇴사 처리는 완료되어 앱 접근이 차단되었습니다.\n다만 구글 계정 차단(서버 함수) 호출은 실패했습니다: ' + fe.message);
            }
        } catch (e) {
            alert('퇴사 처리 실패: ' + e.message);
        } finally {
            setBusy(null);
        }
    };

    const reactivate = async (m) => {
        if (!window.confirm(`'${m.name}'님의 계정을 다시 활성화할까요?`)) return;
        setBusy(m.email);
        try {
            await db.collection('users').doc(m.email).set({ isActive: true, status: '재직', reactivatedAt: serverTs() }, { merge: true });
            try { await functions.httpsCallable('setAccountDisabled')({ email: m.email, disabled: false }); } catch (fe) { console.warn(fe); }
        } catch (e) {
            alert('처리 실패: ' + e.message);
        } finally {
            setBusy(null);
        }
    };

    const exportList = () => {
        exportXlsx(people.map((m) => ({
            이름: m.name || '',
            이메일: m.email,
            연락처: m.phone || '',
            취급자여부: m.isHandler ? '지정' : '미지정',
            취급자지정일: fmtDate(m.handlerAssignedAt),
            취급자해제일: fmtDate(m.handlerReleasedAt),
            계정상태: accountLabel(m),
            퇴사처리일: fmtDate(m.resignedAt),
            입사서약: m.joinPledgeSignedAt ? fmtDateTime(m.joinPledgeSignedAt) : '미서명',
            퇴사서약: m.leavePledgeSignedAt ? fmtDateTime(m.leavePledgeSignedAt) : '미서명',
        })), '개인정보취급자명단', `개인정보취급자명단_${fmtDate(new Date()).replace(/\./g, '')}.xlsx`);
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-1.5">
                    {['전체', '취급자', '퇴사'].map((f) => (
                        <button key={f} onClick={() => setFilter(f)} className={`px-3.5 py-1.5 rounded-full border text-[13px] font-bold ${filter === f ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-white text-gray-600 border-gray-200'}`}>{f}</button>
                    ))}
                </div>
                <button className={btnGhost} onClick={exportList}>📥 엑셀로 내보내기</button>
            </div>
            <div className={`${card} p-4 bg-blue-50/40 border-blue-100 text-[13px] text-gray-600 font-medium`}>
                개인정보 보호책임자: <b>대표자(관리자 계정)</b> · 기사 {people.length}명 중 취급자 {people.filter((m) => m.isHandler).length}명 지정
            </div>
            <div className={`${card} overflow-x-auto`}>
                <table className="min-w-[860px] w-full text-left">
                    <thead className="bg-gray-50 text-[13px] text-gray-500">
                        <tr><th className="px-4 py-3">이름</th><th className="px-4 py-3">연락처</th><th className="px-4 py-3">취급자</th><th className="px-4 py-3">지정일</th><th className="px-4 py-3">해제일</th><th className="px-4 py-3">계정</th><th className="px-4 py-3 text-right">관리</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-[14px]">
                        {rows.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-gray-400 font-bold">표시할 인원이 없습니다.</td></tr>}
                        {rows.map((m) => (
                            <tr key={m.email} className={m.isActive === false ? 'bg-gray-50/70 text-gray-400' : ''}>
                                <td className="px-4 py-3 font-bold">{m.name || '-'}<div className="text-[11.5px] font-medium text-gray-400">{m.email}</div></td>
                                <td className="px-4 py-3">{m.phone || '-'}</td>
                                <td className="px-4 py-3">{m.isHandler ? <Badge tone="blue">지정</Badge> : <Badge>미지정</Badge>}</td>
                                <td className="px-4 py-3">{fmtDate(m.handlerAssignedAt)}</td>
                                <td className="px-4 py-3">{fmtDate(m.handlerReleasedAt)}</td>
                                <td className="px-4 py-3">{m.isActive === false ? <Badge tone="red">퇴사 {fmtDate(m.resignedAt)}</Badge> : <Badge tone="green">재직</Badge>}</td>
                                <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                                    {m.isActive !== false && <button className={btnGhost} disabled={busy === m.email} onClick={() => toggleHandler(m)}>{m.isHandler ? '취급 해제' : '취급자 지정'}</button>}
                                    {m.isActive !== false
                                        ? <button className={`${btn} bg-red-50 text-red-600 border border-red-200 hover:bg-red-100`} disabled={busy === m.email} onClick={() => resign(m)}>퇴사 처리</button>
                                        : <button className={btnGhost} disabled={busy === m.email} onClick={() => reactivate(m)}>재활성화</button>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ───────────────────────── 탭 4: 전자 서약서 ─────────────────────────

const PledgeTab = ({ members, pledges }) => {
    const [showText, setShowText] = useState(null);
    const [busy, setBusy] = useState(null);
    const people = members.filter((m) => m.email !== ADMIN_EMAIL && m.role !== 'admin' && m.isActive !== false);
    const link = `${window.location.origin}/?menu=pledge`;

    const latest = (email, type) => pledges.filter((p) => p.email === email && p.type === type).sort((a, b) => (toDate(b.signedAt) || 0) - (toDate(a.signedAt) || 0))[0];
    const unsignedJoin = people.filter((m) => !latest(m.email, 'join') && !m.joinPledgeSignedAt);

    const copy = async (text, okMsg) => {
        try { await navigator.clipboard.writeText(text); alert(okMsg); } catch { window.prompt('아래 내용을 복사해서 카톡으로 보내세요.', text); }
    };

    const requestLeave = async (m) => {
        if (!window.confirm(`'${m.name}'님에게 퇴사 서약서 서명을 요청할까요?\n해당 기사가 다음에 앱을 열면 서명 화면이 먼저 표시됩니다.`)) return;
        setBusy(m.email);
        try {
            await db.collection('users').doc(m.email).set({ leavePledgeRequired: true, leavePledgeRequestedAt: serverTs() }, { merge: true });
        } catch (e) { alert('요청 실패: ' + e.message); } finally { setBusy(null); }
    };

    const cell = (m, type) => {
        const p = latest(m.email, type);
        if (p) return (<div><Badge tone="green">서명완료</Badge><div className="text-[11.5px] text-gray-400 mt-0.5">{fmtDateTime(p.signedAt)}</div>{p.pdfUrl && <a href={p.pdfUrl} target="_blank" rel="noreferrer" className="text-[12px] font-bold text-blue-600">PDF 보기</a>}</div>);
        const flagTs = type === 'join' ? m.joinPledgeSignedAt : m.leavePledgeSignedAt;
        if (flagTs) return (<div><Badge tone="green">서명완료</Badge><div className="text-[11.5px] text-gray-400 mt-0.5">{fmtDateTime(flagTs)}</div></div>);
        if (type === 'leave' && !m.leavePledgeRequired) return <span className="text-gray-300 text-[13px]">-</span>;
        return <Badge tone={type === 'join' ? 'red' : 'amber'}>{type === 'join' ? '미서명' : '서명 대기'}</Badge>;
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`${card} p-5 ${unsignedJoin.length ? 'bg-red-50/60 border-red-200' : ''}`}>
                    <p className="text-[13px] font-bold text-gray-500 mb-1">입사 서약 미서명</p>
                    <p className="text-[26px] font-extrabold">{unsignedJoin.length}<span className="text-[15px] text-gray-400 ml-1">명</span></p>
                </div>
                <div className={`${card} p-5 md:col-span-2 flex flex-col justify-center gap-2`}>
                    <p className="text-[13px] font-bold text-gray-500">서명 링크 (카톡 공유용) — 로그인 후 바로 서약서 화면이 열립니다</p>
                    <div className="flex gap-2">
                        <input readOnly value={link} className={`${inputCls} text-[13px]`} onFocus={(e) => e.target.select()} />
                        <button className={btnPrimary} onClick={() => copy(`[코끼리물류] 개인정보 보호 서약서 서명 요청\n아래 링크로 접속해 로그인하신 뒤 서명해 주세요.\n${link}`, '카톡 안내 문구가 복사되었습니다.')}>안내문 복사</button>
                    </div>
                </div>
            </div>
            <div className="flex gap-2">
                <button className={btnGhost} onClick={() => setShowText('join')}>입사 서약서 내용 보기</button>
                <button className={btnGhost} onClick={() => setShowText('leave')}>퇴사 서약서 내용 보기</button>
            </div>
            <div className={`${card} overflow-x-auto`}>
                <table className="min-w-[720px] w-full text-left">
                    <thead className="bg-gray-50 text-[13px] text-gray-500">
                        <tr><th className="px-4 py-3">기사</th><th className="px-4 py-3">입사 서약서</th><th className="px-4 py-3">퇴사 서약서</th><th className="px-4 py-3 text-right">관리</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-[14px]">
                        {people.length === 0 && <tr><td colSpan={4} className="py-12 text-center text-gray-400 font-bold">등록된 기사가 없습니다.</td></tr>}
                        {[...people].sort((a, b) => ((latest(a.email, 'join') || a.joinPledgeSignedAt) ? 1 : 0) - ((latest(b.email, 'join') || b.joinPledgeSignedAt) ? 1 : 0)).map((m) => (
                            <tr key={m.email}>
                                <td className="px-4 py-3 font-bold">{m.name || '-'}<div className="text-[11.5px] font-medium text-gray-400">{m.email}</div></td>
                                <td className="px-4 py-3">{cell(m, 'join')}</td>
                                <td className="px-4 py-3">{cell(m, 'leave')}</td>
                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                    {!m.leavePledgeRequired && <button className={btnGhost} disabled={busy === m.email} onClick={() => requestLeave(m)}>퇴사 서약 요청</button>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {showText && (
                <PrivacyModal title={PLEDGE_TYPES[showText].title} onClose={() => setShowText(null)}>
                    <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-gray-800">{PLEDGE_TEXT[showText]}</p>
                </PrivacyModal>
            )}
        </div>
    );
};

// ───────────────────────── 탭 5: 교육 이수 ─────────────────────────

const TrainingTab = ({ user, members }) => {
    const [trainings, setTrainings] = useState([]);
    const [logs, setLogs] = useState([]);
    const [form, setForm] = useState(null);
    const [openId, setOpenId] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => db.collection('privacyTrainings').orderBy('createdAt', 'desc').onSnapshot((s) => setTrainings(s.docs.map((d) => ({ id: d.id, ...d.data() })))), []);
    useEffect(() => db.collection('privacyTrainingLogs').onSnapshot((s) => setLogs(s.docs.map((d) => ({ id: d.id, ...d.data() })))), []);

    const people = members.filter((m) => m.email !== ADMIN_EMAIL && m.role !== 'admin' && m.isActive !== false);

    const save = async () => {
        if (!form.title.trim()) return alert('교육 제목을 입력해주세요.');
        if (form.kind === 'text' && !form.content.trim()) return alert('교육 내용을 입력해주세요.');
        if (form.kind === 'pdf' && !form.file) return alert('PDF 파일을 선택해주세요.');
        setSaving(true);
        try {
            const ref = db.collection('privacyTrainings').doc();
            const data = { title: form.title.trim(), kind: form.kind, durationMin: Number(form.durationMin) || null, minSeconds: Number(form.minSeconds) || 0, active: true, createdAt: serverTs(), createdBy: { email: user.email, name: user.name } };
            if (form.kind === 'text') {
                data.content = form.content;
            } else {
                const path = `privacy/training/${ref.id}.pdf`;
                await storage.ref(path).put(form.file, { contentType: 'application/pdf' });
                data.filePath = path;
                data.fileUrl = await storage.ref(path).getDownloadURL();
            }
            await ref.set(data);
            setForm(null);
        } catch (e) {
            alert('저장 실패: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (t) => {
        try { await db.collection('privacyTrainings').doc(t.id).update({ active: !t.active }); } catch (e) { alert('실패: ' + e.message); }
    };

    const statusRows = (t) => people.map((m) => {
        const log = logs.find((l) => l.trainingId === t.id && l.email === m.email);
        return { m, log };
    });

    const exportTraining = (t) => {
        exportXlsx(statusRows(t).map(({ m, log }) => ({
            교육명: t.title, 이름: m.name || '', 이메일: m.email, 연락처: m.phone || '',
            이수여부: log ? '이수' : '미이수', 이수일시: log ? fmtDateTime(log.completedAt) : '',
        })), '교육이수현황', `교육이수_${t.title.slice(0, 20)}_${fmtDate(new Date()).replace(/\./g, '')}.xlsx`);
    };

    if (form) {
        return (
            <div className={`${card} p-5 space-y-4`}>
                <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-[18px]">새 교육자료 등록</h3>
                    <div className="flex gap-2">
                        <button className={btnGhost} onClick={() => setForm(null)}>취소</button>
                        <button className={btnPrimary} disabled={saving} onClick={save}>{saving ? '등록 중...' : '등록'}</button>
                    </div>
                </div>
                <div className="flex gap-2">
                    {[['text', '텍스트'], ['pdf', 'PDF']].map(([k, l]) => (
                        <button key={k} onClick={() => setForm({ ...form, kind: k })} className={`px-4 py-1.5 rounded-full border text-[13px] font-bold ${form.kind === k ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-white text-gray-600 border-gray-200'}`}>{l}</button>
                    ))}
                    {form.kind === 'text' && <button className={`${btnGhost} ml-auto`} onClick={() => setForm({ ...form, title: DEFAULT_TRAINING.title, content: DEFAULT_TRAINING.content, durationMin: DEFAULT_TRAINING.durationMin, minSeconds: DEFAULT_TRAINING.minSeconds })}>기본 교육자료 초안 불러오기</button>}
                </div>
                <input className={inputCls} placeholder="교육 제목" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                    <input className={inputCls} type="number" placeholder="예상 소요시간(분)" value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: e.target.value })} />
                    <input className={inputCls} type="number" placeholder="최소 열람시간(초) — 이 시간 전에는 이수 불가" value={form.minSeconds} onChange={(e) => setForm({ ...form, minSeconds: e.target.value })} />
                </div>
                {form.kind === 'text'
                    ? <textarea className={`${inputCls} leading-relaxed`} rows={18} placeholder="교육 내용" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
                    : <input type="file" accept="application/pdf" onChange={(e) => setForm({ ...form, file: e.target.files[0] || null })} />}
                <p className="text-[12.5px] text-gray-400 font-medium">등록 후에는 내용을 수정할 수 없습니다. (이수 기록의 근거 보존) 내용을 바꾸려면 새 교육자료를 등록하고 기존 자료는 "종료"하세요.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <button className={btnPrimary} onClick={() => setForm({ kind: 'text', title: '', content: '', durationMin: '', minSeconds: '', file: null })}>+ 교육자료 등록</button>
            </div>
            {trainings.length === 0 && <div className={`${card} p-10 text-center text-gray-400 font-bold`}>등록된 교육자료가 없습니다. "기본 교육자료 초안 불러오기"로 바로 시작할 수 있어요.</div>}
            {trainings.map((t) => {
                const rows = statusRows(t);
                const done = rows.filter((r) => r.log).length;
                return (
                    <div key={t.id} className={`${card} p-5`}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <p className="font-extrabold text-[16px]">{t.title} {!t.active && <Badge>종료</Badge>}</p>
                                <p className="text-[12.5px] text-gray-400 font-medium mt-0.5">{t.kind === 'pdf' ? 'PDF' : '텍스트'}{t.durationMin ? ` · 약 ${t.durationMin}분` : ''} · 등록 {fmtDate(t.createdAt)}</p>
                            </div>
                            <div className="flex flex-wrap gap-1.5 items-center">
                                <Badge tone={done === rows.length && rows.length > 0 ? 'green' : 'amber'}>이수 {done}/{rows.length}</Badge>
                                <button className={btnGhost} onClick={() => setOpenId(openId === t.id ? null : t.id)}>{openId === t.id ? '접기' : '참여자 목록'}</button>
                                <button className={btnGhost} onClick={() => exportTraining(t)}>📥 엑셀</button>
                                <button className={btnGhost} onClick={() => toggleActive(t)}>{t.active ? '종료' : '다시 열기'}</button>
                            </div>
                        </div>
                        {openId === t.id && (
                            <div className="mt-4 border border-gray-100 rounded-xl overflow-x-auto">
                                <table className="min-w-[480px] w-full text-left text-[14px]">
                                    <thead className="bg-gray-50 text-[13px] text-gray-500"><tr><th className="px-4 py-2.5">이름</th><th className="px-4 py-2.5">상태</th><th className="px-4 py-2.5">이수일시</th></tr></thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {[...rows].sort((a, b) => (a.log ? 1 : 0) - (b.log ? 1 : 0)).map(({ m, log }) => (
                                            <tr key={m.email}><td className="px-4 py-2.5 font-bold">{m.name || m.email}</td><td className="px-4 py-2.5">{log ? <Badge tone="green">이수</Badge> : <Badge tone="red">미이수</Badge>}</td><td className="px-4 py-2.5 text-gray-500">{log ? fmtDateTime(log.completedAt) : '-'}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// ───────────────────────── 메인 ─────────────────────────

const TABS = [['docs', '📘 문서 보관함'], ['check', '✅ 연간 점검'], ['handlers', '👥 취급자 명단'], ['pledge', '✍️ 전자 서약서'], ['training', '🎓 교육 이수']];

const PrivacyManagement = ({ user, contacts = [], setActivePage }) => {
    const isAdmin = user && user.email === ADMIN_EMAIL;
    const [tab, setTab] = useState('docs');
    const [members, setMembers] = useState([]);
    const [pledges, setPledges] = useState([]);

    useEffect(() => {
        if (!isAdmin) return undefined;
        const u1 = db.collection('users').onSnapshot((s) => setMembers(s.docs.map((d) => ({ email: d.id, ...d.data() }))));
        const u2 = db.collection('pledges').onSnapshot((s) => setPledges(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
        return () => { u1(); u2(); };
    }, [isAdmin]);

    if (!isAdmin) {
        return (
            <main className="md:ml-[260px] ml-0 px-4 md:px-10 py-6 md:py-12 flex-1 relative bg-[#F4F7FB] min-h-[100vh] flex items-center justify-center">
                <p className="text-gray-400 font-bold">이 화면은 대표자(관리자) 전용입니다.</p>
            </main>
        );
    }

    return (
        <main className="md:ml-[260px] ml-0 px-4 md:px-10 py-6 md:py-12 flex-1 relative bg-[#F4F7FB] min-h-[100vh] w-full max-w-[100vw] md:max-w-[calc(100vw-260px)] overflow-x-hidden">
            <header className="mb-6 border-b pb-5 border-gray-200">
                <h2 className="text-[28px] font-extrabold mb-1.5 text-[#1E293B]">🔒 개인정보 관리</h2>
                <p className="text-gray-500 text-[15px] font-medium">쿠팡 위탁사 개인정보 보호 점검 대응 · 대표자 전용</p>
            </header>
            <div className="flex gap-1.5 overflow-x-auto pb-2 mb-5">
                {TABS.map(([k, l]) => (
                    <button key={k} onClick={() => setTab(k)} className={`shrink-0 px-4 py-2 rounded-xl text-[14px] font-bold border transition-colors ${tab === k ? 'bg-[#2E68ED] text-white border-[#2E68ED]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{l}</button>
                ))}
            </div>
            <div className="max-w-[1100px]">
                {tab === 'docs' && <DocsTab user={user} contacts={contacts} setActivePage={setActivePage} />}
                {tab === 'check' && <CheckTab user={user} />}
                {tab === 'handlers' && <HandlersTab members={members} />}
                {tab === 'pledge' && <PledgeTab members={members} pledges={pledges} />}
                {tab === 'training' && <TrainingTab user={user} members={members} />}
            </div>
        </main>
    );
};

export { PrivacyManagement };
