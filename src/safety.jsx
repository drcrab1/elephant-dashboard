import { notify, confirmDialog } from './ui-feedback';
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { db } from './firebase';
import { getTypeKorean } from './safety-constants';
import { SafetyRecurringChecklist } from './safety-checklist';
import { peekNavIntent, clearNavIntent } from './nav-intent';
import { Spinner } from './ui-kit';

// 양식 작성 화면과 기록 상세(PDF) 창은 무거워서(PDF 도구 포함) 실제로 열 때만 불러옵니다.
// 매일 쓰는 "오늘 점검" 화면은 이 덕분에 가볍게 열립니다.
const SafetyFormHost = lazy(() => import('./safety-forms').then(m => ({ default: m.SafetyFormHost })));
const SafetyDetailModal = lazy(() => import('./safety-detail').then(m => ({ default: m.SafetyDetailModal })));

const PAGE_ID = '안전보건관리';

// "문서·양식" 탭에 보여줄 양식 목록
const SAFETY_FORMS = [
    { path: 'accident', icon: '🚨', title: '사고 발생 보고', desc: '사고 일시·장소·내용과 현장 사진을 바로 전달합니다.', tone: 'red' },
    { path: 'edu', icon: '🎓', title: '최초교육 수료증 제출', desc: '이수증 사진이나 PDF를 올립니다.' },
    { path: 'musculo', icon: '🏋️', title: '근골격계 증상 체크', desc: '목·어깨·허리 등 불편한 곳을 체크합니다.' },
    { path: 'plan', icon: '📖', title: '안전보건관리계획서', desc: '계획서를 확인하고 동의합니다.' },
    { path: 'heavy', icon: '🚚', title: '중량물취급 작업계획서', desc: '중량물 취급 작업 전 계획서를 작성합니다.', adminOnly: true },
    { path: 'cargo', icon: '🚚', title: '화물자동차 작업계획서', desc: '화물자동차 작업 계획서를 작성합니다.', adminOnly: true },
    { path: 'musculo_checklist', icon: '🏋️', title: '근골격부담작업 체크리스트', desc: '부담작업 해당 여부를 점검합니다.', adminOnly: true },
    { path: 'hazard_survey', icon: '📋', title: '유해요인 조사표', desc: '근골격계 유해요인 조사 결과를 기록합니다.', adminOnly: true },
    { path: 'emergency_plan', icon: '🚨', title: '비상사태 대응 계획서', desc: '비상 상황별 대응 절차를 정리합니다.', adminOnly: true },
    { path: 'action_history', icon: '📋', title: '조치 이력 관리', desc: '안전보건 조치 내용을 이력으로 남깁니다.', adminOnly: true },
    { path: 'risk', icon: '⚠️', title: '위험성평가', desc: '사업장 위험성평가표를 작성합니다.', adminOnly: true },
];

