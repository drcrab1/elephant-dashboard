import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db } from './firebase';
import { Icons } from './ui-components';
import * as XLSX from 'xlsx';

const ADMIN_EMAIL = 's01025144826@gmail.com';

const VENDOR = '코끼리물류/ELSPH';
const BIZ_NO = '5283201250';
const WAVE = 'WAVE1';
const DEFAULT_ROTATION = 'D1,D2,F3';
const DAYS_KR = ['일', '월', '화', '수', '목', '금', '토'];
const CAMP_NAMES = ['송파4', '남양주4', '구리2', 'F_장안1'];

const DEFAULT_DRIVERS = [
    { name: '이성규', id: 'sg3249' }, { name: '임재섭', id: 'rianria0217' }, { name: '김선용', id: 'les830903' },
    { name: '김성훈', id: 'kshom402' }, { name: '김백준', id: 'bjun0423' }, { name: '김성준', id: 'tjdwnszg1' },
    { name: '김대건', id: 'daegunto' }, { name: '백종춘', id: 'baek125' }, { name: '김용경', id: 'yong0die' },
    { name: '전인철', id: 'k1juya' }, { name: '설영대', id: 'skfhddl' }, { name: '권오민', id: 'min55555' },
    { name: '정봉성', id: 'sung2502' }, { name: '황원동', id: 'ddong80' }
];
const DEFAULT_ROUTES = [
    { key: '503AB', camp: '남양주4', code: '503A,503B', splitCodes: ['503A', '503B'] },
    { key: '503CD', camp: '남양주4', code: '503C,503D', splitCodes: ['503C', '503D'] },
    { key: '402CD', camp: '남양주4', code: '402C,402D', splitCodes: ['402C', '402D'] },
    { key: '001CD', camp: '구리2', code: '001C,001D', splitCodes: ['001C', '001D'] },
    { key: '901CD', camp: '구리2', code: '901C,901D', splitCodes: ['901C', '901D'] },
    { key: '452ABCD', camp: 'F_장안1', code: '452A,452B,452C', fullCode: '452A,452B,452C,452D' },
    { key: '454ABD', camp: 'F_장안1', code: '454A,454D', fullCode: '454A,454D,454B' },
    { key: '452D+454B', camp: 'F_장안1', code: '452D,454B' },
    { key: '303CD', camp: '송파4', code: '303C,303D', splitCodes: ['303C', '303D'] }
];
const DEFAULT_CAMP_DRIVERS = {
    '송파4': ['김성준', '백종춘', '설영대', '권오민', '김대건', '정봉성', '황원동'],
    '남양주4': ['설영대', '김대건', '임재섭', '이성규', '김성준', '권오민', '김선용'],
    '구리2': ['권오민', '설영대', '임재섭', '김성훈', '백종춘', '김성준', '김백준', '김대건', '김용경', '전인철'],
    'F_장안1': ['김대건', '김용경', '전인철', '백종춘', '김성준', '설영대', '권오민']
};
const DEFAULT_ABBREV = {
    '오민': '권오민', '성규': '이성규', '재섭': '임재섭', '선용': '김선용', '성훈': '김성훈', '백준': '김백준',
    '성준': '김성준', '대건': '김대건', '종춘': '백종춘', '용경': '김용경', '인철': '전인철', '영대': '설영대',
    '봉성': '정봉성', '원동': '황원동'
};

const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const parseDateStr = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const getStartOfCurrentWeek = () => {
    const today = new Date();
    const day = today.getDay();
    const daysSinceSaturday = (day + 1) % 7;
    const saturday = new Date(today);
    saturday.setDate(today.getDate() - daysSinceSaturday);
    saturday.setHours(0, 0, 0, 0);
    return saturday;
};

