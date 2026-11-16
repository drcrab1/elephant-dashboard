import React from 'react';
import { ADMIN_EMAIL } from './firebase';
import { Icons } from './icons';

// 앱의 틀: 왼쪽 메뉴(사이드바), 폰 상단 바, 폰 하단 탭

// 메뉴를 쓰임새별 묶음으로 보여줍니다. (id는 화면 이름 — 바꾸면 App.jsx의 화면 연결도 같이 바꿔야 합니다)
const menuGroupsFor = (isAdmin) => [
    {
        label: '오늘',
        items: [
            { id: '대시보드', label: '홈', icon: <Icons.Home /> },
            { id: '스케줄관리', icon: <Icons.Schedule /> },
            { id: '업무내역입력', icon: <Icons.Clipboard /> },
            { id: '안전보건관리', icon: <Icons.Safety /> },
        ],
    },
    {
        label: isAdmin ? '계약·서류' : '내 서류',
        items: [
            { id: '계약관리', icon: <Icons.Contract /> },
            { id: '서류관리', icon: <Icons.Folder /> },
            { id: '차량관리', icon: <Icons.Truck /> },
            { id: '개인정보 서약·교육', icon: <Icons.Lock /> },
        ],
    },
    {
        label: '회사',
        items: [
            { id: '공지사항', icon: <Icons.Megaphone /> },
            { id: '비상연락망', icon: <Icons.Phone /> },
            { id: '노선관리', icon: <Icons.Map /> },
        ],
    },
    ...(isAdmin ? [{
        label: '관리 (대표님 전용)',
        items: [
            { id: '회원관리', icon: <Icons.Users /> },
            { id: '알림관리', icon: <Icons.Bell /> },
            { id: '배차변환기', icon: <Icons.Table /> },
            { id: '개인정보 관리', icon: <Icons.Lock /> },
        ],
    }] : []),
];

const Badge = ({ value }) => (value ? (
    <span className="ml-auto shrink-0 min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-500 text-white text-[12px] font-extrabold flex items-center justify-center">{value}</span>
) : null);