const FormCard = ({ form, onOpen }) => (
    <button
        type="button"
        onClick={() => onOpen(form.path)}
        className={`text-left rounded-2xl border p-4 flex items-start gap-3.5 transition-all hover:-translate-y-0.5 hover:shadow-md ${form.tone === 'red' ? 'bg-red-50 border-red-200 hover:border-red-300' : 'bg-white border-gray-100 hover:border-blue-200'}`}
    >
        <span className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-[20px] ${form.tone === 'red' ? 'bg-white' : 'bg-[#F4F7FB]'}`} aria-hidden="true">{form.icon}</span>
        <span className="min-w-0">
            <span className={`block text-[15px] font-extrabold ${form.tone === 'red' ? 'text-red-700' : 'text-[#0F172A]'}`}>{form.title}</span>
            <span className="block text-[13px] text-gray-500 font-medium mt-0.5 leading-snug">{form.desc}</span>
        </span>
    </button>
);

const LoadingBlock = () => (
    <div className="py-20 flex flex-col items-center gap-3 text-gray-400 font-bold text-[14px]"><Spinner />불러오는 중...</div>
);

// --- Main Safety Component ---

const SafetyManagement = ({ user, records, setRecords }) => {
    // 홈 화면 등에서 "사고 보고 바로 열기"처럼 넘어온 요청이 있으면 그 상태로 시작합니다.
    const [intent] = useState(() => peekNavIntent(PAGE_ID));
    useEffect(() => { clearNavIntent(PAGE_ID); }, []);

    const [tab, setTab] = useState((intent && intent.tab) || 'check'); // check: 오늘 점검 / list: 제출 기록 / forms: 문서·양식
    const [writeFormPath, setWriteFormPath] = useState((intent && intent.form) || null);
    const [activeItem, setActiveItem] = useState(null); // Detail viewing

    const isAdmin = user && user.email === 's01025144826@gmail.com';
    const visibleRecords = isAdmin ? records : records.filter(r => r.email === user.email);

    // 전체 기록이 너무 길어지지 않도록: 종류별 필터 + 검색 + 12건씩 "더 보기"
    const [recTypeFilter, setRecTypeFilter] = useState('all');
    const [recSearch, setRecSearch] = useState('');
    const [recPerson, setRecPerson] = useState('all');
    const [recVisible, setRecVisible] = useState(12);
    useEffect(() => { setRecVisible(12); }, [recTypeFilter, recSearch, recPerson]);

    const deleteRecord = async (id) => {
        if (!isAdmin) return;
        if (!await confirmDialog('정말로 이 기록을 삭제하시겠습니까?')) return;
        try {
            await db.collection('safetyRecords').doc(id).delete();
            if (setRecords) {
                setRecords(prev => prev.filter(r => r.id !== id));
            }
            setActiveItem(null);
            notify('기록이 성공적으로 삭제되었습니다.');
        } catch (e) {
            console.error(e);
            notify('삭제 실패: ' + e.message);
        }
    };

    const submitDocument = async (docData) => {
        try {
            const recordId = `safe_${Date.now()}`;
            const newRecord = {
                ...docData,
                name: user.name,
                email: user.email,
            };

            await db.collection('safetyRecords').doc(recordId).set(newRecord);
            setWriteFormPath(null);
            notify('기록이 안전하게 저장되었습니다.');
        } catch (e) {
            console.error(e);
            notify('제출 실패: ' + e.message);
        }
    };


    const recTypeCounts = visibleRecords.reduce((acc, r) => {
        const k = getTypeKorean(r.formType);
        acc[k] = (acc[k] || 0) + 1;
        return acc;
    }, {});
    const filteredRecords = visibleRecords.filter(r => {
        if (recTypeFilter !== 'all' && getTypeKorean(r.formType) !== recTypeFilter) return false;
        if (recPerson !== 'all' && r.name !== recPerson) return false;
        const q = recSearch.trim().toLowerCase();
        if (!q) return true;
        return [r.name, getTypeKorean(r.formType), r.status, r.date].some(v => (v || '').toString().toLowerCase().includes(q));
    });

    if (writeFormPath) {
        return (
            <main className="md:ml-[260px] ml-0 px-4 md:px-10 py-6 md:py-12 flex-1 relative bg-[#F4F7FB] min-h-[100vh] w-full max-w-[100vw] md:max-w-[calc(100vw-260px)] overflow-x-hidden">
                <button onClick={() => setWriteFormPath(null)} className="mb-6 text-gray-500 hover:text-black font-bold flex items-center gap-2 py-2">&larr; 안전보건으로 돌아가기</button>
                <Suspense fallback={<LoadingBlock />}>
                    <SafetyFormHost path={writeFormPath} user={user} onSubmit={submitDocument} onCancel={() => setWriteFormPath(null)} />
                </Suspense>
            </main>
        );
    }

    const tabs = [
        { id: 'check', label: '오늘 점검' },
        { id: 'list', label: `제출 기록${visibleRecords.length ? ` ${visibleRecords.length}` : ''}` },
        { id: 'forms', label: '문서·양식' },
    ];
    const driverForms = SAFETY_FORMS.filter(f => !f.adminOnly);
    const adminForms = SAFETY_FORMS.filter(f => f.adminOnly);

    return (
        <main className="md:ml-[260px] ml-0 px-4 md:px-10 py-6 md:py-12 flex-1 relative bg-[#F4F7FB] min-h-[100vh] w-full max-w-[100vw] md:max-w-[calc(100vw-260px)] overflow-x-hidden">
            <header className="mb-5 w-full flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h2 className="text-[24px] md:text-[28px] font-extrabold text-[#0F172A] tracking-tight">안전보건</h2>
                    <p className="text-gray-500 text-[14px] md:text-[15px] font-medium mt-1">오늘 점검은 1분이면 끝납니다. 사고가 나면 빨간 버튼으로 바로 알려주세요.</p>
                </div>
                <button onClick={() => setWriteFormPath('accident')} className="shrink-0 bg-red-600 hover:bg-red-700 text-white font-extrabold px-5 py-3 rounded-xl text-[15px] shadow-sm transition-colors">🚨 사고 발생 보고</button>
            </header>

            <div className="flex gap-1 bg-white p-1 rounded-2xl border border-gray-200 mb-6 w-full sm:w-fit" role="tablist">
                {tabs.map(t => (
                    <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === t.id}
                        onClick={() => setTab(t.id)}
                        className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-[14px] font-bold whitespace-nowrap transition-colors ${tab === t.id ? 'bg-[#2E68ED] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'check' && <SafetyRecurringChecklist user={user} />}

            {tab === 'forms' && (
                <div className="space-y-8 max-w-[1100px]">
                    <section>
                        <h3 className="text-[16px] font-extrabold text-[#0F172A] mb-3">기사님이 제출하는 서류</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {driverForms.map(f => <FormCard key={f.path} form={f} onOpen={setWriteFormPath} />)}
                        </div>
                    </section>
                    {isAdmin && (
                        <section>
                            <h3 className="text-[16px] font-extrabold text-[#0F172A] mb-1">관리자가 작성하는 문서</h3>
                            <p className="text-[13px] text-gray-400 font-medium mb-3">기사님 화면에는 보이지 않습니다.</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                {adminForms.map(f => <FormCard key={f.path} form={f} onOpen={setWriteFormPath} />)}
                            </div>
                        </section>
                    )}
                </div>
            )}

            {tab === 'list' && (
                <>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-[18px] font-extrabold text-[#0F172A]">제출 문서 기록 <span className="text-[14px] font-bold text-gray-400">({filteredRecords.length}건)</span></h3>
                        <input
                            type="text"
                            value={recSearch}
                            onChange={e => setRecSearch(e.target.value)}
                            placeholder="이름, 종류, 상태 검색"
                            className="w-full sm:w-[240px] border border-gray-200 rounded-xl px-3.5 py-2 text-[13.5px] font-medium bg-white outline-none focus:border-blue-500"
                        />
                    </div>
                    <div className="mb-4 flex flex-wrap gap-2">
                        {isAdmin && (
                            <select
                                value={recPerson}
                                onChange={e => setRecPerson(e.target.value)}
                                className="w-full sm:w-[220px] border border-gray-200 rounded-xl px-3.5 py-2.5 text-[14px] font-bold bg-white outline-none focus:border-blue-500 cursor-pointer"
                            >
                                <option value="all">👤 전체 작성자</option>
                                {Array.from(new Set(visibleRecords.map(r => r.name).filter(Boolean))).sort((a, b) => a.localeCompare(b)).map(n => (
                                    <option key={n} value={n}>{n}</option>
                                ))}
                            </select>
                        )}
                        <select
                            value={recTypeFilter}
                            onChange={e => setRecTypeFilter(e.target.value)}
                            className="w-full sm:w-[300px] border border-gray-200 rounded-xl px-3.5 py-2.5 text-[14px] font-bold bg-white outline-none focus:border-blue-500 cursor-pointer"
                        >
                            <option value="all">📁 전체 문서 ({visibleRecords.length})</option>
                            {Object.keys(recTypeCounts).sort((x, y) => recTypeCounts[y] - recTypeCounts[x]).map(k => (
                                <option key={k} value={k}>{k} ({recTypeCounts[k]})</option>
                            ))}
                        </select>
                    </div>
        
                    <div className="scroll-container bg-white rounded-[20px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-gray-100">
                        <table className="min-w-[700px] w-full divide-y divide-gray-200 text-left">
                            <thead className="bg-[#f8fafc]">
                                <tr>
                                    <th className="px-6 py-4 text-[14px] font-bold text-gray-500">실시/작성일자</th>
                                    <th className="px-6 py-4 text-[14px] font-bold text-gray-500">작성자</th>
                                    <th className="px-6 py-4 text-[14px] font-bold text-gray-500">문서(양식) 종류</th>
                                    <th className="px-6 py-4 text-[14px] font-bold text-gray-500">판정 / 상태</th>
                                    <th className="px-6 py-4 text-center text-[14px] font-bold text-gray-500">결과 보기</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100/80">
                                {filteredRecords.length === 0 ? <tr><td colSpan="5" className="py-16 text-center text-gray-400 font-bold">{visibleRecords.length === 0 ? '제출된 문서가 없습니다.' : '조건에 맞는 문서가 없습니다.'}</td></tr> : filteredRecords.slice(0, recVisible).map(r => (
                                    <tr key={r.id} className={`transition-colors ${r.formType === 'musculo' && (r.status||'').includes('증상있음') ? 'bg-red-50 hover:bg-red-100/80 border-l-4 border-red-500' : 'hover:bg-blue-50/20'}`}>
                                        <td className="px-6 py-4 text-[15px] font-bold text-gray-900">
                                            {r.formType === 'risk_assessment' ? (r.dateRange || r.date) : 
                                             r.formType === 'musculo_checklist' ? (r.surveyDate || r.date) : 
                                             r.formType === 'hazard_survey' ? (r.surveyDate || r.date) : 
                                             r.formType === 'musculo' ? r.date :
                                             r.formType === 'emergency_plan' ? r.date : 
                                             r.formType === 'action_history' ? r.date : 
                                             r.date || '-'}
                                        </td>
                                        <td className="px-6 py-4"><span className="bg-gray-100 px-3 py-1 rounded-lg text-sm font-bold text-gray-700">{r.name}</span></td>
                                        <td className="px-6 py-4 font-bold text-[14px] text-gray-600">{getTypeKorean(r.formType)}</td>
                                        <td className="px-6 py-4"><span className={`text-[13px] font-extrabold px-3 py-1.5 rounded-md border ${(r.status||'').includes('이슈') || (r.status||'').includes('불량') || (r.status||'').includes('필요') ? 'bg-red-50 border-red-200 text-red-600' : 'bg-green-50 border-green-200 text-green-700'}`}>{r.status || '미판정'}</span></td>
                                        <td className="px-6 py-4 text-center">
                                            {isAdmin ? (
                                                <div className="flex justify-center gap-1.5">
                                                    <button onClick={() => setActiveItem(r)} className="bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-600 hover:border-blue-400 hover:text-blue-600 shadow-sm transition-colors">기록 확인</button>
                                                    <button onClick={() => deleteRecord(r.id)} className="bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 rounded-lg px-2.5 py-1.5 text-xs font-bold shadow-sm transition-colors">🗑️ 삭제</button>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 text-xs font-bold">제출 완료</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {filteredRecords.length > recVisible && (
                        <button onClick={() => setRecVisible(v => v + 12)} className="mt-3 w-full py-3 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-[13.5px] font-bold text-blue-600 shadow-sm">
                            더 보기 ({filteredRecords.length - recVisible}건 남음)
                        </button>
                    )}
                </>
            )}

            {activeItem && (
                <Suspense fallback={<div className="fixed inset-0 z-50 bg-[#0F172A]/40 flex items-center justify-center"><div className="bg-white rounded-2xl px-8 py-6"><LoadingBlock /></div></div>}>
                    <SafetyDetailModal activeItem={activeItem} setActiveItem={setActiveItem} isAdmin={isAdmin} deleteRecord={deleteRecord} />
                </Suspense>
            )}
        </main>
    );
};

export { SafetyManagement };
