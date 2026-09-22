import React, { useState, useEffect, Suspense, lazy } from 'react';
import { auth, db, ADMIN_EMAIL } from './firebase';
import { PageView, DashboardHome, Sidebar, BottomNav, Icons } from './ui-components';
import { LoginScreen } from './auth';
import { NotificationPermissionPrompt } from './notifications';
import {
    INITIAL_CONTRACTS,
    INITIAL_CONTACTS,
    INITIAL_VEHICLE_DOCS,
    INITIAL_WORK_RECORDS,
    INITIAL_SAFETY_RECORDS,
    INITIAL_ROUTES,
} from './initial-data';

// 각 관리 화면은 실제로 그 메뉴로 이동할 때만 불러오도록(code-splitting) 지연 로딩합니다.
// (특히 안전보건관리 화면은 코드량이 많고 jsPDF/html-to-image 등 무거운 라이브러리를
//  함께 사용하므로, 초기 로딩 속도에 미치는 영향이 큽니다.)
const ContractManagement = lazy(() => import('./contracts').then(m => ({ default: m.ContractManagement })));
const ScheduleManagement = lazy(() => import('./schedule').then(m => ({ default: m.ScheduleManagement })));
const SafetyManagement = lazy(() => import('./safety').then(m => ({ default: m.SafetyManagement })));
const ContactManagement = lazy(() => import('./contacts').then(m => ({ default: m.ContactManagement })));
const VehicleDocumentManagement = lazy(() => import('./vehicles').then(m => ({ default: m.VehicleDocumentManagement })));
const WorkRecordManagement = lazy(() => import('./work-records').then(m => ({ default: m.WorkRecordManagement })));
const RouteManagement = lazy(() => import('./routes').then(m => ({ default: m.RouteManagement })));
const MemberManagement = lazy(() => import('./members').then(m => ({ default: m.MemberManagement })));
const NotificationManagement = lazy(() => import('./notifications').then(m => ({ default: m.NotificationManagement })));

