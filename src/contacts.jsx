const formatPhoneNumber = (value) => {
    if (!value) return '';
    const raw = value.replace(/[^0-9]/g, '');
    if (raw.length <= 3) return raw;
    if (raw.length <= 7) return `${raw.slice(0, 3)}-${raw.slice(3)}`;
    if (raw.length <= 11) return `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7)}`;
    return `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 11)}`;
};
import React, { useState, useEffect } from 'react';
import { db, ADMIN_EMAIL } from './firebase';
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { Icons } from './ui-components';

// --- Contact Management (비상연락망) ---
const ContactManagement = ({ user, contacts, setContacts }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('전체'); // '전체', '내부', '외부기관'

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState(null);
    const [formData, setFormData] = useState({ name: '', role: '', tag: '전체', phone: '', type: 'internal' });

    // 쿠팡 고객센터 동적 번호 설정
    const [coupangPhone, setCoupangPhone] = useState('1577-7011');
    const [isEditingCoupang, setIsEditingCoupang] = useState(false);
    const [tempCoupangPhone, setTempCoupangPhone] = useState('1577-7011');

    useEffect(() => {
        db.collection('settings').doc('contact').get().then(doc => {
            if (doc.exists && doc.data().coupangPhone) {
                setCoupangPhone(doc.data().coupangPhone);
                setTempCoupangPhone(doc.data().coupangPhone);
            }
        });
    }, []);

    const handleSaveCoupangPhone = async () => {
        try {
            await db.collection('settings').doc('contact').set({ coupangPhone: tempCoupangPhone }, { merge: true });
            setCoupangPhone(tempCoupangPhone);
            setIsEditingCoupang(false);
        } catch (e) { alert('번호 저장 실패: ' + e.message); }
    };

    // Only true if logged in as Admin
        // Find ER phone numbers from database if exists
    const konkukContact = contacts.find(c => c.name.includes('건대병원') || c.name.includes('건국대'));
    const asanContact = contacts.find(c => c.name.includes('아산병원'));
    
    const konkukPhone = konkukContact ? konkukContact.phone : '02-2030-5555';
    const asanPhone = asanContact ? asanContact.phone : '02-3010-3333';

    // State for viewing/downloading organizational tree
    const [isTreeModalOpen, setIsTreeModalOpen] = useState(false);

    const rep = contacts.find(c => c.role.includes('대표') || c.name === '권오민') || { name: '권오민', phone: '010-2514-4826', role: '대표' };
    const leaderNames = ['김성준', '김대건', '설영대'];
    const leaders = leaderNames.map(name => {
        return contacts.find(c => c.name.includes(name)) || { name, role: '조장', phone: '010-0000-0000', id: name };
    });
    const rest = contacts.filter(c => c.id !== rep.id && !leaderNames.some(name => c.name.includes(name)) && !c.name.includes('병원'));
    const distributed = [[], [], []];
    rest.forEach((c, idx) => {
        distributed[idx % 3].push(c);
    });

    const isAdmin = user && user.email === ADMIN_EMAIL;

    const filteredContacts = contacts.filter(c => {
        const matchTab = activeTab === '전체' || (activeTab === '내부' && c.type === 'internal') || (activeTab === '캠프' && c.type === 'external');
        const q = searchQuery.toLowerCase();
        const matchSearch = c.name.toLowerCase().includes(q) || c.role.toLowerCase().includes(q) || c.phone.replace(/-/g, '').includes(q);
        return matchTab && matchSearch;
    });

    const openModal = (contact = null) => {
        if (contact) {
            setEditingContact(contact);
            setFormData({
                name: contact.name || '',
                role: contact.role || '',
                tag: contact.tag || '전체',
                phone: contact.phone || '',
                type: contact.type || 'internal',
                email: contact.email || ''
            });
        } else {
            setEditingContact(null);
            setFormData({ name: '', role: '', tag: '전체', phone: '', type: 'internal', email: '' });
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.name || !formData.phone) return alert('이름과 전화번호는 필수입니다.');
        try {
            const targetEmail = formData.email || (editingContact && editingContact.email);
            const name = formData.name || '';
            const role = formData.role || '';
            const tag = formData.tag || '전체';
            const phone = formData.phone || '';
            const type = formData.type || 'internal';

            if (editingContact) {
                await db.collection('contacts').doc(editingContact.id).update({
                    name, role, tag, phone, type
                });
            } else {
                await db.collection('contacts').add({
                    name, role, tag, phone, type
                });
            }
            if (targetEmail) {
                await db.collection('users').doc(targetEmail).set({
                    name,
                    phone
                }, { merge: true });
            }
            setIsModalOpen(false);
        } catch (e) { console.error(e); alert('저장 실패: ' + e.message); }
    };

    const handleDelete = async (contact) => {
        if (window.confirm(`'${contact.name}' 연락처를 비상연락망 목록에서 삭제하시겠습니까?`)) {
            try {
                await db.collection('contacts').doc(contact.id).delete();
                alert('연락처가 성공적으로 삭제되었습니다.');
            } catch (e) { console.error(e); alert('삭제 실패: ' + e.message); }
        }
    };

    const handleAccountDelete = async (contact) => {
        const confirmMsg = `'${contact.name}' 기사님의 회원 계정 및 비상연락망 정보를 영구적으로 완전 삭제(회원탈퇴)하시겠습니까?\n\n※ 삭제 시 해당 기사는 시스템 접속 권한이 완전 파기됩니다.`;
        if (window.confirm(confirmMsg)) {
            try {
                await db.collection('contacts').doc(contact.id).delete();
                if (contact.email) {
                    await db.collection('users').doc(contact.email).delete();
                }
                alert(`'${contact.name}' 기사님의 회원 계정이 완전히 삭제되었습니다.`);
            } catch (e) { console.error(e); alert('계정 완전 삭제 실패: ' + e.message); }
        }
    };

    const getInitial = (name) => {
        if (!name) return '?';
        return name.charAt(0).toUpperCase();
    };

    const getTagColor = (tag) => {
        if (tag === '전체') return 'bg-green-100 text-green-700 font-bold';
        return 'bg-green-50 text-green-700 bg-opacity-80 border border-green-200 shadow-sm font-bold';
    };

    return (
        <main className="md:ml-[260px] ml-0 px-4 md:px-10 py-6 md:py-[60px] flex-1 animate-fade-in font-sans bg-[#F4F7FB] min-h-screen w-full max-w-[100vw] md:max-w-[calc(100vw-260px)] overflow-x-hidden">
            <header className="mb-10 w-full max-w-[900px] mx-auto border-b pb-8 border-gray-200/60">
                <h2 className="text-[30px] font-extrabold text-[#1E293B] tracking-tight flex items-center gap-2"><Icons.PhoneCall /> 비상연락망</h2>
                <p className="text-[#64748B] mt-2 font-medium text-[16px]">긴급 연락처와 조직 연락망을 관리합니다</p>
            </header>

            <div className="max-w-[900px] mx-auto space-y-6">

                {/* 상단 툴바 (검색창, 필터탭, 연락처 추가 버튼) */}
                <div className="flex flex-col md:flex-row gap-5 justify-between items-center mb-2">
                    {/* Search Bar */}
                    <div className="relative flex-1 w-full bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-200 flex items-center px-4 py-3 hover:border-blue-400 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100 transition-all">
                        <span className="text-gray-400 mr-3"><Icons.Search /></span>
                        <input
                            type="text"
                            className="w-full bg-transparent outline-none text-[15px] font-medium text-gray-800 placeholder-gray-400"
                            placeholder="이름, 직책, 전화번호 검색..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Tabs and Action */}
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsTreeModalOpen(true)} className="flex items-center gap-1.5 bg-white border border-blue-200 hover:bg-blue-50 text-blue-600 px-5 py-3 rounded-xl font-bold text-[14px] shadow-sm transition-all active:scale-95">
                            📊 조직도형 PDF 다운로드
                        </button>
                        <div className="flex gap-1.5 bg-white p-1 rounded-[14px] shadow-sm border border-gray-200">
                            {['전체', '내부', '캠프'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-5 py-2.5 rounded-[10px] text-[14px] font-extrabold transition-all border border-transparent ${activeTab === tab ? 'bg-[#2E68ED] text-white shadow-md' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100 hover:border-gray-200'}`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                        {isAdmin && (
                            <button onClick={() => openModal()} className="flex items-center gap-1.5 bg-[#2E68ED] hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-bold text-[15px] shadow-[0_4px_12px_rgb(46,104,237,0.3)] transition-transform hover:-translate-y-0.5">
                                <Icons.Plus /> 연락처 추가
                            </button>
                        )}
                    </div>
                </div>

                {/* 비상 핫라인 3구 버튼 */}
                {/* ER Hotlines */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pb-6 border-b border-gray-200/60">
                    <a href={"tel:" + konkukPhone} className="flex flex-col items-center justify-center bg-red-50/75 hover:bg-red-100/80 text-red-700 p-4.5 rounded-2xl border border-red-100 transition-all hover:scale-[1.01] shadow-sm text-center">
                        <span className="text-[11px] font-bold text-red-500 tracking-wider uppercase">🚨 광진구 지정 의료원</span>
                        <span className="font-extrabold text-[15px] mt-1 flex items-center gap-1.5">건대병원 응급실 ({konkukPhone})</span>
                    </a>
                    <a href={"tel:" + asanPhone} className="flex flex-col items-center justify-center bg-red-50/75 hover:bg-red-100/80 text-red-700 p-4.5 rounded-2xl border border-red-100 transition-all hover:scale-[1.01] shadow-sm text-center">
                        <span className="text-[11px] font-bold text-red-500 tracking-wider uppercase">🚨 송파구 지정 의료원</span>
                        <span className="font-extrabold text-[15px] mt-1 flex items-center gap-1.5">아산병원 응급실 ({asanPhone})</span>
                    </a>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pb-6 border-b border-gray-200/60">
                    <a href="tel:112" className="flex items-center justify-center gap-2 bg-[#FFEAEA] hover:bg-[#FFD9D9] text-[#D83232] py-5 rounded-2xl font-extrabold text-[16px] transition-colors shadow-sm">
                        <Icons.AlertTriangle /> 경찰 112
                    </a>
                    <a href="tel:119" className="flex items-center justify-center gap-2 bg-[#FFF3D6] hover:bg-[#FFEAAD] text-[#B87C0D] py-5 rounded-2xl font-extrabold text-[16px] transition-colors shadow-sm">
                        <Icons.AlertTriangle /> 소방/응급 119
                    </a>
                    {isEditingCoupang ? (
                        <div className="flex items-center justify-center gap-2 bg-[#CDE1FF] py-3 px-3 rounded-2xl shadow-sm border border-blue-300">
                            <input type="text" value={tempCoupangPhone} onChange={e => setTempCoupangPhone(formatPhoneNumber(e.target.value))} className="w-full bg-white border border-blue-200 outline-none rounded-lg px-2 py-2 text-[14px] text-center font-bold text-[#2459B4] focus:border-blue-500" placeholder="전화번호" />
                            <button onClick={handleSaveCoupangPhone} className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors">저장</button>
                            <button onClick={() => setIsEditingCoupang(false)} className="shrink-0 bg-gray-400 hover:bg-gray-500 text-white px-3 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors">취소</button>
                        </div>
                    ) : (
                        <div className="relative group bg-[#E1EDFF] rounded-2xl shadow-sm transition-colors flex items-center justify-center overflow-hidden h-[64px]">
                            <a href={`tel:${coupangPhone}`} className="flex-1 flex items-center justify-center gap-2 hover:bg-[#CDE1FF] text-[#2459B4] h-full font-extrabold text-[16px] transition-colors w-full">
                                <Icons.Building /> 쿠팡 고객센터 ({coupangPhone})
                            </a>
                            {isAdmin && (
                                <button onClick={() => setIsEditingCoupang(true)} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 bg-white border border-blue-200 text-blue-600 w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:bg-blue-50 shadow-md" title="번호 수정">
                                    <Icons.Edit2 />
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* 리스트 타이틀 */}
                {/* 실시간 조직계통도 뷰 */}
                <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-[0_2px_12px_rgba(0,0,0,0.03)] my-6">
                    <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
                        <h4 className="text-[16px] font-extrabold text-[#1E293B] flex items-center gap-2">
                            <span>📊</span> 비상연락계통 조직도 (실시간 뷰)
                        </h4>
                        <span className="text-[11px] font-bold text-gray-400">DB 연동 자동 동기화</span>
                    </div>
                    
                    <div className="scroll-container p-4 bg-gray-50/50 rounded-2xl flex md:justify-center justify-start">
                        <div className="bg-white p-6 text-black border border-gray-300 w-[760px] font-sans text-xs leading-normal shadow-sm rounded-xl">
                            <h2 className="text-center font-extrabold text-[16px] border-2 border-black py-1.5 mb-3 tracking-[8px] uppercase">비 상 연 락 망</h2>
                            
                            <div className="flex justify-between items-end mb-3">
                                <span className="text-[9px] font-bold text-gray-500">조회일자: {new Date().getFullYear()}년 {String(new Date().getMonth() + 1).padStart(2, '0')}월 {String(new Date().getDate()).padStart(2, '0')}일</span>
                                <div className="border border-gray-400 p-1.5 text-[9px] font-bold text-gray-700 space-y-0.5 text-left">
                                    <p>담 당 자 : {rep.name} {rep.phone}</p>
                                    <p>건대병원 : {konkukPhone} | 아산병원 : {asanPhone}</p>
                                </div>
                            </div>

                            <div className="flex flex-col items-center w-full mt-2">
                                <div className="border border-black w-[180px] text-center p-1.5 bg-gray-50 shadow-sm rounded-md">
                                    <div className="font-extrabold text-[10px] border-b border-gray-300 pb-0.5">(대표)</div>
                                    <div className="font-bold text-[10px] mt-1">{rep.name}</div>
                                    <div className="text-[9px] text-blue-600 font-bold mt-0.5">{rep.phone}</div>
                                </div>

                                <div className="w-[1.5px] h-[20px] bg-black"></div>
                                <div className="w-[66%] h-[1.5px] bg-black"></div>
                                
                                <div className="flex justify-between w-[66%]">
                                    <div className="w-[1.5px] h-[10px] bg-black"></div>
                                    <div className="w-[1.5px] h-[10px] bg-black"></div>
                                    <div className="w-[1.5px] h-[10px] bg-black"></div>
                                </div>

                                <div className="flex justify-between w-full gap-3 mt-0.5">
                                    {leaders.map((leader, leaderIdx) => (
                                        <div key={leader.name} className="flex-1 flex flex-col items-center">
                                            <div className="border border-black w-[130px] text-center p-1.5 bg-gray-100 font-extrabold text-[10px] rounded shadow-sm">
                                                <div className="border-b border-gray-200 pb-0.5">관리</div>
                                                <div className="mt-0.5">{leader.name}</div>
                                                <div className="text-[9px] text-blue-600 font-bold mt-0.5">{leader.phone}</div>
                                            </div>
                                            <div className="w-[1.5px] h-[10px] bg-black"></div>
                                            <div className="w-full flex flex-wrap justify-center gap-1.5">
                                                {distributed[leaderIdx].map(c => (
                                                    <div key={c.id} className="border border-gray-200 w-[95px] text-center p-1 rounded bg-white shadow-sm">
                                                        <div className="font-bold text-[9.5px] text-gray-800">{c.name}</div>
                                                        <div className="text-[8px] text-gray-400 mt-0.5">{c.role || '기사'}</div>
                                                        <div className="text-[8.5px] text-blue-600 font-extrabold mt-0.5">{c.phone}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 mt-8 mb-2">
                    <span className="text-gray-500"><Icons.Users /></span>
                    <h3 className="text-[17px] font-extrabold text-[#334155]">{activeTab} 연락망</h3>
                </div>

                {/* 연락처 카드 리스트 */}
                <div className="grid grid-cols-1 gap-4 pb-20">
                    {filteredContacts.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-3xl border border-gray-200 shadow-sm">
                            <p className="text-gray-400 font-bold text-[15px]">조건에 맞는 연락처가 없습니다.</p>
                        </div>
                    ) : filteredContacts.map(contact => (
                        <div key={contact.id} className="bg-white p-6 rounded-[20px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-gray-100 flex items-center justify-between hover:border-[#ADC4FF] hover:shadow-md transition-all group">
                            <div className="flex items-center gap-6">
                                {/* Avatar (동그란 아이콘) */}
                                <div className="w-[56px] h-[56px] rounded-full bg-[#E1EDFF] text-[#2E68ED] flex items-center justify-center text-[24px] font-extrabold shrink-0 shadow-sm border border-blue-50">
                                    {getInitial(contact.name)}
                                </div>

                                {/* Contact Info */}
                                <div className="flex flex-col items-start gap-1.5">
                                    <h4 className="text-[18px] font-extrabold text-[#0F172A]">{contact.name}</h4>
                                    <span className="text-[14px] text-[#64748B] font-bold">{contact.role}</span>
                                    <span className={`mt-0.5 text-[12.5px] px-2.5 py-0.5 rounded-md ${getTagColor(contact.tag)}`}>{contact.tag}</span>
                                </div>
                            </div>

                            <div className="flex flex-col items-end gap-3">
                                {/* Phone Number Link */}
                                <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-[#2E68ED] font-extrabold text-[17px] hover:text-blue-800 transition-colors bg-blue-50/50 px-4 py-2 rounded-xl">
                                    {contact.phone} <span className="opacity-80"><Icons.Phone /></span>
                                </a>

                                {/* Admin Actions Container - Always preserve space (h-9) so layout doesn't jump */}
                                <div className="h-9 flex items-center gap-2">
                                    {isAdmin && (
                                        <div className="opacity-0 group-hover:opacity-100 transition-all flex items-center gap-2 translate-y-1 group-hover:translate-y-0">
                                            <button onClick={() => openModal(contact)} className="w-9 h-9 flex items-center justify-center border border-gray-200 rounded-xl text-gray-500 hover:text-[#2E68ED] hover:border-[#2E68ED] hover:bg-blue-50 transition-colors bg-white shadow-sm" title="수정"><Icons.Edit2 /></button>
                                            <button onClick={() => handleDelete(contact)} className="w-9 h-9 flex items-center justify-center border border-gray-200 rounded-xl text-gray-500 hover:text-orange-500 hover:border-orange-400 hover:bg-orange-50 transition-colors bg-white shadow-sm" title="연락처 목록만 삭제"><Icons.Trash2 /></button>
                                            {contact.email && (
                                                <button onClick={() => handleAccountDelete(contact)} className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-bold shadow-sm transition-colors" title="기사 계정 완전 삭제 (회원탈퇴 처리)">🚨 계정완전삭제</button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

            </div>

            {/* 등록/수정 모달창 */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-center items-center py-10 px-4">
                    <div className="bg-white rounded-[24px] w-full max-w-[420px] overflow-hidden shadow-2xl animate-fade-in relative flex flex-col">
                        <div className="px-7 py-6 border-b border-gray-100 flex justify-between items-center bg-[#f8fafc]">
                            <h3 className="text-[20px] font-extrabold text-[#0F172A]">{editingContact ? '연락처 수정' : '새 연락처 추가'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-black font-extrabold text-[26px] leading-none transition-colors">&times;</button>
                        </div>

                        <div className="p-7 space-y-5">
                            <div>
                                <label className="block text-[14px] font-bold text-gray-700 mb-2">이름 또는 부서명 <span className="text-red-500">*</span></label>
                                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[15px] font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors shadow-sm" placeholder="예: 구리2캠프 담당" />
                            </div>
                            <div>
                                <label className="block text-[14px] font-bold text-gray-700 mb-2">직책 / 소속 설명</label>
                                <input type="text" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[15px] font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors shadow-sm" placeholder="예: 캠프매니저, 대표이사" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[14px] font-bold text-gray-700 mb-2">근무지 라벨</label>
                                    <input type="text" value={formData.tag} onChange={e => setFormData({ ...formData, tag: e.target.value })} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[15px] font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors shadow-sm" placeholder="전체, 구리2 등" />
                                </div>
                                <div>
                                    <label className="block text-[14px] font-bold text-gray-700 mb-2">분류</label>
                                    <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[15px] font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors shadow-sm appearance-none cursor-pointer">
                                        <option value="internal">내부 직원</option>
                                        <option value="external">캠프</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[14px] font-bold text-gray-700 mb-2">전화번호 <span className="text-red-500">*</span></label>
                                <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: formatPhoneNumber(e.target.value) })} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[15px] font-extrabold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors shadow-sm tracking-wide text-blue-800" placeholder="010-0000-0000" />
                            </div>
                        </div>

                        <div className="p-7 pt-2 flex gap-3 bg-[#f8fafc]">
                            <button onClick={() => setIsModalOpen(false)} className="flex-[1] py-3.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-extrabold text-[15px] rounded-xl transition-colors shadow-sm">취소</button>
                            <button onClick={handleSave} className="flex-[2] py-3.5 bg-[#2E68ED] hover:bg-blue-700 text-white font-extrabold text-[15px] rounded-xl shadow-[0_4px_12px_rgb(46,104,237,0.3)] transition-colors">저장하기</button>
                        </div>
                    </div>
                </div>
            )}
                    {/* 조직도형 연락망 상세 모달 */}
            {isTreeModalOpen && (() => {


                const downloadTreePDF = () => {
                    const el = document.getElementById('printable-contact-tree');
                    if (!el) return;
                    toJpeg(el, {
                        quality: 0.98,
                        style: { transform: 'none', opacity: '1', visibility: 'visible' }
                    }).then(dataUrl => {
                        const pdf = new jsPDF('p', 'mm', 'a4');
                        pdf.addImage(dataUrl, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
                        pdf.save(`비상연락망_조직도_${rep.name}_${new Date().toISOString().split('T')[0]}.pdf`);
                    }).catch(err => {
                        console.error('PDF 다운로드 실패:', err);
                        alert('PDF 다운로드 실패: ' + err.message);
                    });
                };

                return (
                    <div className="fixed inset-0 z-50 bg-[#0F172A]/40 backdrop-blur-sm flex justify-center items-center py-10 px-4">
                        <div className="bg-white rounded-[24px] w-full max-w-5xl max-h-full overflow-y-auto p-8 shadow-2xl animate-fade-in relative flex flex-col">
                            <button onClick={() => setIsTreeModalOpen(false)} className="absolute top-6 right-6 text-gray-400 hover:text-black font-extrabold text-2xl">&times;</button>
                            
                            <div className="border-b pb-4 mb-6 flex justify-between items-center pr-10">
                                <div>
                                    <h3 className="text-xl font-bold">비상연락망 조직도</h3>
                                    <p className="text-xs text-gray-500 mt-1">제출 서류용으로 활용 가능한 표준 구조 비상 연락망 조직도입니다.</p>
                                </div>
                                <button onClick={downloadTreePDF} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold shadow-sm active:scale-95 transition-all">
                                    📥 조직도 PDF 다운로드
                                </button>
                            </div>

                            <div className="scroll-container border border-gray-100 rounded-3xl p-6 bg-gray-50/50 flex md:justify-center justify-start">
                                <div id="printable-contact-tree" className="bg-white p-8 text-black border border-gray-300 w-[800px] font-sans text-xs leading-normal">
                                    {/* Top Date */}
                                    <div className="flex justify-between items-end mb-2">
                                        <div></div>
                                        <div className="text-[10px] font-bold text-gray-500">
                                            다운로드 일시 : {new Date().getFullYear()}년 {String(new Date().getMonth() + 1).padStart(2, '0')}월 {String(new Date().getDate()).padStart(2, '0')}일
                                        </div>
                                    </div>
                                    
                                    {/* Title */}
                                    <h2 className="text-center font-extrabold text-xl border-2 border-black py-2 mb-4 tracking-[10px] uppercase">비 상 연 락 망</h2>
                                    
                                    {/* Right Sidebar Info */}
                                    <div className="flex justify-end mb-4">
                                        <div className="border border-gray-400 p-2.5 text-[10px] font-bold text-gray-700 space-y-1 text-left">
                                            <p>담 당 자 : {rep.name} {rep.phone}</p>
                                            <p className="text-red-600">건대병원 응급실 : {konkukPhone}</p>
                                            <p className="text-red-600">아산병원 응급실 : {asanPhone}</p>
                                        </div>
                                    </div>

                                    {/* Tree diagram layout */}
                                    <div className="flex flex-col items-center w-full mt-4">
                                        {/* Level 1: Representative */}
                                        <div className="border border-black w-[200px] text-center p-2 bg-gray-50 shadow-sm rounded-md mx-auto">
                                            <div className="font-extrabold text-[11px] border-b border-gray-300 pb-0.5">(대표)</div>
                                            <div className="font-bold text-[10.5px] mt-1">{rep.name}</div>
                                            <div className="text-[10px] text-blue-600 font-bold mt-0.5">{rep.phone}</div>
                                        </div>

                                        {/* Vertical connector line */}
                                        <div className="w-[1.5px] h-[25px] bg-black mx-auto"></div>
                                        <div className="w-[66%] h-[1.5px] bg-black mx-auto"></div>
                                        
                                        <div className="flex justify-between w-[66%] mx-auto">
                                            <div className="w-[1.5px] h-[15px] bg-black"></div>
                                            <div className="w-[1.5px] h-[15px] bg-black"></div>
                                            <div className="w-[1.5px] h-[15px] bg-black"></div>
                                        </div>

                                        {/* 3 Leaders Columns */}
                                        <div className="flex justify-between w-full gap-4 mt-0.5">
                                            {leaders.map((leader, leaderIdx) => (
                                                <div key={leader.name} className="flex-1 flex flex-col items-center">
                                                    {/* Leader Box */}
                                                    <div className="border border-black w-[150px] text-center p-2 bg-gray-100 font-extrabold text-[11px] rounded shadow-sm">
                                                        <div className="border-b border-gray-300 pb-0.5">관리</div>
                                                        <div className="mt-1">{leader.name}</div>
                                                        <div className="text-[9.5px] text-blue-600 font-bold mt-0.5">{leader.phone}</div>
                                                    </div>
                                                    
                                                    {/* Vertical line down to members */}
                                                    <div className="w-[1.5px] h-[15px] bg-black"></div>
                                                    
                                                    {/* Team Members List */}
                                                    <div className="w-full flex flex-wrap justify-center gap-2.5">
                                                        {distributed[leaderIdx].map(c => (
                                                            <div key={c.id} className="border border-gray-300 w-[110px] text-center p-1.5 rounded-lg bg-white shadow-sm hover:border-blue-300 transition-colors">
                                                                <div className="font-bold text-[10.5px] text-gray-800">{c.name}</div>
                                                                <div className="text-[9px] text-gray-400 mt-0.5">{c.role || '기사'}</div>
                                                                <div className="text-[9.5px] text-blue-600 font-extrabold mt-1">{c.phone}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </main>
    );
}

export { ContactManagement };