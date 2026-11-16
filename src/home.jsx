import React, { useState, useEffect, useMemo } from 'react';
import { db, ADMIN_EMAIL } from './firebase';
import { Icons } from './icons';
import { Spinner } from './ui-kit';
import { setNavIntent } from './nav-intent';
import { loadSchedule, csvDateLabel, cellHasDriver } from './schedule-data';
import { SAFETY_RECURRING_TASKS, getPeriodKey, getDaysLeftInPeriod, URGENT_THRESHOLD, PERIOD_LABEL } from './safety-constants';

// 홈 화면: 기사님에게는 "오늘 할 일", 대표님에게는 "처리할 일"을 먼저 보여줍니다.

const REQUIRED_DOCS = ['화물운송자격증', '운송사업허가증', '자동차등록증', '최초안전교육수료증'];
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

const localDateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysUntil = (dateStr) => {
    const target = new Date(`${dateStr}T00:00:00`);
    if (isNaN(target.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((target - today) / 86400000);
};

const CARD = 'bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(15,23,42,0.04)]';

const TONE = {
    red: { box: 'bg-red-50', badge: 'bg-red-600 text-white' },
    amber: { box: 'bg-amber-50', badge: 'bg-amber-500 text-white' },
    blue: { box: 'bg-blue-50', badge: 'bg-brand text-white' },
    green: { box: 'bg-emerald-50', badge: 'bg-emerald-100 text-emerald-700' },
    gray: { box: 'bg-gray-100', badge: 'bg-gray-100 text-gray-600' },
};

const TodoRow = ({ icon, tone = 'blue', title, sub, badge, onClick }) => {
    const t = TONE[tone] || TONE.blue;
    return (
        <button type="button" onClick={onClick} className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors">
            <span className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-[20px] ${t.box}`} aria-hidden="true">{icon}</span>
            <span className="min-w-0 flex-1">
                <span className="block text-[15.5px] font-extrabold text-ink leading-snug">{title}</span>
                {sub && <span className="block text-[13px] text-gray-500 font-medium mt-0.5 leading-snug">{sub}</span>}
            </span>
            {badge && <span className={`shrink-0 px-2.5 py-1 rounded-lg text-[12.5px] font-extrabold whitespace-nowrap ${t.badge}`}>{badge}</span>}
            <span className="shrink-0 text-gray-300"><Icons.ChevronRight /></span>
        </button>
    );
};

const SectionTitle = ({ children, right }) => (
    <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-[17px] font-extrabold text-ink tracking-tight">{children}</h3>
        {right}
    </div>
);

// 오늘·이번 주·이번 달·올해의 안전점검 체크 기록(모든 사람)을 실시간으로 받습니다. (전체 기록이 아니라 지금 기간 것만)
const usePeriodLogs = () => {
    const [logs, setLogs] = useState(null);
    const keysText = Array.from(new Set(['daily', 'weekly', 'monthly', 'yearly'].map((f) => getPeriodKey(f)))).join('|');
    useEffect(() => {
        const unsub = db.collection('safetyChecklistLogs').where('periodKey', 'in', keysText.split('|'))
            .onSnapshot((snap) => setLogs(snap.docs.map((d) => d.data())), () => setLogs([]));
        return () => unsub();
    }, [keysText]);
    return logs;
};

const useSchedule = () => {
    const [state, setState] = useState({ status: 'loading', linked: false, routeColumns: [], rows: [] });
    useEffect(() => {
        let alive = true;
        loadSchedule()
            .then((data) => { if (alive) setState({ status: 'ready', ...data }); })
            .catch(() => { if (alive) setState({ status: 'error', linked: false, routeColumns: [], rows: [] }); });
        return () => { alive = false; };
    }, []);
    return state;
};

const useLatestNotices = () => {
    const [notices, setNotices] = useState([]);
    useEffect(() => {
        const unsub = db.collection('noticeBoard').orderBy('sentAt', 'desc').limit(3)
            .onSnapshot((snap) => setNotices(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setNotices([]));
        return () => unsub();
    }, []);
    return notices;
};

// 아직 이수하지 않은 개인정보 교육 수 (기사님)
const usePendingTrainings = (email, enabled) => {
    const [trainings, setTrainings] = useState([]);
    const [logs, setLogs] = useState([]);
    useEffect(() => {
        if (!enabled) return undefined;
        const u1 = db.collection('privacyTrainings').where('active', '==', true).onSnapshot((s) => setTrainings(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {});
        const u2 = db.collection('privacyTrainingLogs').where('email', '==', email).onSnapshot((s) => setLogs(s.docs.map((d) => d.data())), () => {});
        return () => { u1(); u2(); };
    }, [email, enabled]);
    return enabled ? trainings.filter((t) => !logs.some((l) => l.trainingId === t.id)).length : 0;
};

// 최근 3일 안에 올라온 공지인지
const isNew = (iso) => { const t = new Date(iso).getTime(); return !isNaN(t) && Date.now() - t < 3 * 86400000; };
const fmt = (iso) => { const d = new Date(iso); return isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}/${d.getDate()}`; };

const NoticeCard = ({ notices, setActivePage }) => {
    return (
        <section>
            <SectionTitle right={<button type="button" onClick={() => setActivePage('공지사항')} className="text-[13px] font-bold text-brand py-1 px-1">전체 보기</button>}>공지사항</SectionTitle>
            <div className={`${CARD} divide-y divide-gray-100 overflow-hidden`}>
                {notices.length === 0 ? (
                    <p className="px-4 py-6 text-center text-[13.5px] text-gray-400 font-bold">새 공지가 없습니다.</p>
                ) : notices.map((n) => (
                    <button key={n.id} type="button" onClick={() => setActivePage('공지사항')} className="w-full text-left px-4 py-3.5 hover:bg-gray-50 transition-colors">
                        <span className="flex items-center gap-2">
                            {isNew(n.sentAt) && <span className="shrink-0 px-1.5 py-0.5 rounded bg-red-500 text-white text-[12px] font-extrabold">NEW</span>}
                            <span className="min-w-0 flex-1 truncate text-[14.5px] font-extrabold text-ink">{n.title}</span>
                            <span className="shrink-0 text-[12px] font-bold text-gray-400">{fmt(n.sentAt)}</span>
                        </span>
                        {n.body && <span className="block mt-1 text-[13px] text-gray-500 font-medium line-clamp-2">{n.body}</span>}
                    </button>
                ))}
            </div>
        </section>
    );
};

const Shortcut = ({ icon, label, onClick, tone }) => (
    <button type="button" onClick={onClick} className={`flex flex-col items-center justify-center gap-2 rounded-2xl border py-4 px-2 transition-all hover:-translate-y-0.5 hover:shadow-md ${tone === 'red' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-gray-100 text-gray-700'}`}>
        <span className="text-[24px] leading-none" aria-hidden="true">{icon}</span>
        <span className="text-[13px] font-extrabold text-center leading-tight">{label}</span>
    </button>
);

const Greeting = ({ user, summary }) => {
    const now = new Date();
    return (
        <header className="mb-6">
            <p className="text-[13.5px] font-bold text-gray-400">{now.getMonth() + 1}월 {now.getDate()}일 {DAY_NAMES[now.getDay()]}요일</p>
            <h2 className="text-[24px] md:text-[28px] font-extrabold text-ink tracking-tight mt-0.5">안녕하세요, {user.name}님</h2>
            {summary && <p className="text-[14.5px] text-gray-500 font-medium mt-1">{summary}</p>}
        </header>
    );
};

// ───────────────────────── 기사님 홈 ─────────────────────────
const DriverHome = ({ user, setActivePage, contracts, vehicleDocs, workRecords }) => {
    const logs = usePeriodLogs();
    const schedule = useSchedule();
    const notices = useLatestNotices();
    const pendingTrainings = usePendingTrainings(user.email, true);

    const now = new Date();
    const todayLabel = csvDateLabel(now);
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
    const routesOn = (label) => Array.from(new Set(schedule.rows.filter((r) => r.csvDate === label && cellHasDriver(r.driver, user.name)).map((r) => r.route)));
    const todayRoutes = routesOn(todayLabel);
    const tomorrowRoutes = routesOn(csvDateLabel(tomorrow));

    const myTasks = SAFETY_RECURRING_TASKS.filter((t) => t.perUser);
    const isDone = (task) => !!logs && logs.some((l) => l.taskId === task.id && l.email === user.email && l.periodKey === getPeriodKey(task.freq));
    const dailyTasks = myTasks.filter((t) => t.freq === 'daily');
    const dailyLeft = dailyTasks.filter((t) => !isDone(t));
    const otherLeft = myTasks.filter((t) => t.freq !== 'daily' && !isDone(t));

    const pendingContracts = contracts.filter((c) => c.targetEmail === user.email && c.status === '서명대기');
    const myDocs = vehicleDocs.filter((d) => d.email === user.email);
    const missingDocs = REQUIRED_DOCS.filter((t) => !myDocs.some((d) => d.docType === t));
    const expiringDocs = myDocs.filter((d) => { if (!d.expiryDate) return false; const left = daysUntil(d.expiryDate); return left !== null && left <= 30; });
    const workedToday = workRecords.some((r) => r.email === user.email && r.date === localDateKey(now));

    const openSafety = () => setActivePage('안전보건관리');
    const todos = [];
    if (logs && dailyLeft.length > 0) {
        todos.push({ key: 'daily', icon: '🛡️', tone: 'red', title: '오늘 안전점검', sub: `남은 점검: ${dailyLeft.map((t) => t.title).join(', ')}`, badge: `${dailyTasks.length - dailyLeft.length}/${dailyTasks.length} 완료`, onClick: openSafety });
    }
    if (pendingContracts.length > 0) {
        todos.push({ key: 'sign', icon: '✍️', tone: 'red', title: '서명할 서류', sub: pendingContracts.map((c) => c.title).filter(Boolean).slice(0, 2).join(', '), badge: `${pendingContracts.length}건`, onClick: () => setActivePage('계약관리') });
    }
    if (missingDocs.length > 0) {
        todos.push({ key: 'docs', icon: '📂', tone: 'amber', title: '아직 안 낸 서류', sub: missingDocs.join(', '), badge: `${missingDocs.length}건`, onClick: () => setActivePage('서류관리') });
    }
    if (expiringDocs.length > 0) {
        todos.push({ key: 'expiry', icon: '⏰', tone: 'amber', title: '만료 임박 서류', sub: expiringDocs.map((d) => { const left = daysUntil(d.expiryDate); return `${d.docType} (${left < 0 ? '만료됨' : `${left}일 남음`})`; }).join(', '), badge: `${expiringDocs.length}건`, onClick: () => setActivePage('서류관리') });
    }
    if (pendingTrainings > 0) {
        todos.push({ key: 'training', icon: '🔒', tone: 'amber', title: '개인정보 교육 이수', sub: '교육 자료를 읽고 "이수 확인"을 눌러주세요.', badge: `${pendingTrainings}건`, onClick: () => setActivePage('개인정보 서약·교육') });
    }
    if (logs) {
        // 주·월·연 단위 점검: 마감이 가까운 것은 따로, 여유 있는 것은 한 줄로 묶어서 보여줍니다.
        const urgentTasks = otherLeft.filter((t) => getDaysLeftInPeriod(t.freq) <= URGENT_THRESHOLD[t.freq]);
        const laterTasks = otherLeft.filter((t) => !urgentTasks.includes(t));
        urgentTasks.forEach((t) => {
            const left = getDaysLeftInPeriod(t.freq);
            todos.push({ key: t.id, icon: '📋', tone: 'amber', title: t.title, sub: `${PERIOD_LABEL[t.freq]} 안에 한 번 체크하면 됩니다.`, badge: left === 0 ? '오늘까지' : `${left}일 남음`, onClick: openSafety });
        });
        if (laterTasks.length > 0) {
            todos.push({ key: 'later', icon: '📋', tone: 'blue', title: '기간 안에 하면 되는 점검', sub: laterTasks.map((t) => `${t.title}(${PERIOD_LABEL[t.freq]})`).join(', '), badge: `${laterTasks.length}개`, onClick: openSafety });
        }
    }
    if (todayRoutes.length > 0 && !workedToday) {
        todos.push({ key: 'work', icon: '📦', tone: 'gray', title: '배송건수 입력', sub: '업무가 끝나면 오늘 배송 수량을 입력해 주세요.', onClick: () => setActivePage('업무내역입력') });
    }

    const mustCount = todos.filter((t) => t.tone === 'red' || t.tone === 'amber').length;
    const summary = !logs ? '오늘 할 일을 확인하고 있습니다...' : mustCount > 0 ? `지금 챙겨야 할 일이 ${mustCount}건 있습니다.` : '오늘 꼭 해야 할 일은 모두 마쳤습니다. 안전 운행하세요!';

    return (
        <>
            <Greeting user={user} summary={summary} />

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3 space-y-6">
                    <section>
                        <SectionTitle>오늘 배차</SectionTitle>
                        <button type="button" onClick={() => setActivePage('스케줄관리')} className={`${CARD} w-full text-left p-5 flex items-center gap-4 hover:border-blue-200 transition-colors`}>
                            <span className="shrink-0 w-12 h-12 rounded-2xl bg-brand-soft text-brand flex items-center justify-center"><Icons.Truck /></span>
                            <span className="min-w-0 flex-1">
                                {schedule.status === 'loading' ? (
                                    <span className="flex items-center gap-2 text-[14px] font-bold text-gray-400"><Spinner className="!w-4 !h-4" /> 배차표를 불러오는 중...</span>
                                ) : schedule.status === 'error' || !schedule.linked ? (
                                    <span className="block text-[14.5px] font-bold text-gray-500">배차표를 불러오지 못했습니다. 스케줄 화면에서 확인해 주세요.</span>
                                ) : todayRoutes.length > 0 ? (
                                    <>
                                        <span className="block text-[13px] font-bold text-gray-400">오늘 내 노선</span>
                                        <span className="flex flex-wrap gap-1.5 mt-1">
                                            {todayRoutes.map((r) => <span key={r} className="px-3 py-1 rounded-lg bg-brand text-white text-[15px] font-extrabold">{r}</span>)}
                                        </span>
                                    </>
                                ) : (
                                    <span className="block text-[15.5px] font-extrabold text-ink">오늘은 배차가 없습니다</span>
                                )}
                                {schedule.status === 'ready' && schedule.linked && (
                                    <span className="block text-[13px] text-gray-500 font-medium mt-1.5">내일: {tomorrowRoutes.length > 0 ? tomorrowRoutes.join(', ') : '배차 없음'}</span>
                                )}
                            </span>
                            <span className="shrink-0 text-gray-300"><Icons.ChevronRight /></span>
                        </button>
                    </section>

                    <section>
                        <SectionTitle>오늘 할 일</SectionTitle>
                        <div className={`${CARD} divide-y divide-gray-100 overflow-hidden`}>
                            {!logs ? (
                                <div className="py-10 flex justify-center"><Spinner /></div>
                            ) : todos.length === 0 ? (
                                <div className="px-5 py-9 text-center">
                                    <div className="text-[34px] mb-1" aria-hidden="true">👏</div>
                                    <p className="text-[16px] font-extrabold text-ink">오늘 할 일을 모두 마쳤습니다</p>
                                    <p className="text-[13.5px] text-gray-500 font-medium mt-1">안전 운행하세요.</p>
                                </div>
                            ) : todos.map(({ key, ...row }) => <TodoRow key={key} {...row} />)}
                        </div>
                        {logs && dailyLeft.length === 0 && (
                            <p className="mt-2 px-1 text-[13px] font-bold text-emerald-600">✓ 오늘 안전점검 {dailyTasks.length}개 완료</p>
                        )}
                    </section>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    <section>
                        <SectionTitle>바로가기</SectionTitle>
                        <div className="grid grid-cols-4 lg:grid-cols-2 gap-2.5">
                            <Shortcut icon="🚨" label="사고 보고" tone="red" onClick={() => { setNavIntent('안전보건관리', { form: 'accident' }); setActivePage('안전보건관리'); }} />
                            <Shortcut icon="📞" label="비상연락망" onClick={() => setActivePage('비상연락망')} />
                            <Shortcut icon="🗺️" label="노선 꿀팁" onClick={() => setActivePage('노선관리')} />
                            <Shortcut icon="📦" label="배송건수" onClick={() => setActivePage('업무내역입력')} />
                        </div>
                    </section>
                    <NoticeCard notices={notices} setActivePage={setActivePage} />
                </div>
            </div>
        </>
    );
};

// ───────────────────────── 대표님 홈 ─────────────────────────
const AdminHome = ({ user, setActivePage, contracts, vehicleDocs, contacts, safetyRecords, workRecords }) => {
    const logs = usePeriodLogs();
    const schedule = useSchedule();
    const notices = useLatestNotices();
    const now = new Date();
    const todayKey = getPeriodKey('daily');

    const dailyTasks = SAFETY_RECURRING_TASKS.filter((t) => t.perUser && t.freq === 'daily');

    // 오늘 배차된 사람과 점검 현황 (배차표 이름 → 비상연락망 이름으로 사람을 찾습니다)
    const board = useMemo(() => {
        const todayRows = schedule.rows.filter((r) => r.csvDate === csvDateLabel(new Date()));
        const people = contacts.filter((c) => c.email && c.name);
        const findPerson = (token) => people.find((c) => c.name === token) || people.find((c) => token.includes(c.name) || c.name.includes(token));
        const doneCountOf = (email) => (logs ? dailyTasks.filter((t) => logs.some((l) => l.taskId === t.id && l.email === email && l.periodKey === todayKey)).length : 0);
        return schedule.routeColumns.map((route) => {
            const cells = todayRows.filter((r) => r.route === route);
            const drivers = cells.flatMap((r) => r.driver.split(/[,/+&]/).map((s) => s.trim()).filter(Boolean)).map((token) => {
                const person = findPerson(token);
                return { label: token, email: person ? person.email : null, done: person ? doneCountOf(person.email) : null };
            });
            return { route, drivers };
        }).filter((row) => row.drivers.length > 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [schedule, contacts, logs, todayKey]);

    const scheduledDrivers = useMemo(() => {
        const seen = new Map();
        board.forEach((row) => row.drivers.forEach((d) => { if (!seen.has(d.email || d.label)) seen.set(d.email || d.label, d); }));
        return Array.from(seen.values());
    }, [board]);
    const notChecked = scheduledDrivers.filter((d) => d.done !== null && d.done < dailyTasks.length);
    const checkedCount = scheduledDrivers.filter((d) => d.done !== null && d.done >= dailyTasks.length).length;

    const kpi = useMemo(() => {
        const drivers = contacts.filter((c) => c.role === '배송기사' || c.role === '조장');
        const missingDocPeople = drivers.filter((p) => REQUIRED_DOCS.some((t) => !vehicleDocs.some((d) => d.email === p.email && d.docType === t)));
        const pendingSign = contracts.filter((c) => c.status === '서명대기');
        const expiringContracts = contracts.filter((c) => {
            if (c.templateType !== 'standard_consignment' || !c.variables?.targetDate) return false;
            const end = c.variables.targetEndDate ? new Date(c.variables.targetEndDate) : (() => { const e = new Date(c.variables.targetDate); e.setFullYear(e.getFullYear() + 1); return e; })();
            if (isNaN(end.getTime())) return false;
            const left = Math.ceil((end - new Date()) / 86400000);
            return left >= 0 && left <= 90;
        });
        const expiringDocs = vehicleDocs.filter((d) => { if (!d.expiryDate) return false; const left = daysUntil(d.expiryDate); return left !== null && left <= 30; });
        const today = new Date();
        const monthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const accidents = safetyRecords.filter((r) => r.formType === 'accident_report' && (r.date || '').startsWith(monthPrefix));
        // 이번 정산 기간(전월 26일 ~ 당월 25일) 배송건수
        const start = today.getDate() >= 26 ? new Date(today.getFullYear(), today.getMonth(), 26) : new Date(today.getFullYear(), today.getMonth() - 1, 26);
        const end = new Date(start.getFullYear(), start.getMonth() + 1, 25);
        const sKey = localDateKey(start);
        const eKey = localDateKey(end);
        const periodQty = workRecords.filter((r) => r.date >= sKey && r.date <= eKey).reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
        return { missingDocPeople, pendingSign, expiringContracts, expiringDocs, accidents, periodQty, periodLabel: `${start.getMonth() + 1}/${start.getDate()}~${end.getMonth() + 1}/${end.getDate()}` };
    }, [contacts, vehicleDocs, contracts, safetyRecords, workRecords]);

    const names = (list, pick) => { const arr = list.map(pick).filter(Boolean); return arr.slice(0, 4).join(', ') + (arr.length > 4 ? ` 외 ${arr.length - 4}명` : ''); };
    const todos = [];
    if (logs && schedule.status === 'ready' && notChecked.length > 0) {
        todos.push({ key: 'check', icon: '🛡️', tone: 'red', title: '오늘 점검 안 한 기사', sub: names(notChecked, (d) => d.label), badge: `${notChecked.length}명`, onClick: () => setActivePage('안전보건관리') });
    }
    if (kpi.accidents.length > 0) {
        todos.push({ key: 'accident', icon: '🚨', tone: 'red', title: '이번 달 사고 보고', sub: names(kpi.accidents, (r) => r.name), badge: `${kpi.accidents.length}건`, onClick: () => { setNavIntent('안전보건관리', { tab: 'list' }); setActivePage('안전보건관리'); } });
    }
    if (kpi.pendingSign.length > 0) {
        todos.push({ key: 'sign', icon: '✍️', tone: 'amber', title: '서명 대기 중인 서류', sub: names(kpi.pendingSign, (c) => c.name), badge: `${kpi.pendingSign.length}건`, onClick: () => setActivePage('계약관리') });
    }
    if (kpi.missingDocPeople.length > 0) {
        todos.push({ key: 'docs', icon: '📂', tone: 'amber', title: '필수 서류 안 낸 기사', sub: names(kpi.missingDocPeople, (p) => p.name), badge: `${kpi.missingDocPeople.length}명`, onClick: () => setActivePage('서류관리') });
    }
    if (kpi.expiringDocs.length > 0) {
        todos.push({ key: 'docexp', icon: '⏰', tone: 'amber', title: '만료 임박 서류 (30일)', sub: kpi.expiringDocs.slice(0, 3).map((d) => d.docType).join(' · '), badge: `${kpi.expiringDocs.length}건`, onClick: () => setActivePage('서류관리') });
    }
    if (kpi.expiringContracts.length > 0) {
        todos.push({ key: 'conexp', icon: '📅', tone: 'amber', title: '만료 임박 계약 (90일)', sub: names(kpi.expiringContracts, (c) => c.name), badge: `${kpi.expiringContracts.length}건`, onClick: () => setActivePage('계약관리') });
    }

    const stat = (label, value, unit, onClick) => (
        <button type="button" onClick={onClick} className={`${CARD} text-left p-4 md:p-5 hover:border-blue-200 transition-colors`}>
            <span className="block text-[13px] font-bold text-gray-400">{label}</span>
            <span className="block text-[24px] md:text-[26px] font-extrabold text-ink tracking-tight mt-0.5">{value}<span className="text-[14px] font-bold text-gray-400 ml-1">{unit}</span></span>
        </button>
    );
    const scheduleReady = schedule.status === 'ready' && schedule.linked;

    return (
        <>
            <Greeting user={user} summary={todos.length > 0 ? `처리할 일이 ${todos.length}가지 있습니다.` : '지금 처리할 일이 없습니다.'} />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
                {stat('오늘 배차', scheduleReady ? scheduledDrivers.length : '-', '명', () => setActivePage('스케줄관리'))}
                {stat('오늘 점검 완료', scheduleReady && logs ? `${checkedCount}/${scheduledDrivers.length}` : '-', '명', () => setActivePage('안전보건관리'))}
                {stat(`이번 정산 배송 (${kpi.periodLabel})`, kpi.periodQty.toLocaleString(), '건', () => setActivePage('업무내역입력'))}
                {stat('등록 인원', contacts.filter((c) => c.type !== 'camp' && c.email).length, '명', () => setActivePage('회원관리'))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3 space-y-6">
                    <section>
                        <SectionTitle>처리할 일</SectionTitle>
                        <div className={`${CARD} divide-y divide-gray-100 overflow-hidden`}>
                            {todos.length === 0 ? (
                                <div className="px-5 py-9 text-center">
                                    <div className="text-[34px] mb-1" aria-hidden="true">👍</div>
                                    <p className="text-[16px] font-extrabold text-ink">지금 처리할 일이 없습니다</p>
                                    <p className="text-[13.5px] text-gray-500 font-medium mt-1">서류·계약·점검 모두 이상 없습니다.</p>
                                </div>
                            ) : todos.map(({ key, ...row }) => <TodoRow key={key} {...row} />)}
                        </div>
                    </section>

                    <section>
                        <SectionTitle right={<span className="text-[12.5px] font-bold text-gray-400">{now.getMonth() + 1}/{now.getDate()} ({DAY_NAMES[now.getDay()]}) · 점검 {dailyTasks.length}개 기준</span>}>오늘 배차 현황</SectionTitle>
                        <div className={`${CARD} overflow-hidden`}>
                            {schedule.status === 'loading' ? (
                                <div className="py-10 flex justify-center"><Spinner /></div>
                            ) : !scheduleReady ? (
                                <p className="px-4 py-8 text-center text-[13.5px] text-gray-400 font-bold">배차표를 불러오지 못했습니다. 스케줄 화면에서 구글 시트 연동을 확인해 주세요.</p>
                            ) : board.length === 0 ? (
                                <p className="px-4 py-8 text-center text-[13.5px] text-gray-400 font-bold">오늘 배차된 기사가 없습니다.</p>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {board.map((row) => (
                                        <div key={row.route} className="flex items-center gap-3 px-4 py-3">
                                            <span className="shrink-0 w-[92px] text-[13.5px] font-extrabold text-ink">{row.route}</span>
                                            <span className="flex flex-wrap gap-1.5 min-w-0">
                                                {row.drivers.map((d, i) => {
                                                    const full = d.done !== null && d.done >= dailyTasks.length;
                                                    return (
                                                        <span key={i} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[13px] font-bold ${full ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : d.done === null ? 'bg-gray-50 border-gray-200 text-gray-500' : 'bg-red-50 border-red-200 text-red-600'}`}>
                                                            {d.label}
                                                            <span className="text-[12px] font-extrabold opacity-80">{d.done === null ? '미가입' : full ? '✓ 점검' : `${d.done}/${dailyTasks.length}`}</span>
                                                        </span>
                                                    );
                                                })}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    <section>
                        <SectionTitle>바로가기</SectionTitle>
                        <div className="grid grid-cols-4 lg:grid-cols-2 gap-2.5">
                            <Shortcut icon="✍️" label="계약 발송" onClick={() => setActivePage('계약관리')} />
                            <Shortcut icon="🔔" label="알림 발송" onClick={() => setActivePage('알림관리')} />
                            <Shortcut icon="📊" label="배차변환기" onClick={() => setActivePage('배차변환기')} />
                            <Shortcut icon="👥" label="회원관리" onClick={() => setActivePage('회원관리')} />
                        </div>
                    </section>
                    <NoticeCard notices={notices} setActivePage={setActivePage} />
                </div>
            </div>
        </>
    );
};

export const Home = ({ user, setActivePage, contracts = [], vehicleDocs = [], contacts = [], safetyRecords = [], workRecords = [] }) => {
    const isAdmin = user && user.email === ADMIN_EMAIL;
    return (
        <main className="md:ml-[260px] ml-0 px-4 md:px-10 py-6 md:py-10 flex-1 relative animate-fade-in w-full max-w-[100vw] md:max-w-[calc(100vw-260px)] overflow-x-hidden">
            <div className="max-w-[1200px]">
                {isAdmin
                    ? <AdminHome user={user} setActivePage={setActivePage} contracts={contracts} vehicleDocs={vehicleDocs} contacts={contacts} safetyRecords={safetyRecords} workRecords={workRecords} />
                    : <DriverHome user={user} setActivePage={setActivePage} contracts={contracts} vehicleDocs={vehicleDocs} workRecords={workRecords} />}
            </div>
        </main>
    );
};
