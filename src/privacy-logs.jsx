import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebase';
import { logAccess } from './audit';
import {
    serverTs, toDate, fmtDate, fmtDateTime, exportXlsx, downloadBlob, reactToPdfBlob, maskEmail,
    PrivacyModal, SignaturePad, Paper, COMPANY, ACTION_LABEL,
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

// ───────────────────────── 접속기록 ─────────────────────────

export const AccessLogTab = () => {
    const [days, setDays] = useState(7);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionFilter, setActionFilter] = useState('all');
    const [text, setText] = useState('');
    const [visible, setVisible] = useState(50);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError('');
        const since = new Date(Date.now() - days * 86400000);
        db.collection('accessLogs').where('createdAt', '>=', since).orderBy('createdAt', 'desc').limit(3000).get()
            .then((snap) => { if (!cancelled) setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); })
            .catch((e) => { if (!cancelled) setError(e.message); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [days]);

    useEffect(() => { setVisible(50); }, [days, actionFilter, text]);

    const filtered = useMemo(() => logs.filter((l) => {
        if (actionFilter !== 'all' && l.action !== actionFilter) return false;
        const q = text.trim().toLowerCase();
        if (q && !`${l.email} ${l.detail} ${l.ip}`.toLowerCase().includes(q)) return false;
        return true;
    }), [logs, actionFilter, text]);

    const isNight = (l) => l.role === 'admin' && (toDate(l.createdAt)?.getHours() ?? 12) < 5;
    const nightCount = filtered.filter(isNight).length;
    const ipCount = new Set(filtered.filter((l) => l.role === 'admin' && l.ip).map((l) => l.ip)).size;

    const exportLogs = (masked) => {
        if (!masked && !window.confirm('계정(이메일)을 가리지 않고 내보냅니다. 업무상 꼭 필요한 경우에만 진행하세요. (이 내보내기도 접속기록에 남습니다)')) return;
        exportXlsx(filtered.map((l) => ({
            일시: fmtDateTime(l.createdAt), 계정: masked ? maskEmail(l.email) : l.email, 구분: l.role === 'admin' ? '관리자' : '기사',
            수행업무: ACTION_LABEL[l.action] || l.action, 상세: l.detail || '', 접속지IP: l.ip || '',
        })), '접속기록', `접속기록_${days}일_${fmtDate(new Date()).replace(/\./g, '')}.xlsx`, masked ? '마스킹' : '원본');
    };

    return (
        <div className="space-y-4">
            <div className={`${card} p-4 bg-blue-50/40 border-blue-100 text-[13px] text-gray-600 font-medium leading-relaxed`}>
                접속(로그인), 서류·계약서 열람/다운로드, 엑셀 내보내기, 권한 변경 등을 <b>서버가 계정·일시·접속지(IP)와 함께 자동 기록</b>합니다. 기록은 수정·삭제할 수 없고(위·변조 방지) <b>3년 이상 보관</b>하며 자동 삭제하지 않습니다. 월 1회 이상 [점검 기록 → 접속기록 점검]에서 점검 결과를 남기세요.
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {[[1, '오늘 포함 1일'], [7, '7일'], [30, '30일'], [90, '90일']].map(([d, l]) => (
                    <button key={d} onClick={() => setDays(d)} className={`px-3.5 py-1.5 rounded-full border text-[13px] font-bold ${days === d ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-white text-gray-600 border-gray-200'}`}>{l}</button>
                ))}
                <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-[13.5px] font-bold bg-white">
                    <option value="all">전체 업무</option>
                    {Object.entries(ACTION_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="계정·내용·IP 검색" className="border border-gray-200 rounded-xl px-3 py-2 text-[13.5px] font-medium bg-white outline-none focus:border-blue-500 w-[200px]" />
                <div className="ml-auto flex gap-2">
                    <button className={btnGhost} onClick={() => exportLogs(true)}>📥 엑셀(가림)</button>
                    <button className={btnGhost} onClick={() => exportLogs(false)}>📥 엑셀(원본)</button>
                </div>
            </div>
            <div className="flex flex-wrap gap-2 text-[13px]">
                <Badge tone="blue">조회 {filtered.length}건</Badge>
                <Badge tone={nightCount ? 'amber' : 'green'}>관리자 새벽(00~05시) 접속 {nightCount}건</Badge>
                <Badge tone="gray">관리자 접속지(IP) {ipCount}종</Badge>
                {logs.length >= 3000 && <Badge tone="amber">최근 3,000건까지만 표시됩니다</Badge>}
            </div>
            {error && <div className={`${card} p-4 text-red-600 text-[13px] font-bold`}>불러오기 실패: {error}</div>}
            <div className={`${card} overflow-x-auto`}>
                <table className="min-w-[820px] w-full text-left">
                    <thead className="bg-gray-50 text-[13px] text-gray-500">
                        <tr><th className="px-4 py-3">일시</th><th className="px-4 py-3">계정</th><th className="px-4 py-3">수행 업무</th><th className="px-4 py-3">상세</th><th className="px-4 py-3">접속지(IP)</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-[13.5px]">
                        {loading && <tr><td colSpan={5} className="py-12 text-center text-gray-400 font-bold">불러오는 중...</td></tr>}
                        {!loading && filtered.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-gray-400 font-bold">해당 기간 접속기록이 없습니다.</td></tr>}
                        {filtered.slice(0, visible).map((l) => (
                            <tr key={l.id} className={isNight(l) ? 'bg-amber-50/50' : ''}>
                                <td className="px-4 py-2.5 whitespace-nowrap">{fmtDateTime(l.createdAt)}</td>
                                <td className="px-4 py-2.5">{maskEmail(l.email)} {l.role === 'admin' && <Badge tone="blue">관리자</Badge>}</td>
                                <td className="px-4 py-2.5 font-bold">{ACTION_LABEL[l.action] || l.action}</td>
                                <td className="px-4 py-2.5 text-gray-500">{l.detail || '-'}</td>
                                <td className="px-4 py-2.5 text-gray-500">{l.ip || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {filtered.length > visible && <button className={`${btnGhost} w-full`} onClick={() => setVisible((v) => v + 100)}>더 보기 ({filtered.length - visible}건 남음)</button>}
        </div>
    );
};

// ───────────────────────── 개인정보 사고 대장 ─────────────────────────

const INCIDENT_TYPES = ['개인정보 유출', '분실·도난(서류·기기)', '무단 접근·계정 탈취', '오발송·오제공', '기타'];
const EVENT_TYPES = ['초동 조치', '쿠팡 보고', '정보주체 통지', '관계기관 신고', '재발방지 대책', '종결'];

const IncidentSection = ({ user }) => {
    const [incidents, setIncidents] = useState([]);
    const [events, setEvents] = useState({});
    const [form, setForm] = useState(null);
    const [saving, setSaving] = useState(false);
    const [openId, setOpenId] = useState(null);
    const [evForm, setEvForm] = useState({ type: '쿠팡 보고', memo: '' });
    const [tick, setTick] = useState(0);

    useEffect(() => db.collection('privacyIncidents').orderBy('createdAt', 'desc').onSnapshot((s) => setIncidents(s.docs.map((d) => ({ id: d.id, ...d.data() })))), []);
    useEffect(() => {
        let cancelled = false;
        Promise.all(incidents.map((i) => db.collection('privacyIncidents').doc(i.id).collection('events').orderBy('createdAt', 'asc').get().then((s) => [i.id, s.docs.map((d) => d.data())])))
            .then((pairs) => { if (!cancelled) setEvents(Object.fromEntries(pairs)); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [incidents, tick]);

    const save = async () => {
        if (!form.content.trim()) return alert('사고 내용을 입력해주세요.');
        if (!window.confirm('사고를 대장에 등록할까요?\n등록 후에는 수정·삭제할 수 없고(처리 경과는 계속 추가 가능), 등록 시각은 서버 시각으로 기록됩니다.')) return;
        setSaving(true);
        try {
            await db.collection('privacyIncidents').add({
                type: form.type, discoveredAt: form.discoveredAt || '', content: form.content.trim(), impact: form.impact.trim(), firstAction: form.firstAction.trim(),
                createdBy: { email: user.email, name: user.name }, createdAt: serverTs(),
            });
            logAccess('privacy_record_save', '개인정보 사고 등록');
            setForm(null);
        } catch (e) { alert('등록 실패: ' + e.message); } finally { setSaving(false); }
    };

    const addEvent = async (incidentId) => {
        if (!evForm.memo.trim()) return alert('내용을 입력해주세요.');
        try {
            await db.collection('privacyIncidents').doc(incidentId).collection('events').add({ type: evForm.type, memo: evForm.memo.trim(), by: user.name, createdAt: serverTs() });
            logAccess('privacy_record_save', `사고 경과 추가: ${evForm.type}`);
            setEvForm({ type: evForm.type, memo: '' });
            setTick((t) => t + 1);
        } catch (e) { alert('추가 실패: ' + e.message); }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-[17px]">🚨 개인정보 사고 대장 <span className="text-[12.5px] text-gray-400 font-medium">(조사표 4번: 사고 발생 시 쿠팡 보고 기록)</span></h3>
                <button className={btnPrimary} onClick={() => setForm({ type: INCIDENT_TYPES[0], discoveredAt: '', content: '', impact: '', firstAction: '' })}>+ 사고 등록</button>
            </div>
            {incidents.length === 0 && <div className={`${card} p-6 text-center text-gray-500 font-bold text-[13.5px]`}>등록된 사고가 없습니다. 최근 1년간 사고가 없었다면 이 대장은 비어 있어도 됩니다.</div>}
            {incidents.map((i) => {
                const evs = events[i.id] || [];
                const reported = evs.some((e) => e.type === '쿠팡 보고');
                return (
                    <div key={i.id} className={`${card} p-4`}>
                        <div className="flex flex-wrap items-center justify-between gap-2 cursor-pointer" onClick={() => setOpenId(openId === i.id ? null : i.id)}>
                            <div>
                                <p className="font-extrabold text-[15px]">{i.type} <span className="text-[12px] text-gray-400 font-medium">등록 {fmtDateTime(i.createdAt)}{i.discoveredAt ? ` · 인지 ${i.discoveredAt.replace('T', ' ')}` : ''}</span></p>
                                <p className="text-[13px] text-gray-600 mt-0.5 line-clamp-2">{i.content}</p>
                            </div>
                            {reported ? <Badge tone="green">쿠팡 보고 완료</Badge> : <Badge tone="red">쿠팡 보고 미기록</Badge>}
                        </div>
                        {openId === i.id && (
                            <div className="mt-3 space-y-3 border-t border-gray-100 pt-3 text-[13.5px]">
                                {i.impact && <p><b>영향(항목·규모):</b> {i.impact}</p>}
                                {i.firstAction && <p><b>초동 조치:</b> {i.firstAction}</p>}
                                <div className="space-y-1.5">
                                    {evs.map((e, idx) => <div key={idx} className="bg-gray-50 rounded-lg px-3 py-2"><Badge tone={e.type === '쿠팡 보고' ? 'green' : 'blue'}>{e.type}</Badge> <span className="text-[12px] text-gray-400">{fmtDateTime(e.createdAt)} · {e.by}</span><div>{e.memo}</div></div>)}
                                    {evs.length === 0 && <p className="text-gray-400">추가된 처리 경과가 없습니다.</p>}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <select className="border border-gray-200 rounded-xl px-3 py-2 text-[13.5px] font-bold bg-white" value={evForm.type} onChange={(e) => setEvForm({ ...evForm, type: e.target.value })}>{EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
                                    <input className={`${inputCls} flex-1 min-w-[200px]`} placeholder="내용 (예: 쿠팡 담당자에게 전화 보고, 보고 방법·담당자)" value={evForm.memo} onChange={(e) => setEvForm({ ...evForm, memo: e.target.value })} />
                                    <button className={btnPrimary} onClick={() => addEvent(i.id)}>경과 추가</button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
            {form && (
                <PrivacyModal title="개인정보 사고 등록" onClose={() => setForm(null)}>
                    <div className="space-y-3">
                        <select className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{INCIDENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
                        <div><p className="text-[12.5px] font-bold text-gray-500 mb-1">사고를 알게 된 일시 (선택)</p><input type="datetime-local" className={inputCls} value={form.discoveredAt} onChange={(e) => setForm({ ...form, discoveredAt: e.target.value })} /></div>
                        <textarea className={inputCls} rows={4} placeholder="사고 내용 (무슨 일이 있었는지)" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
                        <input className={inputCls} placeholder="영향 받은 개인정보 항목과 규모 (예: 기사 3명 연락처)" value={form.impact} onChange={(e) => setForm({ ...form, impact: e.target.value })} />
                        <input className={inputCls} placeholder="초동 조치 내용" value={form.firstAction} onChange={(e) => setForm({ ...form, firstAction: e.target.value })} />
                        <p className="text-[12px] text-gray-400 font-medium">등록 시각은 서버 시각으로 자동 기록됩니다. 쿠팡 보고 등 이후 처리는 등록 후 "경과 추가"로 남기세요.</p>
                        <button className={`${btnPrimary} w-full`} disabled={saving} onClick={save}>{saving ? '등록 중...' : '대장에 등록'}</button>
                    </div>
                </PrivacyModal>
            )}
        </div>
    );
};

// ───────────────────────── 파기 대장 · 파기확약서 ─────────────────────────

const DESTROY_CATEGORIES = ['퇴사자 계정·회원정보', '서류 사본(자격증·등록증 등)', '계약서·동의서', '종이 문서', '출력물·복사물', '저장매체(USB 등)', '기타'];
const DESTROY_REASONS = ['보유기간 경과', '처리 목적 달성', '계약(근무) 종료', '정보주체 요청', '위탁사 요청', '기타'];
const DESTROY_METHODS = ['전자파일 영구 삭제(복구 불가)', '파쇄', '소각', '저장매체 물리적 파기', '기타'];

const CertPaper = ({ rec }) => (
    <Paper>
        <h1 style={{ fontSize: 24, fontWeight: 800, textAlign: 'center', marginBottom: 28 }}>개인정보 파기 확약서</h1>
        <div style={{ marginBottom: 14 }}>수신: {rec.recipient}</div>
        <div style={{ marginBottom: 18 }}>
            {COMPANY}(이하 “회사”)는 {rec.recipient}로부터 위탁받은 업무와 관련하여 보유하던 개인정보 중 아래 표의 개인정보를 「개인정보 보호법」 및 위탁 계약에 따라 복구·재생할 수 없는 방법으로 파기하였음을 확약합니다.
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead><tr>{['파기일시', '파기 대상', '사유', '방법', '건수'].map((h) => <th key={h} style={{ border: '1px solid #aaa', padding: '5px 6px', background: '#f3f4f6' }}>{h}</th>)}</tr></thead>
            <tbody>{rec.snapshot.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={{ border: '1px solid #ccc', padding: '5px 6px' }}>{c}</td>)}</tr>)}</tbody>
        </table>
        <div style={{ marginTop: 22 }}>위 내용이 사실임을 확인합니다.</div>
        <div style={{ marginTop: 26 }}>
            <div>작성일: {fmtDate(rec.createdAt)}</div>
            <div>{COMPANY} 대표자(개인정보 보호책임자): {rec.inspector?.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}><span>서명:</span>{rec.signature && <img src={rec.signature} alt="서명" style={{ height: 64, objectFit: 'contain' }} />}</div>
        </div>
    </Paper>
);

const DestructionSection = ({ user, checks }) => {
    const [logs, setLogs] = useState([]);
    const [form, setForm] = useState(null);
    const [saving, setSaving] = useState(false);
    const [certForm, setCertForm] = useState(null);
    const [viewing, setViewing] = useState(null);

    useEffect(() => db.collection('destructionLogs').orderBy('createdAt', 'desc').onSnapshot((s) => setLogs(s.docs.map((d) => ({ id: d.id, ...d.data() })))), []);
    const certs = checks.filter((c) => c.kind === 'destruction_cert');

    const save = async () => {
        if (!form.subject.trim()) return alert('파기한 개인정보(대상)를 입력해주세요.');
        if (!window.confirm('파기 내역을 대장에 기록할까요?\n기록 후에는 수정·삭제할 수 없고, 기록 시각은 서버 시각입니다.')) return;
        setSaving(true);
        try {
            await db.collection('destructionLogs').add({ ...form, subject: form.subject.trim(), count: form.count.trim(), performer: user.name, createdBy: user.email, createdAt: serverTs() });
            logAccess('privacy_record_save', `파기 기록: ${form.category}`);
            setForm(null);
        } catch (e) { alert('기록 실패: ' + e.message); } finally { setSaving(false); }
    };

    const issueCert = async () => {
        if (certForm.selected.size === 0) return alert('확약서에 넣을 파기 내역을 선택해주세요.');
        if (!certForm.recipient.trim()) return alert('수신처를 입력해주세요.');
        if (!certForm.signature) return alert('서명을 입력해주세요.');
        if (!window.confirm('파기확약서를 발행할까요? 발행 후에는 수정·삭제할 수 없고 작성일은 오늘 날짜로 자동 기록됩니다.')) return;
        setSaving(true);
        try {
            const rows = logs.filter((l) => certForm.selected.has(l.id)).map((l) => [fmtDateTime(l.createdAt), `${l.category}: ${l.subject}`, l.reason, l.method, l.count || '-']);
            await db.collection('privacyChecks').add({
                kind: 'destruction_cert', year: new Date().getFullYear(), items: [], recipient: certForm.recipient.trim(),
                snapshot: { title: '파기 내역', head: ['파기일시', '파기 대상', '사유', '방법', '건수'], rows },
                inspector: { name: user.name, email: user.email }, signature: certForm.signature, createdAt: serverTs(),
            });
            logAccess('privacy_record_save', '파기확약서 발행');
            setCertForm(null);
        } catch (e) { alert('발행 실패: ' + e.message); } finally { setSaving(false); }
    };

    const certPdf = async (rec) => {
        try {
            logAccess('export', '파기확약서 PDF');
            downloadBlob(await reactToPdfBlob(<CertPaper rec={rec} />), `파기확약서_${fmtDate(rec.createdAt).replace(/\./g, '')}.pdf`);
        } catch (e) { alert('PDF 생성 실패: ' + e.message); }
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-extrabold text-[17px]">🗑️ 개인정보 파기 대장 · 파기확약서 <span className="text-[12.5px] text-gray-400 font-medium">(조사표 18·19·20번)</span></h3>
                <div className="flex gap-2">
                    <button className={btnGhost} onClick={() => setCertForm({ selected: new Set(), recipient: '쿠팡로지스틱스서비스(주)', signature: null })}>📄 파기확약서 발행</button>
                    <button className={btnPrimary} onClick={() => setForm({ category: DESTROY_CATEGORIES[0], subject: '', reason: DESTROY_REASONS[0], method: DESTROY_METHODS[0], count: '' })}>+ 파기 기록</button>
                </div>
            </div>
            <p className="text-[12.5px] text-gray-500 font-medium leading-relaxed">개인정보를 파기할 때마다(보유기간 경과·목적 달성 시 5일 이내) 이 대장에 남기세요. 법령에 따라 보존해야 하는 정보는 파기하지 말고 다른 개인정보와 분리해 보관하세요. 위탁사가 요구하는 주기에 맞춰 파기확약서를 발행해 전달합니다.</p>
            <div className={`${card} overflow-x-auto`}>
                <table className="min-w-[760px] w-full text-left">
                    <thead className="bg-gray-50 text-[13px] text-gray-500"><tr><th className="px-4 py-3">기록일시</th><th className="px-4 py-3">대상</th><th className="px-4 py-3">사유</th><th className="px-4 py-3">방법</th><th className="px-4 py-3">건수</th><th className="px-4 py-3">담당</th></tr></thead>
                    <tbody className="divide-y divide-gray-50 text-[13.5px]">
                        {logs.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-gray-400 font-bold">파기 기록이 없습니다. (파기 사유가 발생하지 않았다면 비어 있어도 됩니다)</td></tr>}
                        {logs.map((l) => <tr key={l.id}><td className="px-4 py-2.5 whitespace-nowrap">{fmtDateTime(l.createdAt)}</td><td className="px-4 py-2.5"><b>{l.category}</b><div className="text-gray-500">{l.subject}</div></td><td className="px-4 py-2.5">{l.reason}</td><td className="px-4 py-2.5">{l.method}</td><td className="px-4 py-2.5">{l.count || '-'}</td><td className="px-4 py-2.5">{l.performer}</td></tr>)}
                    </tbody>
                </table>
            </div>
            {certs.length > 0 && (
                <div className={`${card} p-4`}>
                    <p className="font-extrabold text-[14px] mb-2">발행한 파기확약서</p>
                    <div className="divide-y divide-gray-50">
                        {certs.map((c) => <div key={c.id} className="flex items-center justify-between py-2 text-[13.5px]"><span>{fmtDateTime(c.createdAt)} · {c.recipient} · {c.snapshot.rows.length}건</span><span className="space-x-1.5"><button className={btnGhost} onClick={() => setViewing(c)}>보기</button><button className={btnGhost} onClick={() => certPdf(c)}>PDF</button></span></div>)}
                    </div>
                </div>
            )}
            {form && (
                <PrivacyModal title="파기 기록" onClose={() => setForm(null)}>
                    <div className="space-y-3">
                        <select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{DESTROY_CATEGORIES.map((t) => <option key={t}>{t}</option>)}</select>
                        <input className={inputCls} placeholder="파기한 개인정보 (예: 퇴사자 ○○○ 연락처·서류 사본)" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                        <select className={inputCls} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>{DESTROY_REASONS.map((t) => <option key={t}>{t}</option>)}</select>
                        <select className={inputCls} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>{DESTROY_METHODS.map((t) => <option key={t}>{t}</option>)}</select>
                        <input className={inputCls} placeholder="건수 (예: 3건, 5명)" value={form.count} onChange={(e) => setForm({ ...form, count: e.target.value })} />
                        <p className="text-[12px] text-gray-400 font-medium">기록 시각은 서버 시각으로 자동 기록됩니다.</p>
                        <button className={`${btnPrimary} w-full`} disabled={saving} onClick={save}>{saving ? '기록 중...' : '대장에 기록'}</button>
                    </div>
                </PrivacyModal>
            )}
            {certForm && (
                <PrivacyModal title="파기확약서 발행" onClose={() => setCertForm(null)}>
                    <div className="space-y-3">
                        <input className={inputCls} placeholder="수신처" value={certForm.recipient} onChange={(e) => setCertForm({ ...certForm, recipient: e.target.value })} />
                        <p className="text-[13px] font-extrabold">확약서에 넣을 파기 내역 선택</p>
                        <div className="max-h-[200px] overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
                            {logs.length === 0 && <p className="p-4 text-gray-400 text-[13px] font-bold">먼저 파기 기록을 남겨주세요.</p>}
                            {logs.map((l) => (
                                <label key={l.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50 text-[13px]">
                                    <input type="checkbox" className="w-4 h-4 accent-blue-600" checked={certForm.selected.has(l.id)} onChange={(e) => { const n = new Set(certForm.selected); if (e.target.checked) n.add(l.id); else n.delete(l.id); setCertForm({ ...certForm, selected: n }); }} />
                                    <span>{fmtDate(l.createdAt)} · {l.category}: {l.subject}</span>
                                </label>
                            ))}
                        </div>
                        <SignaturePad onChange={(sig) => setCertForm((f) => ({ ...f, signature: sig }))} />
                        <button className={`${btnPrimary} w-full`} disabled={saving} onClick={issueCert}>{saving ? '발행 중...' : '확약서 발행'}</button>
                    </div>
                </PrivacyModal>
            )}
            {viewing && <PrivacyModal title="파기확약서" wide onClose={() => setViewing(null)}><div className="overflow-x-auto border border-gray-100 rounded-xl"><CertPaper rec={viewing} /></div></PrivacyModal>}
        </div>
    );
};

// 퇴사 후 12개월이 지나면 서버가 매일 새벽 3시에 자동 파기합니다. (functions/index.js purgeExpiredPersonalData)
const RETENTION_MONTHS = 12;
const AutoPurgeNotice = ({ members }) => {
    const upcoming = (members || [])
        .filter((m) => m.isActive === false && toDate(m.resignedAt))
        .map((m) => { const d = new Date(toDate(m.resignedAt)); d.setMonth(d.getMonth() + RETENTION_MONTHS); return { name: m.name || '이름 없음', due: d }; })
        .sort((a, b) => a.due - b.due);
    return (
        <div className={`${card} p-4 bg-emerald-50/40 border-emerald-200 text-[13px] text-gray-700 font-medium leading-relaxed`}>
            <p className="font-extrabold text-[14px] text-emerald-800 mb-1">⏱ 퇴사자 정보 자동 파기 (보유기간 {RETENTION_MONTHS}개월)</p>
            <p>퇴사 처리 후 {RETENTION_MONTHS}개월이 지나면 매일 새벽 3시에 <b>회원정보·비상연락망·서류 사본·차량 유지비 기록·로그인 계정</b>을 자동 파기하고, 위 대장에 "시스템(자동 파기)"으로 기록합니다.</p>
            <p className="mt-1 text-gray-500">계약서·동의서·서약서·교육 이수·접속기록·업무내역·안전보건 기록은 증빙·법령 보존을 위해 자동 파기하지 않습니다. 이 자료의 보존 기간은 별도로 확인해 정해 주세요.</p>
            {upcoming.length > 0 && <p className="mt-2">파기 예정: {upcoming.slice(0, 5).map((u) => `${u.name} (${fmtDate(u.due)})`).join(', ')}{upcoming.length > 5 ? ` 외 ${upcoming.length - 5}명` : ''}</p>}
        </div>
    );
};

export const IncidentDestructionTab = ({ user, checks, members }) => (
    <div className="space-y-8">
        <IncidentSection user={user} />
        <AutoPurgeNotice members={members} />
        <DestructionSection user={user} checks={checks} />
    </div>
);
