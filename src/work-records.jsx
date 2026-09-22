import React, { useState, useMemo, useRef } from 'react';
import { db, ADMIN_EMAIL } from './firebase';
import { Icons } from './ui-components';
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';

// --- Work Record Management (업무내역입력/정산) ---
const WorkRecordManagement = ({ user, records, setRecords }) => {
    // 기본적으로 스크린샷에 맞춰 2026년 4월을 기본값으로 세팅 (테스트용)
    const [baseMonth, setBaseMonth] = useState(new Date());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], route: '', quantity: '' });

    const isAdmin = user && user.email === ADMIN_EMAIL;

    // 관리자용 직원 선택기 (모든 기록에서 유니크 이메일 추출, 관리자 본인 이메일은 제외 후 별도 옵션으로 고정 노출)
    const uniqueUsers = useMemo(() => {
        const map = new Map();
        records.forEach(r => { if (r.email !== ADMIN_EMAIL) map.set(r.email, r.name); });
        return Array.from(map.entries()).map(([email, name]) => ({ email, name }));
    }, [records]);

    const [adminSelectedEmail, setAdminSelectedEmail] = useState('all');

    // 정산 기간 산출 [전월 26일 ~ 당월 25일]
    const targetYear = baseMonth.getFullYear();
    const targetMonthStr = baseMonth.getMonth() + 1;

    const formatYMD = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const startDate = new Date(targetYear, baseMonth.getMonth() - 1, 26);
    const endDate = new Date(targetYear, baseMonth.getMonth(), 25);
    const startStr = formatYMD(startDate);
    const endStr = formatYMD(endDate);
    const displayStartStr = `${startDate.getFullYear()}.${startDate.getMonth() + 1}.${startDate.getDate()}`;
    const displayEndStr = `${endDate.getFullYear()}.${endDate.getMonth() + 1}.${endDate.getDate()}`;

    // 필터링
    const targetEmailFilter = isAdmin ? adminSelectedEmail : user.email;

    const currentPeriodRecords = records.filter(r => {
        // 날짜 필터
        if (r.date < startStr || r.date > endStr) return false;
        // 권한 필터
        if (targetEmailFilter !== 'all' && r.email !== targetEmailFilter) return false;
        return true;
    }).sort((a, b) => b.date.localeCompare(a.date)); // 최신순 정렬

    // 합계 계산
    const totalQuantity = currentPeriodRecords.reduce((sum, r) => sum + Number(r.quantity), 0);
    const uniqueWorkDays = new Set(currentPeriodRecords.map(r => r.date)).size;
    const averageDaily = uniqueWorkDays > 0 ? Math.round(totalQuantity / uniqueWorkDays) : 0;

    // 정산서 PDF용 수신자 이름 산출
    const settlementRecipientName = targetEmailFilter === 'all'
        ? '전체 직원'
        : targetEmailFilter === user.email
            ? user.name
            : (uniqueUsers.find(u => u.email === targetEmailFilter)?.name || currentPeriodRecords.find(r => r.email === targetEmailFilter)?.name || targetEmailFilter);

    const settlementPrintRef = useRef(null);
    const [isGeneratingSettlement, setIsGeneratingSettlement] = useState(false);

    const handleDownloadSettlement = async () => {
        if (currentPeriodRecords.length === 0) return alert('해당 정산 기간에 내역이 없습니다.');
        setIsGeneratingSettlement(true);
        try {
            await new Promise(res => setTimeout(res, 100)); // DOM 렌더 대기
            const element = settlementPrintRef.current;
            const dataUrl = await toJpeg(element, { quality: 0.98, backgroundColor: '#ffffff' });
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = 210;
            const imgHeight = (element.offsetHeight * pdfWidth) / element.offsetWidth;
            let heightLeft = imgHeight;
            let position = 0;
            pdf.addImage(dataUrl, 'JPEG', 0, position, pdfWidth, imgHeight);
            heightLeft -= 295;
            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(dataUrl, 'JPEG', 0, position, pdfWidth, imgHeight);
                heightLeft -= 295;
            }
            pdf.save(`정산서_${settlementRecipientName}_${targetYear}${String(targetMonthStr).padStart(2, '0')}.pdf`);
        } catch (e) {
            console.error(e);
            alert('정산서 생성 실패: ' + e.message);
        } finally {
            setIsGeneratingSettlement(false);
        }
    };

    const changeMonth = (offset) => {
        setBaseMonth(new Date(targetYear, baseMonth.getMonth() + offset, 1));
    };

    const openModal = (record = null) => {
        if (record) {
            setFormData({ date: record.date, route: record.route, quantity: record.quantity });
            setEditingId(record.id);
        } else {
            setFormData({ date: new Date().toISOString().split('T')[0], route: '', quantity: '' });
            setEditingId(null);
        }
        setIsModalOpen(true);
    };

    // 관리자가 어떤 화면(전체보기/다른 기사님 보기)을 보고 있더라도, 항상 본인 기록 입력으로 바로 전환해서 입력창을 여는 함수
    const openSelfModal = () => {
        setAdminSelectedEmail(user.email);
        openModal();
    };

    const handleSave = async () => {
        if (!formData.date || !formData.route || !formData.quantity) return alert('모든 항목을 입력해주세요.');

        try {
            if (editingId) {
                await db.collection('workRecords').doc(editingId).update({
                    date: formData.date,
                    route: formData.route,
                    quantity: Number(formData.quantity)
                });
            } else {
                await db.collection('workRecords').add({
                    name: user.name,
                    email: user.email,
                    date: formData.date,
                    route: formData.route,
                    quantity: Number(formData.quantity)
                });
            }
            setIsModalOpen(false);
        } catch (e) {
            console.error(e); alert('저장 실패: ' + e.message);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('기록을 정말 삭제하시겠습니까?')) {
            try {
                await db.collection('workRecords').doc(id).delete();
            } catch (e) { console.error(e); }
        }
    };

    const getDayName = (dateStr) => {
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        return days[new Date(dateStr).getDay()];
    };
    const formatRecordDate = (dateStr) => {
        const d = new Date(dateStr);
        return `${d.getMonth() + 1}월 ${d.getDate()}일`;
    };

    return (
        <main className="md:ml-[260px] ml-0 px-4 md:px-10 py-6 md:py-[50px] flex-1 animate-fade-in font-sans bg-[#F8FAFC] min-h-screen w-full max-w-[100vw] md:max-w-[calc(100vw-260px)] overflow-x-hidden">
            <header className="mb-6 w-full max-w-[1000px] mx-auto">
                <h2 className="text-[28px] font-extrabold text-[#1E293B] tracking-tight flex items-center gap-2"><Icons.Clipboard /> 업무내역입력</h2>
                <p className="text-[#64748B] mt-1.5 font-medium text-[15px]">일일 배송 완료 수량을 기록하고 정산 내역을 확인합니다.</p>
            </header>

            <div className="max-w-[1000px] mx-auto space-y-6">

                {/* 관리자 뷰 - 직원 선택기 */}
                {isAdmin && (
                    <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-gray-700 bg-blue-50 px-3 py-1 rounded-lg text-sm whitespace-nowrap">관리자 전용</span>
                            <span className="text-sm font-medium text-gray-600 whitespace-nowrap">조회할 직원을 선택하세요:</span>
                        </div>
                        <select
                            className="bg-gray-50 border border-gray-200 text-gray-800 text-sm font-bold rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none cursor-pointer w-full sm:w-auto"
                            value={adminSelectedEmail}
                            onChange={(e) => setAdminSelectedEmail(e.target.value)}
                        >
                            <option value="all">전체 직원 합산 보기</option>
                            <option value={user.email}>내 기록 입력 (관리자 본인)</option>
                            {uniqueUsers.map(u => (
                                <option key={u.email} value={u.email}>{u.name} ({u.email})</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* 상단 정산 월 컨트롤러 */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] p-6 flex flex-col items-center justify-center">
                    <div className="flex items-center gap-6">
                        <button onClick={() => changeMonth(-1)} className="w-[40px] h-[40px] border border-gray-200 rounded-xl bg-white hover:bg-gray-50 flex items-center justify-center text-gray-400 transition-colors"><Icons.ChevronLeft /></button>
                        <div className="text-center">
                            <h3 className="text-[22px] font-extrabold text-[#0F172A] tracking-tight">{targetYear}년 {targetMonthStr}월 정산</h3>
                            <p className="text-[14px] font-bold text-gray-400 mt-1">{displayStartStr} ~ {displayEndStr}</p>
                        </div>
                        <button onClick={() => changeMonth(1)} className="w-[40px] h-[40px] border border-gray-200 rounded-xl bg-white hover:bg-gray-50 flex items-center justify-center text-gray-400 transition-colors"><Icons.ChevronRight /></button>
                    </div>
                </div>

                {/* 3단 대시보드 요약 카드 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="bg-[#2E68ED] rounded-2xl p-6 shadow-md flex flex-col items-center justify-center text-white min-h-[140px] transition-transform hover:-translate-y-1">
                        <span className="inline-block text-white/80 font-bold mb-2 text-[15px]">이번 정산 총 배송</span>
                        <h2 className="text-[36px] font-extrabold tracking-tight">{totalQuantity.toLocaleString()}<span className="text-[20px] font-bold font-normal ml-1">건</span></h2>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col items-center justify-center min-h-[140px] transition-transform hover:-translate-y-1">
                        <span className="inline-block text-gray-500 font-bold mb-2 text-[15px]">근무일수</span>
                        <h2 className="text-[36px] font-extrabold tracking-tight text-[#0F172A]">{uniqueWorkDays.toLocaleString()}<span className="text-[20px] font-bold text-gray-500 font-normal ml-1">일</span></h2>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col items-center justify-center min-h-[140px] transition-transform hover:-translate-y-1">
                        <span className="inline-block text-gray-500 font-bold mb-2 text-[15px]">일평균</span>
                        <h2 className="text-[36px] font-extrabold tracking-tight text-[#0F172A]">{averageDaily.toLocaleString()}<span className="text-[20px] font-bold text-gray-500 font-normal ml-1">건</span></h2>
                    </div>
                </div>

                {/* 수량 입력 / 정산서 다운로드 버튼 컨테이너 */}
                <div className="flex flex-wrap justify-end gap-3 mt-2">
                    <button
                        onClick={handleDownloadSettlement}
                        disabled={isGeneratingSettlement || currentPeriodRecords.length === 0}
                        className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-6 py-3 rounded-xl font-bold text-[15px] shadow-sm transition-colors disabled:opacity-50"
                    >
                        <Icons.Download /> {isGeneratingSettlement ? '생성 중...' : '정산서 PDF 다운로드'}
                    </button>
                    {isAdmin ? (
                        // 관리자는 지금 어떤 화면(전체보기/다른 기사님 보기)을 보고 있어도, 이 버튼으로 항상 본인 배송건수를 입력할 수 있음
                        <button onClick={openSelfModal} className="flex items-center gap-2 bg-[#2E68ED] hover:bg-blue-700 text-white px-7 py-3 rounded-xl font-bold text-[15px] shadow-sm transition-colors">
                            <Icons.Plus /> 내 배송건수 입력
                        </button>
                    ) : (
                        <button onClick={() => openModal()} className="flex items-center gap-2 bg-[#2E68ED] hover:bg-blue-700 text-white px-7 py-3 rounded-xl font-bold text-[15px] shadow-sm transition-colors">
                            <Icons.Plus /> 수량 입력
                        </button>
                    )}
                </div>

                {/* 리스트 뷰 영역 */}
                <div className="space-y-4 pb-20 mt-4">
                    {currentPeriodRecords.length === 0 ? (
                        <div className="bg-white p-12 rounded-2xl border border-gray-100 text-center text-gray-400 font-bold text-[15px] shadow-sm">
                            해당 정산 기간에 등록된 업무 내역이 없습니다.
                        </div>
                    ) : currentPeriodRecords.map(record => (
                        <div key={record.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-wrap items-center justify-between gap-3 group hover:border-blue-200 transition-all">
                            <div className="flex flex-col gap-3 min-w-0">
                                <div className="flex flex-wrap items-center gap-2.5">
                                    <span className="text-gray-400 shrink-0"><Icons.Schedule /></span>
                                    <span className="text-[16px] font-extrabold text-[#0F172A] whitespace-nowrap shrink-0">{formatRecordDate(record.date)} ({getDayName(record.date)})</span>
                                    <span className="shrink-0 whitespace-nowrap px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[13px] font-bold">{record.route}</span>
                                    {isAdmin && targetEmailFilter === 'all' && <span className="shrink-0 whitespace-nowrap text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold">{record.name}</span>}
                                </div>

                                {/* Actions (Only for owner or admin viewing specific user wait, let's just let owner/admin always see it) */}
                                <div className="flex items-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openModal(record)} className="w-[34px] h-[34px] flex items-center justify-center rounded-lg border border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 text-gray-400 transition-colors bg-white"><Icons.Edit2 /></button>
                                    <button onClick={() => handleDelete(record.id)} className="w-[34px] h-[34px] flex items-center justify-center rounded-lg border border-gray-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200 text-gray-400 transition-colors bg-white"><Icons.Trash2 /></button>
                                </div>
                            </div>
                            <div className="flex items-baseline gap-1 shrink-0">
                                <span className="text-[24px] font-extrabold text-[#2E68ED]">{Number(record.quantity).toLocaleString()}</span>
                                <span className="font-bold text-[#2E68ED]">건</span>
                            </div>
                        </div>
                    ))}
                </div>

            </div>

            {/* 수량 입력 / 수정 모달 */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 bg-[#0F172A]/40 backdrop-blur-sm flex justify-center items-center py-10 px-4">
                    <div className="bg-white rounded-[24px] w-full max-w-[400px] overflow-hidden shadow-2xl animate-fade-in relative flex flex-col">
                        <div className="px-7 py-6 border-b border-gray-100 flex justify-between items-center bg-[#f8fafc]">
                            <h3 className="text-[20px] font-extrabold text-[#0F172A] flex items-center gap-2"><Icons.Clipboard /> {editingId ? '업무내역 수정' : '배송 수량 입력'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-black font-extrabold text-[26px] leading-none transition-colors">&times;</button>
                        </div>

                        <div className="p-7 space-y-5">
                            <div className="flex flex-col gap-2">
                                <label className="text-[14px] font-bold text-gray-700">배송 날짜 <span className="text-red-500">*</span></label>
                                <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[15px] font-bold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer text-[#0F172A]" />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-[14px] font-bold text-gray-700">배송 캠프 / 구역명 <span className="text-red-500">*</span></label>
                                <input type="text" placeholder="예: 남양주4" value={formData.route} onChange={e => setFormData({ ...formData, route: e.target.value })} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[15px] font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" />
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-[14px] font-bold text-gray-700">완료 수량 <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <input type="number" placeholder="0" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[18px] font-extrabold text-[#2E68ED] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-right pr-12 track-wider" />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-[16px]">건</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-7 pt-2 flex gap-3 bg-[#f8fafc]">
                            <button onClick={() => setIsModalOpen(false)} className="flex-[1] py-3.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-extrabold text-[15px] rounded-xl transition-colors shadow-sm">취소</button>
                            <button onClick={handleSave} className="flex-[2] py-3.5 bg-[#2E68ED] hover:bg-blue-700 text-white font-extrabold text-[15px] rounded-xl shadow-[0_4px_12px_rgb(46,104,237,0.3)] transition-colors">{editingId ? '수정 완료' : '등록 완료'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 정산서 PDF 캡처용 숨김 템플릿 */}
            <div style={{ position: 'absolute', top: 0, left: 0, opacity: 0, pointerEvents: 'none', zIndex: -9999 }}>
                <div ref={settlementPrintRef} style={{ width: '800px', backgroundColor: '#ffffff', padding: '48px', boxSizing: 'border-box', fontFamily: 'sans-serif', color: '#111' }}>
                    <h1 style={{ textAlign: 'center', fontSize: '22px', fontWeight: 800, marginBottom: '4px' }}>배송 업무 정산서</h1>
                    <p style={{ textAlign: 'center', fontSize: '12px', color: '#666', marginBottom: '24px' }}>코끼리물류</p>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '13px' }}>
                        <tbody>
                            <tr>
                                <td style={{ border: '1px solid #ccc', background: '#f5f5f5', fontWeight: 700, padding: '8px', width: '25%' }}>대상</td>
                                <td style={{ border: '1px solid #ccc', padding: '8px', width: '25%' }}>{settlementRecipientName}</td>
                                <td style={{ border: '1px solid #ccc', background: '#f5f5f5', fontWeight: 700, padding: '8px', width: '25%' }}>정산기간</td>
                                <td style={{ border: '1px solid #ccc', padding: '8px', width: '25%' }}>{displayStartStr} ~ {displayEndStr}</td>
                            </tr>
                            <tr>
                                <td style={{ border: '1px solid #ccc', background: '#f5f5f5', fontWeight: 700, padding: '8px' }}>총 배송건수</td>
                                <td style={{ border: '1px solid #ccc', padding: '8px', fontWeight: 800, color: '#2E68ED' }}>{totalQuantity.toLocaleString()}건</td>
                                <td style={{ border: '1px solid #ccc', background: '#f5f5f5', fontWeight: 700, padding: '8px' }}>근무일수 / 일평균</td>
                                <td style={{ border: '1px solid #ccc', padding: '8px' }}>{uniqueWorkDays}일 / {averageDaily.toLocaleString()}건</td>
                            </tr>
                        </tbody>
                    </table>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                        <thead>
                            <tr style={{ background: '#0F172A', color: '#fff' }}>
                                <th style={{ border: '1px solid #ccc', padding: '7px' }}>날짜</th>
                                <th style={{ border: '1px solid #ccc', padding: '7px' }}>요일</th>
                                {targetEmailFilter === 'all' && <th style={{ border: '1px solid #ccc', padding: '7px' }}>이름</th>}
                                <th style={{ border: '1px solid #ccc', padding: '7px' }}>구역</th>
                                <th style={{ border: '1px solid #ccc', padding: '7px' }}>배송건수</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...currentPeriodRecords].sort((a, b) => a.date.localeCompare(b.date)).map((r, idx) => (
                                <tr key={idx}>
                                    <td style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'center' }}>{formatRecordDate(r.date)}</td>
                                    <td style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'center' }}>{getDayName(r.date)}</td>
                                    {targetEmailFilter === 'all' && <td style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'center' }}>{r.name}</td>}
                                    <td style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'center' }}>{r.route}</td>
                                    <td style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'center', fontWeight: 700 }}>{Number(r.quantity).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p style={{ textAlign: 'center', fontSize: '11px', color: '#999', marginTop: '24px' }}>생성일: {new Date().toISOString().split('T')[0]}</p>
                </div>
            </div>
        </main>
    );
};

export { WorkRecordManagement };