const App = () => {
    const [user, setUser] = useState(null);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [activePage, setActivePageState] = useState('대시보드');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // 페이지 전환마다 브라우저(폰) 히스토리에 기록을 남겨서,
    // 뒤로가기를 눌렀을 때 앱 밖으로 나가지 않고 이전 화면으로 돌아가도록 합니다.
    const setActivePage = (page) => {
        if (page === activePage) return;
        window.history.pushState({ page }, '', '');
        setActivePageState(page);
    };

    useEffect(() => {
        window.history.replaceState({ page: activePage }, '', '');
        const onPopState = (e) => {
            setActivePageState((e.state && e.state.page) || '대시보드');
        };
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [contracts, setContracts] = useState([]);
    const [safetyRecords, setSafetyRecords] = useState([]);
    const [appContacts, setAppContacts] = useState([]);
    const [vehicleDocs, setVehicleDocs] = useState([]);
    const [workRecords, setWorkRecords] = useState([]);
    const [routes, setRoutes] = useState([]);

    // Firebase Authentication 리스너
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
            if (firebaseUser) {
                const docSnap = await db.collection('users').doc(firebaseUser.email).get();
                let finalName = firebaseUser.displayName || firebaseUser.email.split('@')[0];
                let finalPhone = '';

                if (docSnap.exists) {
                    finalName = docSnap.data().name;
                    finalPhone = docSnap.data().phone || '';
                } else if (firebaseUser.email === ADMIN_EMAIL) {
                    finalName = '대표님 (관리자)';
                }

                // [기능 추가] 로그인 시 비상연락망 자동 등록 및 전화번호 동기화
                try {
                    const contactQuery = await db.collection('contacts').where('email', '==', firebaseUser.email).get();
                    if (contactQuery.empty) {
                        await db.collection('contacts').add({
                            name: finalName,
                            email: firebaseUser.email,
                            phone: finalPhone || '',
                            role: firebaseUser.email === ADMIN_EMAIL ? '대표' : '배송기사',
                            tag: '신규가입',
                            type: 'internal'
                        });
                    } else {
                        const cDoc = contactQuery.docs[0];
                        if ((!cDoc.data().phone || cDoc.data().phone === '') && finalPhone) {
                            await db.collection('contacts').doc(cDoc.id).update({ phone: finalPhone });
                        }
                    }
                } catch (e) {
                    console.error('비상연락망 자동 등록 오류: ', e);
                }

                setUser({ email: firebaseUser.email, name: finalName, phone: finalPhone });
            } else {
                setUser(null);
            }
            setIsAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // DB Realtime Subscriptions
    useEffect(() => {
        if (!user) return;
        const unsubs = [];

        unsubs.push(db.collection('contacts').onSnapshot(snap => setAppContacts(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
        unsubs.push(db.collection('workRecords').onSnapshot(snap => setWorkRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
        unsubs.push(db.collection('vehicleDocs').onSnapshot(snap => setVehicleDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
        unsubs.push(db.collection('contracts').onSnapshot(snap => setContracts(snap.docs.map(d => ({ id: d.id, ...d.data() })))));
        unsubs.push(db.collection('safetyRecords').onSnapshot(snap => setSafetyRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.id.localeCompare(a.id)))));
        unsubs.push(db.collection('routes').onSnapshot(snap => setRoutes(snap.docs.map(d => ({ id: d.id, ...d.data() })))));

        // Seed initial data if DB is completely empty (Admin only)
        if (user.email === ADMIN_EMAIL) {
            db.collection('contracts').get().then(snap => {
                if (snap.empty) {
                    INITIAL_CONTRACTS.forEach(c => db.collection('contracts').doc(c.id).set(c));
                    INITIAL_CONTACTS.forEach(c => db.collection('contacts').doc(c.id).set(c));
                    INITIAL_VEHICLE_DOCS.forEach(c => db.collection('vehicleDocs').doc(c.id).set(c));
                    INITIAL_WORK_RECORDS.forEach(c => db.collection('workRecords').doc(c.id).set(c));
                    INITIAL_SAFETY_RECORDS.forEach(c => db.collection('safetyRecords').doc(c.id).set(c));
                    INITIAL_ROUTES.forEach(c => db.collection('routes').doc(c.id).set(c));
                }
            });
        }

        return () => unsubs.forEach(fn => fn());
    }, [user]);

    const handleLogout = () => {
        if (window.confirm('디바이스에서 로그아웃 하시겠습니까?')) auth.signOut();
    };

    const handleWithdraw = async () => {
        if (!user) return;
        const confirmMsg = `정말로 '${user.name}' 계정을 탈퇴하시겠습니까?\n\n※ 탈퇴 시 등록된 회원 계정 및 비상연락망 정보가 영구적으로 삭제되며 즉시 로그아웃됩니다.`;
        if (!window.confirm(confirmMsg)) return;

        try {
            // Delete user doc from Firestore
            await db.collection('users').doc(user.email).delete();
            // Delete contact entries from Firestore
            const contactQuery = await db.collection('contacts').where('email', '==', user.email).get();
            contactQuery.forEach(async (d) => {
                await db.collection('contacts').doc(d.id).delete();
            });
            alert('회원탈퇴 처리가 정상 완료되었습니다. 그동안 이용해 주셔서 감사합니다.');
            auth.signOut();
        } catch (e) {
            console.error('회원탈퇴 처리 에러:', e);
            alert('회원탈퇴 실패: ' + e.message);
        }
    };

    if (isAuthLoading) {
        return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-bold text-gray-500">인증 정보를 확인 중입니다...</div>;
    }

    if (!user) return <LoginScreen onLogin={setUser} />;

    // [성능/버그 수정] 기존에는 매 렌더링마다 () => <X/> 형태로 컴포넌트를 새로 "생성"해서
    // <Content/>로 렌더링했습니다. 이러면 React 입장에서는 매번 다른 컴포넌트 타입으로 보여서,
    // Firestore 실시간 구독이 다른 데이터를 갱신할 때마다(activePage와 무관하게) 현재 화면
    // 전체가 리마운트되어 입력 중이던 폼 상태 등이 초기화될 수 있었습니다.
    // 컴포넌트를 새로 만드는 대신 실제 엘리먼트를 바로 계산해서 렌더링하도록 수정했습니다.
    let content = <PageView title={activePage} />;
    if (activePage === '대시보드') content = <DashboardHome setActivePage={setActivePage} user={user} contracts={contracts} vehicleDocs={vehicleDocs} contacts={appContacts} safetyRecords={safetyRecords} />;
    if (activePage === '계약관리') content = <ContractManagement user={user} contracts={contracts} setContracts={setContracts} contacts={appContacts} />;
    if (activePage === '스케줄관리') content = <ScheduleManagement user={user} />;
    if (activePage === '안전보건관리') content = <SafetyManagement user={user} records={safetyRecords} setRecords={setSafetyRecords} />;
    if (activePage === '비상연락망') content = <ContactManagement user={user} contacts={appContacts} setContacts={setAppContacts} />;
    if (activePage === '차량/서류관리') content = <VehicleDocumentManagement user={user} docs={vehicleDocs} setDocs={setVehicleDocs} contacts={appContacts} />;
    if (activePage === '업무내역입력') content = <WorkRecordManagement user={user} records={workRecords} setRecords={setWorkRecords} />;
    if (activePage === '노선관리') content = <RouteManagement user={user} appRoutes={routes} setAppRoutes={setRoutes} />;
    if (activePage === '회원관리') content = <MemberManagement user={user} />;
    if (activePage === '알림관리') content = <NotificationManagement user={user} />;

    return (
        <div className="min-h-screen bg-[#F8FAFC] relative overflow-x-hidden font-sans text-[#1E293B]">
            {/* Mobile Top Bar */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-[60px] bg-white border-b border-gray-100 flex items-center justify-between px-5 z-40 shadow-sm">
                <div className="flex items-center gap-2" onClick={() => { setActivePage('대시보드'); setIsSidebarOpen(false); }}>
                    <div className="text-blue-600 scale-75 transform"><Icons.Logo /></div>
                    <span className="text-[17px] font-extrabold text-[#0F172A] tracking-tight">코끼리물류</span>
                </div>
                <button onClick={() => setIsSidebarOpen(true)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 text-gray-600">
                    <Icons.Menu />
                </button>
            </div>

            <div className="flex w-full max-w-full overflow-x-hidden min-h-screen pt-[60px] md:pt-0 pb-[70px] md:pb-0">
                <Sidebar 
                    activePage={activePage} 
                    setActivePage={setActivePage} 
                    user={user} 
                    onLogout={handleLogout} 
                    onWithdraw={handleWithdraw} 
                    isSidebarOpen={isSidebarOpen} 
                    setIsSidebarOpen={setIsSidebarOpen} 
                />
                <Suspense fallback={<div className="flex-1 flex items-center justify-center py-20 text-gray-400 font-bold">불러오는 중...</div>}>
                    {content}
                </Suspense>
            </div>

            <BottomNav activePage={activePage} setActivePage={setActivePage} />
            <NotificationPermissionPrompt user={user} />
        </div>
    );
};

export default App;