export const DispatchConverter = ({ user }) => {
    const isAdmin = user && user.email === ADMIN_EMAIL;

    const [drivers, setDrivers] = useState(DEFAULT_DRIVERS);
    const [routes, setRoutes] = useState(DEFAULT_ROUTES);
    const [campDrivers, setCampDrivers] = useState(DEFAULT_CAMP_DRIVERS);
    const [abbrev, setAbbrev] = useState(DEFAULT_ABBREV);
    const [configLoaded, setConfigLoaded] = useState(false);

    const [activeTab, setActiveTab] = useState('input');
    const [startDate, setStartDate] = useState(getStartOfCurrentWeek());
    const [schedule, setSchedule] = useState({});
    const [outputRows, setOutputRows] = useState(null);
    const [selectedCell, setSelectedCell] = useState(null);
    const [editingCellKey, setEditingCellKey] = useState(null);
    const [editingValue, setEditingValue] = useState('');
    const [pasteNotif, setPasteNotif] = useState('');
    const tableWrapRef = useRef(null);
    const fileInputRef = useRef(null);

    // 스케줄관리(구글 시트)와 연동 — 같은 csvUrl 설정을 공유해서 배차 입력을 자동으로 채워줍니다.
    const [scheduleCsvUrl, setScheduleCsvUrl] = useState('');
    const [isSyncingSchedule, setIsSyncingSchedule] = useState(false);
    const [lastSyncedAt, setLastSyncedAt] = useState(null);

    useEffect(() => {
        db.collection('settings').doc('dispatchConverter').get().then(doc => {
            if (doc.exists) {
                const d = doc.data();
                if (Array.isArray(d.drivers) && d.drivers.length) setDrivers(d.drivers);
                if (Array.isArray(d.routes) && d.routes.length) setRoutes(d.routes);
                if (d.campDrivers && Object.keys(d.campDrivers).length) setCampDrivers(d.campDrivers);
                if (d.abbrev && Object.keys(d.abbrev).length) setAbbrev(d.abbrev);
            }
            setConfigLoaded(true);
        });
        db.collection('settings').doc('schedule').get().then(doc => {
            if (doc.exists && doc.data().csvUrl) setScheduleCsvUrl(doc.data().csvUrl);
        });
    }, []);

    const syncFromSchedule = async (targetRoutes, targetStart, silent) => {
        if (!scheduleCsvUrl) return;
        setIsSyncingSchedule(true);
        try {
            const res = await fetch(scheduleCsvUrl);
            const csv = await res.text();
            const rows = csv.split('\n');
            const weekKeys = new Set(Array.from({ length: 7 }, (_, i) => fmt(addDays(targetStart, i))));
            const updates = {};
            rows.forEach(r => {
                const cols = r.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                if (cols.length < 12) return;
                if (cols[0].replace(/\s+/g, '') === '출근일') return;
                const rawDate = cols[0].replace(/\s+/g, '');
                const m = rawDate.match(/(\d+)월(\d+)일/);
                if (!m) return;
                const guessYear = targetStart.getFullYear();
                const d = new Date(guessYear, Number(m[1]) - 1, Number(m[2]));
                const dk = fmt(d);
                if (!weekKeys.has(dk)) return;
                targetRoutes.forEach((route, i) => {
                    const driverName = (cols[3 + i] || '').trim();
                    if (driverName) updates[`${dk}__${route.key}`] = driverName;
                });
            });
            setSchedule(prev => ({ ...prev, ...updates }));
            setLastSyncedAt(new Date());
            if (!silent) alert(`스케줄관리에서 ${Object.keys(updates).length}개 셀을 불러왔습니다.`);
        } catch (e) {
            console.error(e);
            if (!silent) alert('스케줄 연동 실패: ' + e.message);
        } finally {
            setIsSyncingSchedule(false);
        }
    };

    // 주간이 바뀌거나(스케줄 URL/노선 설정 로드 후) 자동으로 스케줄관리 내용을 불러옵니다.
    useEffect(() => {
        if (!configLoaded || !scheduleCsvUrl || routes.length === 0) return;
        syncFromSchedule(routes, startDate, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [configLoaded, scheduleCsvUrl, startDate]);

    const saveConfig = async (next) => {
        try {
            await db.collection('settings').doc('dispatchConverter').set({
                drivers: next.drivers ?? drivers,
                routes: next.routes ?? routes,
                campDrivers: next.campDrivers ?? campDrivers,
                abbrev: next.abbrev ?? abbrev,
                updatedAt: new Date().toISOString(),
                updatedBy: user.name
            }, { merge: true });
        } catch (e) { alert('설정 저장 실패: ' + e.message); }
    };

    const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(startDate, i)), [startDate]);

    const getDriverId = (name) => drivers.find(d => d.name === name)?.id || '';
    const resolveDriverName = (input) => {
        if (!input) return null;
        const t = input.trim();
        if (!t) return null;
        const direct = drivers.find(d => d.name === t);
        if (direct) return direct.name;
        const partial = drivers.find(d => d.name.endsWith(t) || d.name.includes(t));
        if (partial) return partial.name;
        if (abbrev[t]) return abbrev[t];
        return null;
    };
    const parseCellNames = (val) => {
        if (!val) return [];
        const t = val.trim();
        if (!t) return [];
        if (t.length === 4 && !t.includes(',') && !t.includes('/')) {
            const n1 = resolveDriverName(t.substring(0, 2));
            const n2 = resolveDriverName(t.substring(2, 4));
            if (n1 && n2) return [n1, n2];
        }
        if (t.includes(',') || t.includes('/')) return t.split(/[,/]/).map(n => n.trim()).filter(Boolean);
        return [t];
    };
    const getCellValue = (dk, rk) => schedule[`${dk}__${rk}`] || '';

    const changeWeek = (deltaDays) => setStartDate(addDays(startDate, deltaDays));

    const handleCellClick = (dk, rk) => {
        setSelectedCell({ dk, rk });
        setEditingCellKey(`${dk}__${rk}`);
        setEditingValue(getCellValue(dk, rk));
    };
    const commitEdit = () => {
        if (!editingCellKey) return;
        setSchedule(prev => ({ ...prev, [editingCellKey]: editingValue.trim() }));
        setEditingCellKey(null);
    };

    const handlePaste = (e) => {
        const text = e.clipboardData.getData('text/plain');
        if (!text || !selectedCell) return;
        const rows = text.split(/\r?\n/).filter(r => r.trim() !== '');
        if (rows.length === 1 && !rows[0].includes('\t')) return;
        e.preventDefault();
        const dateIdx = weekDates.findIndex(d => fmt(d) === selectedCell.dk);
        const routeIdx = routes.findIndex(r => r.key === selectedCell.rk);
        if (dateIdx === -1 || routeIdx === -1) return;
        let filled = 0;
        const updates = {};
        for (let ri = 0; ri < rows.length; ri++) {
            const cols = rows[ri].split('\t');
            const di = dateIdx + ri;
            if (di >= weekDates.length) break;
            const dk = fmt(weekDates[di]);
            for (let ci = 0; ci < cols.length; ci++) {
                const roi = routeIdx + ci;
                if (roi >= routes.length) break;
                updates[`${dk}__${routes[roi].key}`] = cols[ci].trim();
                filled++;
            }
        }
        setSchedule(prev => ({ ...prev, ...updates }));
        setPasteNotif(`✅ ${filled}개 셀 붙여넣기 완료!`);
        setTimeout(() => setPasteNotif(''), 2500);
    };

    const generateUpload = () => {
        const rows = [];
        for (const date of weekDates) {
            const pdd = addDays(date, 1);
            const pddStr = fmt(pdd);
            const dk = fmt(date);
            const assignments = {};
            for (const route of routes) {
                const cv = getCellValue(dk, route.key);
                if (!cv || cv === '휴무' || cv.trim() === '') continue;
                const names = parseCellNames(cv);
                if (route.splitCodes && names.length >= 2) {
                    names.forEach((name, idx) => {
                        const resolved = resolveDriverName(name);
                        if (resolved && idx < route.splitCodes.length) assignments[resolved] = { camp: route.camp, routeCode: route.splitCodes[idx] };
                    });
                    continue;
                }
                for (const name of names) {
                    const resolved = resolveDriverName(name);
                    if (resolved) assignments[resolved] = { camp: route.camp, routeCode: route.code };
                }
            }
            for (const [camp, cd] of Object.entries(campDrivers)) {
                const added = new Set();
                for (const dn of cd) {
                    added.add(dn);
                    const a = assignments[dn];
                    const w = a && a.camp === camp;
                    rows.push({
                        업무일: pddStr, 벤더명: VENDOR, 사업자등록번호: BIZ_NO, 캠프명: camp, 웨이브: WAVE,
                        이름: dn, 아이디: getDriverId(dn), 업무상태: w ? '출근' : '휴무',
                        회전: w ? DEFAULT_ROTATION : '', 업무라우트: w ? a.routeCode : ''
                    });
                }
                for (const [dn, a] of Object.entries(assignments)) {
                    if (a.camp === camp && !added.has(dn)) {
                        rows.push({
                            업무일: pddStr, 벤더명: VENDOR, 사업자등록번호: BIZ_NO, 캠프명: camp, 웨이브: WAVE,
                            이름: dn, 아이디: getDriverId(dn), 업무상태: '출근', 회전: DEFAULT_ROTATION, 업무라우트: a.routeCode
                        });
                    }
                }
            }
        }
        setOutputRows(rows);
        setActiveTab('output');
    };

    const handleDownloadXlsx = () => {
        if (!outputRows) return;
        const er = outputRows.map(r => ({ ...r, 업무일: new Date(r.업무일 + 'T00:00:00') }));
        const ws = XLSX.utils.json_to_sheet(er);
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let r = range.s.r + 1; r <= range.e.r; r++) {
            const a = XLSX.utils.encode_cell({ r, c: 0 });
            if (ws[a]) ws[a].z = 'yyyy/MM/dd';
        }
        ws['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 22 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet0');
        const dates = weekDates;
        XLSX.writeFile(wb, `schedule-v2-${BIZ_NO}_${fmt(addDays(dates[0], 1))}_${fmt(addDays(dates[6], 1))}.xlsx`);
    };

    const handleImportSchedule = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const wb = XLSX.read(evt.target.result, { type: 'array', cellDates: true });
                const sn = wb.SheetNames[0];
                const ws = wb.Sheets[sn];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });
                let headers = null, count = 0;
                const updates = {};
                for (const row of data) {
                    if (!row || row.length < 4) continue;
                    if (row[0] === '출근일' || String(row[0]).includes('출근')) { headers = row.slice(3); continue; }
                    let dv = null;
                    if (row[0] instanceof Date) dv = row[0];
                    else if (typeof row[0] === 'string') { const p = new Date(row[0]); if (!isNaN(p)) dv = p; }
                    else if (typeof row[0] === 'number') { const d = new Date((row[0] - 25569) * 86400 * 1000); if (!isNaN(d)) dv = d; }
                    if (!dv || !headers) continue;
                    const dk = fmt(dv);
                    for (let i = 0; i < headers.length; i++) {
                        const v = row[3 + i];
                        if (v && String(v).trim()) {
                            const hs = String(headers[i]).trim();
                            const m = routes.find(r => r.key === hs);
                            if (m) { updates[`${dk}__${m.key}`] = String(v).trim(); count++; }
                        }
                    }
                }
                if (count > 0) { setSchedule(prev => ({ ...prev, ...updates })); alert(`${count}개 셀 가져오기 완료!`); }
                else alert('데이터를 찾을 수 없습니다.');
            } catch (err) { alert('파일 읽기 실패: ' + err.message); }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    };

    // --- 기사/노선 관리 ---
    const [newDriverName, setNewDriverName] = useState('');
    const [newDriverId, setNewDriverId] = useState('');
    const [newDriverAbbrev, setNewDriverAbbrev] = useState('');
    const [newDriverCamps, setNewDriverCamps] = useState([]);

    const handleAddDriver = () => {
        const name = newDriverName.trim(), id = newDriverId.trim(), ab = newDriverAbbrev.trim();
        if (!name || !id) return alert('이름과 아이디를 입력하세요.');
        if (drivers.find(d => d.name === name)) return alert('이미 등록된 기사입니다.');
        const nextDrivers = [...drivers, { name, id }];
        const nextAbbrev = { ...abbrev };
        if (ab) nextAbbrev[ab] = name;
        if (name.length >= 2) { const auto = name.slice(-2); if (!nextAbbrev[auto]) nextAbbrev[auto] = name; }
        const nextCampDrivers = { ...campDrivers };
        newDriverCamps.forEach(c => {
            if (nextCampDrivers[c] && !nextCampDrivers[c].includes(name)) nextCampDrivers[c] = [...nextCampDrivers[c], name];
        });
        setDrivers(nextDrivers); setAbbrev(nextAbbrev); setCampDrivers(nextCampDrivers);
        saveConfig({ drivers: nextDrivers, abbrev: nextAbbrev, campDrivers: nextCampDrivers });
        setNewDriverName(''); setNewDriverId(''); setNewDriverAbbrev(''); setNewDriverCamps([]);
    };
    const handleRemoveDriver = (idx) => {
        const d = drivers[idx];
        if (!window.confirm(`${d.name} 기사를 삭제하시겠습니까?`)) return;
        const nextDrivers = drivers.filter((_, i) => i !== idx);
        const nextCampDrivers = {};
        for (const c of Object.keys(campDrivers)) nextCampDrivers[c] = campDrivers[c].filter(n => n !== d.name);
        const nextAbbrev = { ...abbrev };
        for (const [k, v] of Object.entries(nextAbbrev)) if (v === d.name) delete nextAbbrev[k];
        setDrivers(nextDrivers); setCampDrivers(nextCampDrivers); setAbbrev(nextAbbrev);
        saveConfig({ drivers: nextDrivers, campDrivers: nextCampDrivers, abbrev: nextAbbrev });
    };

    const [routeForm, setRouteForm] = useState({ key: '', camp: CAMP_NAMES[0], code: '', split: '', full: '' });
    const [routeEditIdx, setRouteEditIdx] = useState(null);

    const handleSubmitRoute = () => {
        const { key, camp, code, split, full } = routeForm;
        if (!key.trim() || !code.trim()) return alert('노선 키와 라우트 코드를 입력하세요.');
        const dup = routes.some((r, i) => r.key === key.trim() && i !== routeEditIdx);
        if (dup) return alert('이미 존재하는 노선 키입니다.');
        const route = { key: key.trim(), camp, code: code.trim() };
        if (split.trim()) route.splitCodes = split.split(',').map(s => s.trim()).filter(Boolean);
        if (full.trim()) route.fullCode = full.trim();
        let nextRoutes;
        if (routeEditIdx === null) { nextRoutes = [...routes, route]; }
        else { nextRoutes = routes.map((r, i) => i === routeEditIdx ? route : r); setRouteEditIdx(null); }
        setRoutes(nextRoutes);
        saveConfig({ routes: nextRoutes });
        setRouteForm({ key: '', camp: CAMP_NAMES[0], code: '', split: '', full: '' });
    };
    const handleEditRoute = (idx) => {
        const r = routes[idx];
        setRouteEditIdx(idx);
        setRouteForm({ key: r.key, camp: r.camp, code: r.code, split: r.splitCodes ? r.splitCodes.join(',') : '', full: r.fullCode || '' });
    };
    const handleCancelRouteEdit = () => { setRouteEditIdx(null); setRouteForm({ key: '', camp: CAMP_NAMES[0], code: '', split: '', full: '' }); };
    const handleDeleteRoute = (idx) => {
        const r = routes[idx];
        if (!window.confirm(`${r.key} 노선을 삭제하시겠습니까?\n(이미 입력된 스케줄 데이터는 남아있지만 표에서 사라집니다)`)) return;
        if (routeEditIdx === idx) handleCancelRouteEdit();
        const nextRoutes = routes.filter((_, i) => i !== idx);
        setRoutes(nextRoutes);
        saveConfig({ routes: nextRoutes });
    };

    if (!isAdmin) {
        return <div className="p-10 text-center font-bold text-gray-500">배차 변환기는 관리자 전용 메뉴입니다.</div>;
    }
    if (!configLoaded) {
        return <div className="p-10 text-center font-bold text-gray-400">불러오는 중...</div>;
    }

    const displayStartStr = `${weekDates[0].getMonth() + 1}/${weekDates[0].getDate()}`;
    const displayEndStr = `${weekDates[6].getMonth() + 1}/${weekDates[6].getDate()}`;

    return (
        <main className="md:ml-[260px] ml-0 px-4 md:px-10 py-6 md:py-12 flex-1 relative bg-[#F4F7FB] min-h-[100vh] w-full max-w-[100vw] md:max-w-[calc(100vw-260px)] overflow-x-hidden">
            <header className="mb-8 w-full">
                <h2 className="text-[28px] font-extrabold mb-2 text-[#1E293B] flex items-center gap-2"><Icons.Table /> 배차 변환기</h2>
                <p className="text-gray-500 text-[15px] font-medium">주간 배차표를 입력하면 쿠팡 업로드용 XLSX 파일을 자동으로 만들어줍니다. (관리자 전용)</p>
            </header>

            <div className="flex flex-wrap gap-2 mb-6 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm w-fit">
                {[{ id: 'input', label: '📋 배차 입력' }, { id: 'output', label: `📤 업로드용 (${outputRows ? outputRows.length : 0}건)` }, { id: 'manage', label: '👤 기사·노선 관리' }].map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-5 py-2.5 rounded-xl text-[14px] font-bold transition-all ${activeTab === t.id ? 'bg-[#2E68ED] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {activeTab === 'input' && (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm font-bold text-gray-600">주간 시작일 (토요일): {displayStartStr} ~ {displayEndStr}</span>
                        <button onClick={() => changeWeek(-7)} className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold">◀ 이전주</button>
                        <button onClick={() => changeWeek(7)} className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold">다음주 ▶</button>
                        <label className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold cursor-pointer">
                            📎 XLSX 파일로 불러오기
                            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportSchedule} />
                        </label>
                        <button onClick={generateUpload} className="px-6 py-2.5 rounded-xl bg-[#2E68ED] hover:bg-blue-700 text-white text-sm font-extrabold shadow-sm ml-auto">⚡ 변환 생성</button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {scheduleCsvUrl ? (
                            <>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-bold border border-green-100">
                                    🔗 스케줄관리와 연동됨{lastSyncedAt ? ` · ${lastSyncedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 기준` : ''}
                                </span>
                                <button onClick={() => syncFromSchedule(routes, startDate, false)} disabled={isSyncingSchedule} className="text-xs font-bold text-blue-600 hover:text-blue-700 disabled:opacity-50">
                                    {isSyncingSchedule ? '불러오는 중...' : '↻ 스케줄에서 다시 불러오기'}
                                </button>
                            </>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold border border-amber-100">
                                ⚠️ 스케줄관리에 구글 시트 연동 주소가 없어 자동 연동이 꺼져있어요. (스케줄관리 화면에서 먼저 설정해주세요)
                            </span>
                        )}
                    </div>

                    {pasteNotif && <div className="inline-block px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-sm font-bold">{pasteNotif}</div>}

                    <div ref={tableWrapRef} onPaste={handlePaste} className="scroll-container bg-white rounded-2xl border border-gray-100 shadow-sm">
                        <table className="w-full text-center border-collapse min-w-[1100px]">
                            <thead>
                                <tr className="bg-[#0F172A] text-white">
                                    <th className="py-3 px-2 text-[12px] font-bold">출근일</th>
                                    <th className="py-3 px-2 text-[12px] font-bold">요일</th>
                                    {routes.map(r => (
                                        <th key={r.key} className="py-3 px-2 text-[12px] font-extrabold">
                                            <div>{r.key}</div>
                                            <div className="text-[10px] font-medium opacity-60">{r.camp}</div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {weekDates.map(date => {
                                    const dk = fmt(date);
                                    const dayName = DAYS_KR[date.getDay()];
                                    const dayClass = date.getDay() === 0 ? 'text-red-500' : date.getDay() === 6 ? 'text-blue-500' : 'text-gray-600';
                                    return (
                                        <tr key={dk} className="hover:bg-gray-50/60">
                                            <td className="py-2 px-2 text-[13px] font-bold text-gray-700">{date.getMonth() + 1}/{date.getDate()}</td>
                                            <td className={`py-2 px-2 text-[13px] font-bold ${dayClass}`}>{dayName}</td>
                                            {routes.map(r => {
                                                const ck = `${dk}__${r.key}`;
                                                const isEditing = editingCellKey === ck;
                                                const v = getCellValue(dk, r.key);
                                                const isOff = v === '휴무';
                                                const invalid = v && v !== '휴무' && !parseCellNames(v).every(n => resolveDriverName(n));
                                                return (
                                                    <td key={r.key} className="py-1 px-1" onClick={() => handleCellClick(dk, r.key)}>
                                                        {isEditing ? (
                                                            <input
                                                                autoFocus
                                                                value={editingValue}
                                                                onChange={e => setEditingValue(e.target.value)}
                                                                onBlur={commitEdit}
                                                                onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingCellKey(null); }}
                                                                className="w-full px-2 py-1.5 text-[13px] font-bold text-center border border-blue-400 rounded-lg outline-none"
                                                            />
                                                        ) : (
                                                            <div className={`px-2 py-1.5 rounded-lg text-[13px] font-bold cursor-pointer min-h-[30px] flex items-center justify-center ${invalid ? 'text-red-500 bg-red-50' : v && !isOff ? 'text-blue-700 bg-blue-50' : isOff ? 'text-gray-300 bg-gray-50' : 'text-gray-300 hover:bg-gray-50'}`}>
                                                                {v || '—'}
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 p-5 text-[13px] text-gray-500 leading-relaxed">
                        <b className="text-gray-800">💡 입력 가이드</b><br />
                        ✏️ 셀 클릭 후 직접 입력 — 약칭 인식 (예: "오민" → 권오민, "성준대건" → 김성준+김대건)<br />
                        📋 스프레드시트에서 블록 복사 → 셀 클릭 → Ctrl+V 하면 여러 셀 한 번에 붙여넣기<br />
                        👥 CD 노선에 두 명: 쉼표로 구분 → 앞=C, 뒤=D 자동 분배 (예: "김성훈,김대건" → 001C/001D)<br />
                        휴무는 비워두거나 "휴무" 입력.
                    </div>
                </div>
            )}

            {activeTab === 'output' && (
                <div className="space-y-4">
                    {!outputRows ? (
                        <div className="py-24 text-center text-gray-400 font-bold bg-white rounded-2xl border border-gray-100">배차 입력 후 "⚡ 변환 생성" 버튼을 눌러주세요.</div>
                    ) : (
                        <>
                            <div className="flex flex-wrap items-center gap-4 bg-white rounded-2xl border border-gray-100 p-5 text-[13px] font-bold text-gray-500">
                                <span>📊 총 {outputRows.length}건</span>
                                <span>✅ 출근 {outputRows.filter(r => r.업무상태 === '출근').length}건</span>
                                <span>🔴 휴무 {outputRows.filter(r => r.업무상태 === '휴무').length}건</span>
                                <button onClick={handleDownloadXlsx} className="ml-auto flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-extrabold shadow-sm"><Icons.Download /> XLSX 다운로드</button>
                            </div>
                            <div className="scroll-container bg-white rounded-2xl border border-gray-100 shadow-sm">
                                <table className="w-full text-center border-collapse min-w-[800px]">
                                    <thead>
                                        <tr className="bg-[#f8fafc] text-gray-500">
                                            {['업무일', '캠프명', '이름', '아이디', '업무상태', '회전', '업무라우트'].map(h => <th key={h} className="py-3 px-3 text-[12px] font-bold">{h}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {outputRows.map((r, i) => (
                                            <tr key={i} className={r.업무상태 === '출근' ? 'bg-green-50/30' : ''}>
                                                <td className="py-2 px-3 text-[13px]">{r.업무일}</td>
                                                <td className="py-2 px-3 text-[13px]">{r.캠프명}</td>
                                                <td className="py-2 px-3 text-[13px] font-bold">{r.이름}</td>
                                                <td className="py-2 px-3 text-[12px] text-gray-400">{r.아이디}</td>
                                                <td className={`py-2 px-3 text-[13px] font-bold ${r.업무상태 === '출근' ? 'text-green-600' : 'text-gray-400'}`}>{r.업무상태}</td>
                                                <td className="py-2 px-3 text-[12px] text-gray-400">{r.회전}</td>
                                                <td className="py-2 px-3 text-[13px] font-bold text-blue-600">{r.업무라우트 || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            )}

            {activeTab === 'manage' && (
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl border border-gray-100 p-5">
                        <h3 className="font-extrabold text-gray-800 mb-4">➕ 기사 추가</h3>
                        <div className="flex flex-wrap items-end gap-3">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500">이름</label>
                                <input value={newDriverName} onChange={e => setNewDriverName(e.target.value)} placeholder="홍길동" className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold w-28 outline-none focus:border-blue-500" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500">아이디</label>
                                <input value={newDriverId} onChange={e => setNewDriverId(e.target.value)} placeholder="hong123" className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold w-28 outline-none focus:border-blue-500" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500">약칭 (2글자)</label>
                                <input value={newDriverAbbrev} onChange={e => setNewDriverAbbrev(e.target.value)} placeholder="길동" maxLength={4} className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold w-20 outline-none focus:border-blue-500" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500">소속 캠프</label>
                                <div className="flex gap-2 flex-wrap py-2">
                                    {CAMP_NAMES.map(c => (
                                        <label key={c} className="flex items-center gap-1 text-xs font-bold text-gray-600 cursor-pointer">
                                            <input type="checkbox" checked={newDriverCamps.includes(c)} onChange={e => setNewDriverCamps(e.target.checked ? [...newDriverCamps, c] : newDriverCamps.filter(x => x !== c))} />
                                            {c}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <button onClick={handleAddDriver} className="px-5 py-2.5 bg-[#2E68ED] hover:bg-blue-700 text-white rounded-lg text-sm font-bold">추가</button>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 p-5">
                        <h3 className="font-extrabold text-gray-800 mb-4">👤 등록 기사 ({drivers.length}명)</h3>
                        <div className="scroll-container">
                            <table className="w-full text-left border-collapse min-w-[500px]">
                                <thead><tr className="text-gray-400 text-xs font-bold"><th className="py-2">이름</th><th className="py-2">아이디</th><th className="py-2">소속 캠프</th><th className="py-2"></th></tr></thead>
                                <tbody className="divide-y divide-gray-100">
                                    {drivers.map((d, i) => {
                                        const camps = Object.entries(campDrivers).filter(([, dr]) => dr.includes(d.name)).map(([c]) => c).join(', ');
                                        return (
                                            <tr key={d.name}>
                                                <td className="py-2 text-sm font-bold text-gray-800">{d.name}</td>
                                                <td className="py-2 text-xs text-gray-400">{d.id}</td>
                                                <td className="py-2 text-xs text-gray-500">{camps}</td>
                                                <td className="py-2"><button onClick={() => handleRemoveDriver(i)} className="text-xs font-bold text-red-500 hover:text-red-700">삭제</button></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 p-5">
                        <h3 className="font-extrabold text-gray-800 mb-4">🛣️ 노선 추가/수정</h3>
                        <div className="flex flex-wrap items-end gap-3 mb-5">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500">노선 키</label>
                                <input value={routeForm.key} onChange={e => setRouteForm({ ...routeForm, key: e.target.value })} placeholder="503AB" className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold w-24 outline-none focus:border-blue-500" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500">소속 캠프</label>
                                <select value={routeForm.camp} onChange={e => setRouteForm({ ...routeForm, camp: e.target.value })} className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold outline-none focus:border-blue-500">
                                    {CAMP_NAMES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500">라우트 코드</label>
                                <input value={routeForm.code} onChange={e => setRouteForm({ ...routeForm, code: e.target.value })} placeholder="503A,503B" className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold w-32 outline-none focus:border-blue-500" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500">분리코드 (2인배차, 선택)</label>
                                <input value={routeForm.split} onChange={e => setRouteForm({ ...routeForm, split: e.target.value })} placeholder="503A,503B" className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold w-36 outline-none focus:border-blue-500" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-gray-500">전체코드 (휴무시, 선택)</label>
                                <input value={routeForm.full} onChange={e => setRouteForm({ ...routeForm, full: e.target.value })} placeholder="452A,452B,452C,452D" className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold w-44 outline-none focus:border-blue-500" />
                            </div>
                            <button onClick={handleSubmitRoute} className="px-5 py-2.5 bg-[#2E68ED] hover:bg-blue-700 text-white rounded-lg text-sm font-bold">{routeEditIdx === null ? '추가' : '수정 완료'}</button>
                            {routeEditIdx !== null && <button onClick={handleCancelRouteEdit} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm font-bold">취소</button>}
                        </div>
                        <div className="scroll-container">
                            <table className="w-full text-left border-collapse min-w-[600px]">
                                <thead><tr className="text-gray-400 text-xs font-bold"><th className="py-2">노선</th><th className="py-2">캠프</th><th className="py-2">라우트</th><th className="py-2">분리</th><th className="py-2">전체코드</th><th className="py-2"></th></tr></thead>
                                <tbody className="divide-y divide-gray-100">
                                    {routes.map((r, i) => (
                                        <tr key={r.key}>
                                            <td className="py-2 text-sm font-bold text-gray-800">{r.key}</td>
                                            <td className="py-2 text-xs text-gray-500">{r.camp}</td>
                                            <td className="py-2 text-xs text-gray-400">{r.code}</td>
                                            <td className="py-2 text-xs text-gray-400">{r.splitCodes ? r.splitCodes.join(' / ') : '—'}</td>
                                            <td className="py-2 text-xs text-gray-400">{r.fullCode || '—'}</td>
                                            <td className="py-2 whitespace-nowrap">
                                                <button onClick={() => handleEditRoute(i)} className="text-xs font-bold text-blue-600 hover:text-blue-800 mr-3">수정</button>
                                                <button onClick={() => handleDeleteRoute(i)} className="text-xs font-bold text-red-500 hover:text-red-700">삭제</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-4 text-xs text-gray-400 leading-relaxed">
                            📌 자동 분배 규칙 — CD 노선에 두 명(쉼표 구분) → 앞=C, 뒤=D 자동 분배 · 452D+454B 배차 시: 452ABCD → A,B,C만 / 454ABD → A,D만 · 452D+454B 휴무 시: 452ABCD → A,B,C,D 전체 / 454ABD → A,D,B 전체
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
};
