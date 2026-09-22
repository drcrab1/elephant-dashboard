import React, { useState, useEffect } from 'react';
import { db, ADMIN_EMAIL } from './firebase';
import { Icons } from './ui-components';

// --- Member Management (가입자 전체 조회, 관리자 전용) ---
const MemberManagement = ({ user }) => {
    const isAdmin = user && user.email === ADMIN_EMAIL;
    const [members, setMembers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [processingEmail, setProcessingEmail] = useState(null);
    const [editingEmail, setEditingEmail] = useState(null);
    const [editingName, setEditingName] = useState('');
    const [savingName, setSavingName] = useState(false);

    useEffect(() => {
        if (!isAdmin) return;
        const unsubscribe = db.collection('users').onSnapshot(snap => {
            const list = snap.docs.map(d => ({ email: d.id, ...d.data() }));
            list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            setMembers(list);
            setIsLoading(false);
        }, (e) => {
            console.error(e);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [isAdmin]);

    if (!isAdmin) {
        return (
            <main className="md:ml-[260px] ml-0 px-4 md:px-10 py-6 md:py-12 flex-1 relative bg-[#F4F7FB] min-h-[100vh] flex items-center justify-center">
                <p className="text-gray-400 font-bold">이 화면은 관리자 전용입니다.</p>
            </main>
        );
    }

    const formatDate = (iso) => {
        if (!iso) return '-';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '-';
        return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    };

    const filteredMembers = members.filter(m =>
        !searchQuery.trim() ||
        (m.name || '').includes(searchQuery.trim()) ||
        (m.email || '').includes(searchQuery.trim()) ||
        (m.phone || '').includes(searchQuery.trim())
    );

    const adminCount = members.filter(m => m.role === 'admin' || m.email === ADMIN_EMAIL).length;
    const isRecent = (iso) => {
        if (!iso) return false;
        const d = new Date(iso);
        if (isNaN(d.getTime())) return false;
        return (Date.now() - d.getTime()) < 7 * 24 * 60 * 60 * 1000;
    };
    const recentCount = members.filter(m => isRecent(m.createdAt)).length;

    const startEditName = (member) => {
        setEditingEmail(member.email);
        setEditingName(member.name || '');
    };

    const cancelEditName = () => {
        setEditingEmail(null);
        setEditingName('');
    };

    const saveName = async (member) => {
        const newName = editingName.trim();
        if (!newName) return alert('이름을 입력해주세요.');
        setSavingName(true);
        try {
            await db.collection('users').doc(member.email).set({ name: newName }, { merge: true });
            const contactQuery = await db.collection('contacts').where('email', '==', member.email).get();
            await Promise.all(contactQuery.docs.map(d => db.collection('contacts').doc(d.id).update({ name: newName })));
            setEditingEmail(null);
            setEditingName('');
        } catch (e) {
            alert('이름 수정 실패: ' + e.message);
        } finally {
            setSavingName(false);
        }
    };

    const forceWithdrawMember = async (member) => {
        if (member.email === ADMIN_EMAIL) return;
        const confirmMsg = `정말로 '${member.name || member.email}'님을 탈퇴시키겠습니까?\n\n※ 등록된 회원 정보와 비상연락망 데이터가 영구적으로 삭제됩니다.\n※ 구글 계정 자체는 남아있어서, 다시 로그인하면 신규 가입자로 다시 나타날 수 있어요.`;
        if (!window.confirm(confirmMsg)) return;
        setProcessingEmail(member.email);
        try {
            await db.collection('users').doc(member.email).delete();
            const contactQuery = await db.collection('contacts').where('email', '==', member.email).get();
            await Promise.all(contactQuery.docs.map(d => db.collection('contacts').doc(d.id).delete()));
            alert(`'${member.name || member.email}'님을 탈퇴 처리했습니다.`);
        } catch (e) {
            alert('탈퇴 처리 실패: ' + e.message);
        } finally {
            setProcessingEmail(null);
        }
    };

    return (
        <main className="md:ml-[260px] ml-0 px-4 md:px-10 py-6 md:py-12 flex-1 relative bg-[#F4F7FB] min-h-[100vh]">
            <header className="mb-8 w-full flex flex-col md:flex-row justify-between md:items-end border-b pb-6 border-gray-200 gap-4">
                <div>
                    <h2 className="text-[28px] font-extrabold mb-2 text-[#1E293B] flex items-center gap-2"><Icons.Users /> 회원 관리</h2>
                    <p className="text-gray-500 text-[15px] font-medium">가입된 전체 회원 목록입니다. (관리자 전용)</p>
                </div>
                <div className="relative w-full md:w-[280px]">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"><Icons.Search /></span>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="이름, 이메일, 전화번호 검색"
                        className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium outline-none focus:border-blue-500 shadow-sm"
                    />
                </div>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 max-w-[1100px]">
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                    <p className="text-[13px] text-gray-400 font-bold mb-1">총 가입자</p>
                    <p className="text-[26px] font-extrabold text-[#0F172A]">{members.length}<span className="text-[15px] font-bold text-gray-400 ml-1">명</span></p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                    <p className="text-[13px] text-gray-400 font-bold mb-1">관리자</p>
                    <p className="text-[26px] font-extrabold text-[#0F172A]">{adminCount}<span className="text-[15px] font-bold text-gray-400 ml-1">명</span></p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                    <p className="text-[13px] text-gray-400 font-bold mb-1">기사님</p>
                    <p className="text-[26px] font-extrabold text-[#0F172A]">{members.length - adminCount}<span className="text-[15px] font-bold text-gray-400 ml-1">명</span></p>
                </div>
                <div className="bg-white rounded-2xl border border-amber-100 bg-amber-50/40 p-5 shadow-sm">
                    <p className="text-[13px] text-amber-600 font-bold mb-1">최근 7일 신규가입</p>
                    <p className="text-[26px] font-extrabold text-amber-700">{recentCount}<span className="text-[15px] font-bold text-amber-500 ml-1">명</span></p>
                </div>
            </div>

            <div className="scroll-container bg-white rounded-[20px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-gray-100">
                <table className="min-w-[700px] w-full divide-y divide-gray-200 text-left">
                    <thead className="bg-[#f8fafc]">
                        <tr>
                            <th className="px-6 py-4 text-[14px] font-bold text-gray-500">이름</th>
                            <th className="px-6 py-4 text-[14px] font-bold text-gray-500">이메일</th>
                            <th className="px-6 py-4 text-[14px] font-bold text-gray-500">전화번호</th>
                            <th className="px-6 py-4 text-[14px] font-bold text-gray-500">역할</th>
                            <th className="px-6 py-4 text-[14px] font-bold text-gray-500">가입일</th>
                            <th className="px-6 py-4 text-[14px] font-bold text-gray-500 text-center">관리</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100/80">
                        {isLoading ? (
                            <tr><td colSpan={6} className="py-16 text-center text-gray-400 font-bold">불러오는 중...</td></tr>
                        ) : filteredMembers.length === 0 ? (
                            <tr><td colSpan={6} className="py-16 text-center text-gray-400 font-bold">{searchQuery ? '검색 결과가 없습니다.' : '가입된 회원이 없습니다.'}</td></tr>
                        ) : filteredMembers.map(m => (
                            <tr key={m.email} className="hover:bg-blue-50/20 transition-colors">
                                <td className="px-6 py-4 font-bold text-[15px] text-gray-900">
                                    {editingEmail === m.email ? (
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="text"
                                                value={editingName}
                                                onChange={e => setEditingName(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') saveName(m); if (e.key === 'Escape') cancelEditName(); }}
                                                autoFocus
                                                className="border border-blue-300 rounded-lg px-2 py-1 text-[14px] font-bold w-[110px] outline-none focus:border-blue-500"
                                            />
                                            <button onClick={() => saveName(m)} disabled={savingName} className="text-blue-600 hover:text-blue-800 text-[12px] font-extrabold disabled:opacity-50">저장</button>
                                            <button onClick={cancelEditName} className="text-gray-400 hover:text-gray-600 text-[12px] font-bold">취소</button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5">
                                            <span>{m.name || '-'}</span>
                                            <button onClick={() => startEditName(m)} className="text-gray-300 hover:text-blue-600 transition-colors" title="이름 수정">
                                                <Icons.Edit2 />
                                            </button>
                                            {isRecent(m.createdAt) && (
                                                <span className="bg-amber-100 text-amber-700 text-[9.5px] font-extrabold px-1.5 py-0.5 rounded">NEW</span>
                                            )}
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-[13.5px] font-medium text-gray-600">{m.email}</td>
                                <td className="px-6 py-4 text-[14px] font-bold text-gray-700">{m.phone || '-'}</td>
                                <td className="px-6 py-4">
                                    {m.role === 'admin' || m.email === ADMIN_EMAIL ? (
                                        <span className="px-2.5 py-1 text-[12.5px] font-extrabold rounded-lg bg-blue-100 text-blue-700 border border-blue-200">관리자</span>
                                    ) : (
                                        <span className="px-2.5 py-1 text-[12.5px] font-extrabold rounded-lg bg-gray-100 text-gray-600 border border-gray-200">기사님</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-[13.5px] font-medium text-gray-500">{formatDate(m.createdAt)}</td>
                                <td className="px-6 py-4 text-center">
                                    {m.email === ADMIN_EMAIL ? (
                                        <span className="text-gray-300 text-xs font-bold">-</span>
                                    ) : (
                                        <button
                                            onClick={() => forceWithdrawMember(m)}
                                            disabled={processingEmail === m.email}
                                            className="bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 rounded-lg px-3 py-1.5 text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
                                        >
                                            {processingEmail === m.email ? '처리 중...' : '탈퇴시키기'}
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </main>
    );
};

export { MemberManagement };