export const Sidebar = ({ activePage, setActivePage, user, onLogout, onWithdraw, isSidebarOpen, setIsSidebarOpen, badges = {} }) => {
    const isAdmin = user && user.email === ADMIN_EMAIL;
    const groups = menuGroupsFor(isAdmin);
    const go = (page) => { setActivePage(page); setIsSidebarOpen(false); };
    return (
        <>
            {isSidebarOpen && (
                <div className="fixed inset-0 bg-black/50 z-40 md:hidden animate-fade-in" onClick={() => setIsSidebarOpen(false)} />
            )}
            <aside className={`w-[260px] h-screen bg-white border-r border-gray-100 fixed left-0 top-0 z-50 flex flex-col transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 shadow-xl md:shadow-none`}>
                <div className="px-5 py-4 flex items-center justify-between">
                    <button type="button" className="flex items-center gap-3" onClick={() => go('대시보드')}>
                        <img src="/logo.png" alt="" className="w-9 h-9 rounded-lg object-cover" />
                        <span className="text-[19px] font-extrabold text-ink tracking-tight">코끼리물류</span>
                    </button>
                    <button type="button" onClick={() => setIsSidebarOpen(false)} className="md:hidden w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600" aria-label="메뉴 닫기">
                        <Icons.X />
                    </button>
                </div>

                <nav className="flex-1 px-3 pb-3 overflow-y-auto" aria-label="전체 메뉴">
                    {groups.map((group) => (
                        <div key={group.label} className="mt-3 first:mt-1">
                            <p className="px-3 mb-1 text-[12px] font-extrabold text-gray-400 tracking-wide">{group.label}</p>
                            <div className="flex flex-col gap-0.5">
                                {group.items.map((m) => {
                                    const active = activePage === m.id;
                                    return (
                                        <button
                                            key={m.id}
                                            type="button"
                                            onClick={() => go(m.id)}
                                            aria-current={active ? 'page' : undefined}
                                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] text-left transition-colors ${active ? 'bg-brand-soft text-brand-dark font-extrabold' : 'text-gray-600 font-semibold hover:bg-gray-50 hover:text-gray-900'}`}
                                        >
                                            <span className={`shrink-0 ${active ? 'text-brand-dark' : 'text-gray-400'}`}>{m.icon}</span>
                                            <span className="truncate">{m.label || m.id}</span>
                                            <Badge value={badges[m.id]} />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                <div className="p-3 border-t border-gray-100">
                    <div className="flex items-center gap-3 px-2 py-2">
                        <span className="shrink-0 w-9 h-9 rounded-full bg-brand-soft text-brand-dark flex items-center justify-center text-[15px] font-extrabold">{(user.name || '?').slice(0, 1)}</span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-extrabold text-ink">{user.name}</span>
                            <span className="block text-[12px] font-bold text-gray-400">{isAdmin ? '관리자' : '기사님'}</span>
                        </span>
                        <button type="button" onClick={() => { onLogout(); setIsSidebarOpen(false); }} className="shrink-0 px-3 py-2 rounded-lg bg-gray-50 hover:bg-red-50 text-red-600 text-[13px] font-bold transition-colors">로그아웃</button>
                    </div>
                    <div className="flex items-center justify-between px-2 pt-1">
                        <button type="button" onClick={() => go('개인정보 처리방침')} className={`py-1.5 text-[12px] font-bold transition-colors ${activePage === '개인정보 처리방침' ? 'text-brand-dark' : 'text-gray-400 hover:text-gray-600'}`}>개인정보 처리방침</button>
                        {onWithdraw && (
                            <button type="button" onClick={() => { onWithdraw(); setIsSidebarOpen(false); }} className="py-1.5 text-[12px] font-bold text-gray-300 hover:text-red-500 transition-colors">회원탈퇴</button>
                        )}
                    </div>
                </div>
            </aside>
        </>
    );
};

export const MobileTopBar = ({ setActivePage, onOpenMenu }) => (
    <div className="md:hidden fixed top-0 left-0 right-0 h-[60px] bg-white/95 backdrop-blur border-b border-gray-100 flex items-center justify-between px-4 z-40">
        <button type="button" className="flex items-center gap-2" onClick={() => setActivePage('대시보드')}>
            <img src="/logo.png" alt="" className="w-8 h-8 rounded-lg object-cover" />
            <span className="text-[17px] font-extrabold text-ink tracking-tight">코끼리물류</span>
        </button>
        <button type="button" onClick={onOpenMenu} className="w-11 h-11 flex items-center justify-center rounded-xl bg-gray-50 text-gray-600" aria-label="전체 메뉴 열기">
            <Icons.Menu />
        </button>
    </div>
);

// 폰 하단 탭: 매일 쓰는 것 4개 + 전체 메뉴
export const BottomNav = ({ activePage, setActivePage, user, onOpenMenu, badges = {} }) => {
    const isAdmin = user && user.email === ADMIN_EMAIL;
    const items = isAdmin
        ? [
            { id: '대시보드', label: '홈', icon: <Icons.Home /> },
            { id: '안전보건관리', label: '점검', icon: <Icons.Safety /> },
            { id: '스케줄관리', label: '스케줄', icon: <Icons.Schedule /> },
            { id: '계약관리', label: '계약', icon: <Icons.Contract /> },
        ]
        : [
            { id: '대시보드', label: '홈', icon: <Icons.Home /> },
            { id: '안전보건관리', label: '점검', icon: <Icons.Safety /> },
            { id: '업무내역입력', label: '업무내역', icon: <Icons.Clipboard /> },
            { id: '서류관리', label: '서류', icon: <Icons.Folder /> },
        ];
    const inTabs = items.some((i) => i.id === activePage);
    const tab = (key, label, icon, active, onClick, badge) => (
        <button key={key} type="button" onClick={onClick} aria-current={active ? 'page' : undefined} className={`relative flex-1 h-full flex flex-col items-center justify-center gap-1 transition-colors ${active ? 'text-brand' : 'text-gray-400'}`}>
            {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-b-full bg-brand" />}
            <span className="relative">
                {icon}
                {badge ? <span className="absolute -top-1.5 -right-2.5 min-w-[17px] h-[17px] px-1 rounded-full bg-red-500 text-white text-[12px] font-extrabold flex items-center justify-center">{badge}</span> : null}
            </span>
            <span className={`text-[12px] ${active ? 'font-extrabold' : 'font-bold'}`}>{label}</span>
        </button>
    );
    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[66px] bg-white/95 backdrop-blur border-t border-gray-100 flex items-stretch px-1 z-40 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]" aria-label="주요 메뉴">
            {items.map((item) => tab(item.id, item.label, item.icon, activePage === item.id, () => setActivePage(item.id), badges[item.id]))}
            {tab('__all', '전체', <Icons.Menu width="20" height="20" />, !inTabs, onOpenMenu)}
        </nav>
    );
};

// 아직 화면이 준비되지 않은 메뉴를 눌렀을 때 보여주는 안내
export const PageView = ({ title }) => (
    <main className="md:ml-[260px] ml-0 px-4 md:px-10 py-6 md:py-12 flex-1 relative animate-fade-in">
        <header className="mb-[40px] border-b border-gray-100 pb-6 w-full max-w-[1200px]"><h2 className="text-[24px] md:text-[28px] tracking-tight font-extrabold text-ink mb-2">{title}</h2></header>
        <div className="max-w-[1200px] h-[400px] bg-white rounded-2xl p-10 border border-gray-100/80 shadow-sm flex flex-col items-center justify-center text-center">
            <h3 className="text-[22px] font-bold text-gray-900 mb-3">{title} 준비 중</h3>
            <p className="text-[16px] text-gray-500">실제 데이터 연동 후 개발될 예정입니다.</p>
        </div>
    </main>
);
