import React, { useState, useMemo } from 'react';
import { db, storage, functions, ADMIN_EMAIL } from './firebase';
import { Icons } from './ui-components';

// --- Vehicle / Document Management (차량/서류관리) ---
// Start with empty to show the screenshot's empty state directly, but comment mock for logic representation.

const VehicleDocumentManagement = ({ user, docs, setDocs, contacts = [] }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [showNameSuggestions, setShowNameSuggestions] = useState(false);
    const [activeTab, setActiveTab] = useState('전체'); // 전체, 화물운송자격증, 운송사업허가증, 자동차등록증
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [viewingDoc, setViewingDoc] = useState(null); // Document detail modal

    const [formData, setFormData] = useState({ docType: '화물운송자격증', file: null });
    const [isSendingReminders, setIsSendingReminders] = useState(false);
    const [sendingReminderEmail, setSendingReminderEmail] = useState(null);

    const isAdmin = user && user.email === ADMIN_EMAIL;

    // 미제출 인원 집계
    const unsubmittedList = useMemo(() => {
        if (!contacts || !isAdmin) return [];
        // 배송기사 또는 조장 등 기사 권한 기사만 필터링
        const drivers = contacts.filter(c => c.role === '배송기사' || c.role === '조장');
        
        const docsToCheck = activeTab === '전체' 
            ? ['화물운송자격증', '운송사업허가증', '자동차등록증', '최초안전교육수료증'] 
            : [activeTab];
            
        const unsubmitted = [];
        drivers.forEach(driver => {
            const missing = [];
            docsToCheck.forEach(docType => {
                const hasDoc = docs.some(d => d.email === driver.email && d.docType === docType);
                if (!hasDoc) {
                    missing.push(docType);
                }
            });
            if (missing.length > 0) {
                unsubmitted.push({
                    name: driver.name,
                    email: driver.email,
                    phone: driver.phone || '연락처 없음',
                    team: driver.team || '소속 없음',
                    missing
                });
            }
        });
        return unsubmitted;
    }, [contacts, docs, activeTab, isAdmin]);

    // 검색창 드롭다운에 띄울 사람 이름 목록 (비상연락망 기준, 관리자는 전체/본인은 본인 이름만)
    const nameSuggestions = useMemo(() => {
        const pool = isAdmin ? contacts : contacts.filter(c => c.email === user.email);
        const names = Array.from(new Set(pool.map(c => c.name).filter(Boolean)));
        const q = searchQuery.trim().toLowerCase();
        const matched = q ? names.filter(n => n.toLowerCase().includes(q)) : names;
        return matched.sort((a, b) => a.localeCompare(b)).slice(0, 8);
    }, [contacts, isAdmin, user.email, searchQuery]);

    // Authorization Filter: Only own docs or ALL if Admin
    const myDocs = isAdmin ? docs : docs.filter(d => d.email === user.email);

    // Search & Tab Filter applied to authorizable docs
    const filteredDocs = myDocs.filter(d => {
        const matchTab = activeTab === '전체' || d.docType === activeTab;
        const q = searchQuery.toLowerCase();
        const matchSearch = d.name.toLowerCase().includes(q) || d.docType.toLowerCase().includes(q);
        return matchTab && matchSearch;
    });

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = evt => {
                setFormData({ ...formData, file: evt.target.result });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        if (!formData.file) return alert('서류 파일(사진)을 반드시 업로드해 주세요.');
        try {
            const docRef = await db.collection('vehicleDocs').add({
                date: new Date().toISOString().split('T')[0],
                name: user.name,
                email: user.email,
                docType: formData.docType,
                file: '' // Will update after upload
            });

            if (formData.file.startsWith('data:image')) {
                const fileRef = storage.ref(`vehicleDocs/${docRef.id}`);
                await fileRef.putString(formData.file, 'data_url');
                const url = await fileRef.getDownloadURL();
                await docRef.update({ file: url });
            } else {
                await docRef.update({ file: formData.file }); // fallback
            }

            setFormData({ docType: '화물운송자격증', file: null });
            setIsModalOpen(false);
        } catch (e) { console.error(e); alert('업로드 실패: ' + e.message); }
    };

    const handleDelete = async (docObj) => {
        if (window.confirm('증빙 서류를 진짜 삭제하시겠습니까?')) {
            try {
                await db.collection('vehicleDocs').doc(docObj.id).delete();
                if (docObj.file && docObj.file.includes('firebasestorage')) {
                    await storage.ref(`vehicleDocs/${docObj.id}`).delete();
                }
            } catch (e) { console.error(e); }
            setViewingDoc(null);
        }
    };

    const sendDocReminder = async (target) => {
        // target: 단일 대상(u) 또는 없으면 전체 미제출자
        const targets = target ? [target] : unsubmittedList;
        if (targets.length === 0) return;
        const confirmMsg = target
            ? `${target.name} 기사님께 미제출 서류(${target.missing.join(', ')}) 알림을 보낼까요?`
            : `미제출자 ${targets.length}명 전체에게 각자 빠뜨린 서류 알림을 보낼까요?`;
        if (!window.confirm(confirmMsg)) return;

        if (target) setSendingReminderEmail(target.email);
        else setIsSendingReminders(true);

        try {
            const fn = functions.httpsCallable('sendDocumentReminders');
            const reminders = targets.filter(t => t.email).map(t => ({ email: t.email, missingDocs: t.missing }));
            if (reminders.length === 0) return alert('알림을 받을 수 있는 이메일 정보가 없습니다.');
            const res = await fn({ reminders });
            alert(`발송 완료: ${res.data?.successCount ?? 0}명에게 전송됨`);
        } catch (e) {
            console.error(e);
            alert('발송 실패: ' + e.message);
        } finally {
            setSendingReminderEmail(null);
            setIsSendingReminders(false);
        }
    };

    return (
        <main className="md:ml-[260px] ml-0 px-4 md:px-10 py-6 md:py-[50px] flex-1 animate-fade-in font-sans bg-[#F8FAFC] min-h-screen">
            <header className="mb-10 w-full max-w-[1100px] mx-auto">
                <h2 className="text-[28px] font-extrabold text-[#1E293B] tracking-tight flex items-center gap-2"><Icons.Truck /> 차량/서류관리</h2>
                <p className="text-[#64748B] mt-1.5 font-medium text-[15px]">화물운송자격증, 운송사업허가증 등 서류를 업로드하고 관리합니다.</p>
            </header>

            <div className="max-w-[1100px] mx-auto space-y-6 flex flex-col min-h-[70vh]">

                {/* 관리자용 미제출 현황 패널 */}
                {isAdmin && unsubmittedList.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-2 shadow-sm">
                        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                            <h3 className="font-extrabold text-[14px] text-amber-800 flex items-center gap-1.5">
                                ⚠️ {activeTab === '전체' ? '필수 서류 미제출 기사 현황' : `${activeTab} 미제출 기사 현황`} ({unsubmittedList.length}명)
                            </h3>
                            <button
                                onClick={() => sendDocReminder(null)}
                                disabled={isSendingReminders}
                                className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-[12px] font-extrabold px-3.5 py-2 rounded-lg shadow-sm transition-colors whitespace-nowrap"
                            >
                                {isSendingReminders ? '발송 중...' : `📢 미제출자 전체에게 알림 발송 (${unsubmittedList.length}명)`}
                            </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                            {unsubmittedList.map(u => (
                                <div key={u.name} className="bg-white border border-amber-100 rounded-xl px-4 py-2.5 text-xs shadow-sm flex items-center justify-between gap-3">
                                    <div>
                                        <div className="font-bold text-gray-900">{u.name} 기사님 <span className="text-gray-400 font-medium text-[10px] ml-1">({u.team})</span></div>
                                        <div className="text-[9.5px] text-amber-600 mt-1 font-bold leading-tight">
                                            미제출: {u.missing.join(', ')}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                            onClick={() => sendDocReminder(u)}
                                            disabled={sendingReminderEmail === u.email || !u.email}
                                            title={u.email ? '이 기사님께만 알림 발송' : '이메일 정보 없음'}
                                            className="text-blue-600 hover:text-blue-800 font-bold bg-blue-50 p-2 rounded-lg text-sm disabled:opacity-40"
                                        >
                                            🔔
                                        </button>
                                        <a href={`tel:${u.phone}`} className="text-amber-600 hover:text-amber-800 font-bold bg-amber-50 p-2 rounded-lg text-sm" title="전화 걸기">
                                            📞
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 상단 툴바 (스크린샷과 동일한 배치) */}
                <div className="flex flex-col xl:flex-row flex-wrap gap-5 justify-between items-center mb-4">
                    {/* Search Bar */}
                    <div className="relative flex-1 w-full xl:w-auto xl:min-w-[260px] xl:max-w-[360px] shrink-0">
                        <div className="bg-white rounded-xl border border-gray-200 flex items-center px-4 py-3 hover:border-blue-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-[0_2px_8px_rgb(0,0,0,0.03)]">
                            <span className="text-gray-400 mr-2"><Icons.Search /></span>
                            <input
                                type="text"
                                className="w-full bg-transparent outline-none text-[15px] font-medium text-gray-800 placeholder-gray-400"
                                placeholder="기사 이름, 서류 종류 검색..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={() => setShowNameSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowNameSuggestions(false), 150)}
                            />
                        </div>
                        {showNameSuggestions && nameSuggestions.length > 0 && (
                            <div className="absolute left-0 right-0 top-[calc(100%+6px)] bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1.5 max-h-[240px] overflow-y-auto">
                                {nameSuggestions.map(name => (
                                    <button
                                        key={name}
                                        type="button"
                                        onMouseDown={(e) => { e.preventDefault(); setSearchQuery(name); setShowNameSuggestions(false); }}
                                        className="w-full text-left px-4 py-2.5 text-[14px] font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                    >
                                        {name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Tabs and Action */}
                    <div className="scroll-container flex items-center gap-4 w-full xl:w-auto xl:justify-end">
                        <div className="flex gap-1 bg-white p-1 rounded-xl border border-gray-200 min-w-max shadow-sm">
                            {['전체', '화물운송자격증', '운송사업허가증', '자동차등록증', '최초안전교육수료증'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-5 py-2 rounded-lg text-[14px] font-bold transition-all border border-transparent whitespace-nowrap ${activeTab === tab ? 'bg-[#2E68ED] text-white shadow-md' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setIsModalOpen(true)} className="flex items-center justify-center gap-1.5 bg-[#2E68ED] hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold text-[14px] shadow-sm transition-transform hover:-translate-y-0.5 min-w-[130px]">
                            <Icons.Plus /> 서류 업로드
                        </button>
                    </div>
                </div>

                {/* 메인 리스트 뷰 영역 */}
                {filteredDocs.length === 0 ? (
                    // Empty State (스크린샷과 완전히 동일한 감성 반영)
                    <div className="flex flex-col items-center justify-center pt-28 pb-32 text-center bg-transparent my-auto flex-1 h-full">
                        <div className="text-[#94A3B8] mb-5 border-[3px] border-[#E2E8F0] p-6 rounded-3xl bg-white shadow-sm">
                            <Icons.FileText />
                        </div>
                        <h3 className="text-[20px] font-bold text-[#64748B] mb-2 tracking-tight">등록된 서류가 없습니다</h3>
                        <p className="text-[15px] text-[#94A3B8] font-medium">서류 업로드 버튼을 눌러 등록해주세요</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
                        {filteredDocs.map(doc => (
                            <div key={doc.id} onClick={() => setViewingDoc(doc)} className="bg-white rounded-[20px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-gray-100 overflow-hidden cursor-pointer hover:border-blue-400 hover:shadow-lg transition-all group flex flex-col h-[280px]">
                                <div className="h-[180px] bg-gray-50 flex items-center justify-center overflow-hidden border-b border-gray-100 relative">
                                    {doc.file ? (
                                        <img src={doc.file} alt={doc.docType} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    ) : (
                                        <div className="text-gray-300"><Icons.FileText /></div>
                                    )}
                                    <div className="absolute inset-0 bg-[#0F172A]/40 backdrop-blur-[1px] transition-colors flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 duration-300">
                                        <div className="bg-white text-[#0F172A] px-5 py-2.5 rounded-full text-sm font-extrabold shadow-md flex items-center gap-2">
                                            <Icons.Eye /> 상세 증빙 열람
                                        </div>
                                    </div>
                                </div>
                                <div className="p-5 flex flex-col justify-between flex-1">
                                    <div>
                                        <span className="inline-block px-2.5 py-1 bg-blue-50 text-blue-700 text-[11px] font-extrabold rounded-md mb-2">{doc.docType}</span>
                                        <h4 className="text-[16px] font-extrabold text-[#0F172A] truncate tracking-tight">{doc.name} 님의 {doc.docType}</h4>
                                    </div>
                                    <p className="text-[12.5px] text-gray-500 font-bold">제출일자: {doc.date}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

            </div>

            {/* 업로드 모달창 */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 bg-[#0F172A]/60 backdrop-blur-sm flex justify-center items-center py-10 px-4">
                    <div className="bg-white rounded-[24px] w-full max-w-[460px] overflow-hidden shadow-2xl animate-fade-in relative flex flex-col">
                        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-[#f8fafc]">
                            <h3 className="text-[20px] font-extrabold text-[#0F172A] flex items-center gap-2 tracking-tight"><Icons.Plus /> 신규 서류 업로드</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-black font-extrabold text-[26px] leading-none transition-colors">&times;</button>
                        </div>

                        <div className="p-8 space-y-6">
                            <div>
                                <label className="block text-[14px] font-bold text-gray-700 mb-2">서류 제출 신원 (자동 기입)</label>
                                <input type="text" value={`${user.name} (${user.email})`} disabled className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-[14px] font-bold text-gray-500 cursor-not-allowed shadow-inner" />
                            </div>

                            <div>
                                <label className="block text-[14px] font-bold text-gray-700 mb-2">서류 종류 구분 <span className="text-red-500">*</span></label>
                                <select value={formData.docType} onChange={e => setFormData({ ...formData, docType: e.target.value })} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[15px] font-bold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors shadow-sm appearance-none cursor-pointer text-[#0F172A]">
                                    <option value="화물운송자격증">화물운송자격증 (필수)</option>
                                    <option value="운송사업허가증">운송사업허가증</option>
                                    <option value="자동차등록증">자동차등록증</option>
                                    <option value="최초안전교육수료증">최초안전교육수료증</option>
                                    <option value="기타증빙">기타 증빙서류 (범용)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[14px] font-bold text-gray-700 mb-2">서류 사진 촬영본 또는 스캔본 <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <input type="file" id="docUpload" accept="image/*" onChange={handleFileUpload} className="hidden" />
                                    <label htmlFor="docUpload" className={`w-full h-[180px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden ${formData.file ? 'border-blue-300 shadow-md transform scale-[1.01]' : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50/50'}`}>
                                        {formData.file ? (
                                            <img src={formData.file} alt="preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="text-center group">
                                                <div className="text-gray-400 flex justify-center mb-3 group-hover:text-blue-500 transition-colors scale-110"><Icons.Camera /></div>
                                                <span className="text-[15px] font-extrabold text-gray-600 block group-hover:text-blue-600 transition-colors">이곳을 클릭하여 사진 첨부</span>
                                                <span className="text-[12.5px] text-gray-400 font-medium mt-1 block">스마트폰 앨범 또는 PC 파일 (JPG/PNG)</span>
                                            </div>
                                        )}
                                    </label>
                                </div>
                                {formData.file && <button className="mt-3 text-[13px] font-extrabold text-gray-500 hover:text-red-500 bg-white px-3 py-1 rounded-md border shadow-sm transition-colors" onClick={() => setFormData({ ...formData, file: null })}>파일 지우기 및 다시 선택</button>}
                            </div>
                        </div>

                        <div className="p-8 pt-0 flex gap-3 bg-white">
                            <button onClick={() => setIsModalOpen(false)} className="flex-[1] py-3.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-extrabold text-[15px] rounded-xl transition-colors shadow-sm">취소</button>
                            <button onClick={handleSave} className="flex-[2] py-3.5 bg-[#2E68ED] hover:bg-blue-700 text-white font-extrabold text-[15px] rounded-xl shadow-[0_4px_12px_rgb(46,104,237,0.3)] transition-colors">보안 서버에 안전하게 업로드</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 서류 상세 확대 / 관리 모달창 */}
            {viewingDoc && (
                <div className="fixed inset-0 z-[60] bg-[#0F172A]/90 flex justify-center items-center py-6 px-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl animate-fade-in relative overflow-hidden">
                        <div className="p-5 border-b flex justify-between items-center bg-[#F8FAFC]">
                            <div className="flex flex-col ml-2">
                                <h3 className="text-[22px] font-extrabold text-[#0F172A] tracking-tight">{viewingDoc.name} 기사님의 <span className="text-blue-600">{viewingDoc.docType}</span></h3>
                                <span className="text-[13px] text-gray-500 font-bold mt-1">서류 업로드 일자: {viewingDoc.date} | 보안 계정 식별: {viewingDoc.email}</span>
                            </div>
                            <button onClick={() => setViewingDoc(null)} className="text-gray-400 hover:text-black font-extrabold text-[28px] w-12 h-12 flex items-center justify-center rounded-xl bg-white border border-gray-200 hover:bg-gray-100 transition-colors shadow-sm">&times;</button>
                        </div>

                        <div className="flex-1 overflow-auto p-4 flex justify-center items-center bg-[#E2E8F0]">
                            {viewingDoc.file ? <img src={viewingDoc.file} alt="Full View" className="max-w-full h-auto object-contain shadow-md rounded-xl border border-gray-200 bg-white max-h-full" /> : <div className="text-gray-400 text-2xl font-bold">이미지 데이터가 없습니다.</div>}
                        </div>

                        {/* 본인이거나 관리자면 하단에 삭제 옵션 제공 */}
                        {(isAdmin || viewingDoc.email === user.email) && (
                            <div className="p-5 bg-white border-t flex justify-end items-center gap-4">
                                <span className="text-[12.5px] font-medium text-gray-500">{isAdmin ? '관리자는 모든 보안 서류를 파기할 권한을 가집니다.' : '본인이 등록한 서류이므로 파기할 수 있습니다.'}</span>
                                <button onClick={() => handleDelete(viewingDoc)} className="flex items-center gap-2 bg-[#FFF0F0] hover:bg-[#FFE0E0] border border-[#FFD6D6] text-[#D83232] px-6 py-3 rounded-xl font-extrabold text-[14.5px] transition-colors"><Icons.Trash2 />서류 영구 파기</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

        </main>
    );
}

export { VehicleDocumentManagement };