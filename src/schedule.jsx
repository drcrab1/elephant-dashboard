import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { Icons } from './ui-components';

const ADMIN_EMAIL = 's01025144826@gmail.com';

// --- Schedule Management (Google Sheets Sync View) ---
// 기본값 (관리자가 아래 '노선 이름 관리'에서 언제든 직접 수정 가능 — Firestore settings/schedule.routeColumns 에 저장됨)
const DEFAULT_ROUTE_COLUMNS = ['503AB', '503CD', '402CD', '001CD', '901CD', '452ABCD', '454ABD', '452D+454B', '303CD'];
const colLetter = (i) => String.fromCharCode(65 + 3 + i); // D열부터 시작

// 시트 연동 전 기본 더미 데이터
const MOCK_SCHEDULE_DATA = [
    { csvDate: '3월31일', route: '503AB', driver: '홍명보(모의)' },
    { csvDate: '4월1일', route: '001CD', driver: '박지성(모의)' },
    { csvDate: '4월1일', route: '454ABD', driver: '이영표(모의)' },
    { csvDate: '4월2일', route: '901CD', driver: '손흥민(모의)' },
];

const getLocalDateString = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const date = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${date}`;
    };

    const ScheduleManagement = ({ user }) => {
    const getStartOfCurrentWeek = () => {
        const today = new Date();
        const day = today.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
        const daysSinceSaturday = (day + 1) % 7; // 토요일 기준 주 시작
        const saturday = new Date(today);
        saturday.setDate(today.getDate() - daysSinceSaturday);
        saturday.setHours(0, 0, 0, 0);
        return saturday;
    };

    const getTodayIsoString = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const date = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${date}`;
    };

    const [startOfWeek, setStartOfWeek] = useState(getStartOfCurrentWeek());
    const [scheduleData, setScheduleData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [csvUrl, setCsvUrl] = useState('');
    const [isEditingUrl, setIsEditingUrl] = useState(false);
    const [tempUrl, setTempUrl] = useState('');
    const [routeColumns, setRouteColumns] = useState(DEFAULT_ROUTE_COLUMNS);
    const [isEditingRoutes, setIsEditingRoutes] = useState(false);
    const [tempRoutes, setTempRoutes] = useState(DEFAULT_ROUTE_COLUMNS);

    const isAdmin = user && user.email === ADMIN_EMAIL;

    useEffect(() => {
        db.collection('settings').doc('schedule').get().then(doc => {
            if (doc.exists && doc.data().csvUrl) {
                setCsvUrl(doc.data().csvUrl);
                setTempUrl(doc.data().csvUrl);
            }
            if (doc.exists && Array.isArray(doc.data().routeColumns) && doc.data().routeColumns.length > 0) {
                setRouteColumns(doc.data().routeColumns);
                setTempRoutes(doc.data().routeColumns);
            }
        });
    }, []);

    useEffect(() => {
        if (!csvUrl) {
            setScheduleData(MOCK_SCHEDULE_DATA);
            return;
        }
        setIsLoading(true);
        fetch(csvUrl)
            .then(res => res.text())
            .then(csv => {
                const rows = csv.split('\n');
                let newSchedule = [];

                rows.forEach(r => {
                    const cols = r.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                    if (cols.length < 12) return;
                    if (cols[0].replace(/\s+/g, '') === '출근일') return; // 헤더 무시

                    const rawDate = cols[0].replace(/\s+/g, ''); // "1월1일"

                    routeColumns.forEach((route, i) => {
                        const driverName = cols[3 + i]; // D열(인덱스 3)부터 시작
                        if (driverName && driverName !== '') {
                            newSchedule.push({
                                csvDate: rawDate,
                                route: route,
                                driver: driverName
                            });
                        }
                    });
                });
                setScheduleData(newSchedule);
            })
            .catch(e => {
                console.error(e);
            })
            .finally(() => setIsLoading(false));
    }, [csvUrl, startOfWeek, routeColumns]);

    const handleSaveUrl = async () => {
        try {
            await db.collection('settings').doc('schedule').set({ csvUrl: tempUrl }, { merge: true });
            setCsvUrl(tempUrl);
            setIsEditingUrl(false);
            alert('구글 시트 연동 URL이 저장되었습니다.');
        } catch (e) { alert('URL 저장 실패: ' + e.message); }
    };

    const handleAddRouteColumn = () => setTempRoutes([...tempRoutes, '']);
    const handleRemoveRouteColumn = (idx) => setTempRoutes(tempRoutes.filter((_, i) => i !== idx));
    const handleRouteColumnChange = (idx, value) => setTempRoutes(tempRoutes.map((r, i) => i === idx ? value : r));

    const handleSaveRoutes = async () => {
        const cleaned = tempRoutes.map(r => r.trim()).filter(r => r !== '');
        if (cleaned.length === 0) return alert('노선을 최소 1개 이상 입력해주세요.');
        try {
            await db.collection('settings').doc('schedule').set({ routeColumns: cleaned }, { merge: true });
            setRouteColumns(cleaned);
            setTempRoutes(cleaned);
            setIsEditingRoutes(false);
            alert('노선 이름이 저장되었습니다.');
        } catch (e) { alert('노선 저장 실패: ' + e.message); }
    };

    const getWeekDates = () => Array.from({ length: 7 }, (_, i) => {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        return d;
    });

    const changeWeek = (direction) => {
        const newStart = new Date(startOfWeek);
        newStart.setDate(startOfWeek.getDate() + (direction * 7));
        setStartOfWeek(newStart);
    };

    const setThisWeek = () => setStartOfWeek(getStartOfCurrentWeek());

    const weekDates = getWeekDates();
    const endOfWeek = weekDates[6];
    const formatDateLong = (d) => `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
    const formatShortDate = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

    // 일주일(현재 화면 기준) 동안 고정 노선이 아닌 사람(노선이 2개 이상) 찾기
    const multiRouteDrivers = (() => {
        const driverRoutes = {};
        const targetDates = weekDates.map(d => `${d.getMonth() + 1}월${d.getDate()}일`);
        scheduleData.forEach(item => {
            if (targetDates.includes(item.csvDate) && item.driver) {
                const name = item.driver.trim();
                if (!name) return;
                if (!driverRoutes[name]) driverRoutes[name] = new Set();
                driverRoutes[name].add(item.route);
            }
        });
        const multi = new Set();
        for (const [driver, routes] of Object.entries(driverRoutes)) {
            if (routes.size > 1) multi.add(driver);
        }
        return multi;
    })();

    const getDriver = (dateObj, route) => {
        const targetDateStr = `${dateObj.getMonth() + 1}월${dateObj.getDate()}일`;
        const item = scheduleData.find(s => s.csvDate === targetDateStr && s.route === route);
        return item ? item.driver.trim() : '';
    };

    return (
        <main className="md:ml-[260px] ml-0 px-4 md:px-10 py-8 md:py-[60px] flex-1 min-w-0 w-full max-w-[100vw] md:max-w-[calc(100vw-260px)] overflow-x-hidden animate-fade-in bg-[#F8FAFC] min-h-screen font-sans">
            
            {/* 상단 타이틀 */}
            <div className="mb-8 w-full max-w-[1200px]">
                <h2 className="text-[28px] font-extrabold text-[#0F172A] mb-2 tracking-tight">배차 및 스케줄 관리</h2>
                <p className="text-[15px] text-gray-500 font-medium tracking-tight">기사님들의 일일 근무 노선 일정을 조회하고 동기화 상태를 확인합니다.</p>
            </div>

            {/* 캘린더 네비게이터 카드 */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] mb-8 w-full max-w-[1200px] flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-2 sm:gap-4 w-full md:w-auto">
                    <button onClick={() => changeWeek(-1)} className="shrink-0 w-11 h-11 border border-gray-100 rounded-2xl bg-white hover:bg-gray-50 text-gray-600 flex items-center justify-center shadow-sm hover:scale-105 active:scale-95 transition-all"><Icons.ChevronLeft /></button>
                    <div className="text-left min-w-0">
                        <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">선택된 일정 기간</span>
                        <h2 className="text-[16px] sm:text-[20px] md:text-[22px] font-extrabold text-[#0F172A] tracking-tight">
                            {formatDateLong(startOfWeek)} <span className="text-gray-300 font-normal">~</span> {formatDateLong(endOfWeek)}
                        </h2>
                    </div>
                    <button onClick={() => changeWeek(1)} className="shrink-0 w-11 h-11 border border-gray-100 rounded-2xl bg-white hover:bg-gray-50 text-gray-600 flex items-center justify-center shadow-sm hover:scale-105 active:scale-95 transition-all"><Icons.ChevronRight /></button>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button onClick={setThisWeek} className="px-5 py-2.5 rounded-2xl bg-blue-50 text-blue-600 hover:bg-blue-100 text-[14px] font-extrabold tracking-tight active:scale-95 transition-all">
                        이번 주로 이동
                    </button>
                    {isLoading && (
                        <div className="flex items-center gap-2 bg-blue-50 text-blue-600 py-2.5 px-4 rounded-2xl animate-pulse">
                            <span className="w-2 h-2 bg-blue-600 rounded-full animate-ping"></span>
                            <span className="text-sm font-bold">동기화 중...</span>
                        </div>
                    )}
                </div>
            </div>

            {/* 관리자 설정 영역 */}
            {isAdmin && (
                <div className="w-full max-w-[1200px] mb-8 p-6 bg-gradient-to-r from-blue-50/50 to-indigo-50/30 border border-blue-100 rounded-3xl shadow-sm flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-extrabold text-[#1E3A8A] flex items-center gap-2.5 text-[16px]"><Icons.Settings /> 구글 시트 배차표 연동 설정</h3>
                        <button onClick={() => setIsEditingUrl(!isEditingUrl)} className="shrink-0 whitespace-nowrap text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors">{isEditingUrl ? '수정 취소' : '연동 주소 변경'}</button>
                    </div>
                    {isEditingUrl ? (
                        <div className="flex flex-col sm:flex-row gap-3">
                            <input type="text" value={tempUrl} onChange={e => setTempUrl(e.target.value)} placeholder="구글 시트 '웹에 게시' (CSV 형태) URL을 입력하세요" className="flex-1 px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-inner" />
                            <button onClick={handleSaveUrl} className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold whitespace-nowrap shadow-md active:scale-95 transition-all">저장 후 즉시 반영</button>
                        </div>
                    ) : (
                        <p className="text-[13.5px] text-gray-500 font-medium break-all bg-white/70 p-3.5 rounded-xl border border-gray-100/50">{csvUrl || "URL이 등록되지 않아 기본 시뮬레이션용 데이터가 노출됩니다."}</p>
                    )}
                </div>
            )}

            {/* 관리자 - 노선 이름 관리 (언제든 직접 수정 가능) */}
            {isAdmin && (
                <div className="w-full max-w-[1200px] mb-8 p-6 bg-white border border-gray-100 rounded-3xl shadow-sm flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h3 className="font-extrabold text-[#1E293B] flex items-center gap-2.5 text-[16px]"><Icons.Map /> 노선 이름 관리</h3>
                            <p className="text-[13px] text-gray-400 font-medium mt-1">표 맨 위에 표시되는 노선 이름이 바뀌면 여기서 직접 수정하세요. 코드 수정 없이 바로 반영됩니다.</p>
                        </div>
                        <button
                            onClick={() => { if (isEditingRoutes) { setTempRoutes(routeColumns); } setIsEditingRoutes(!isEditingRoutes); }}
                            className="shrink-0 whitespace-nowrap text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
                        >
                            {isEditingRoutes ? '수정 취소' : '노선 이름 수정'}
                        </button>
                    </div>
                    {isEditingRoutes ? (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {tempRoutes.map((route, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <span className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 text-gray-500 font-bold text-xs">{colLetter(idx)}열</span>
                                        <input
                                            type="text"
                                            value={route}
                                            onChange={e => handleRouteColumnChange(idx, e.target.value)}
                                            className="flex-1 min-w-0 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 focus:bg-white transition-all"
                                        />
                                        <button onClick={() => handleRemoveRouteColumn(idx)} className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                                            <Icons.X />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <button onClick={handleAddRouteColumn} className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold transition-colors">+ 노선 추가</button>
                                <button onClick={handleSaveRoutes} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md active:scale-95 transition-all">저장 후 즉시 반영</button>
                            </div>
                            <p className="text-xs text-gray-400 font-medium leading-relaxed">※ 순서가 구글 시트의 D열부터 순서와 정확히 같아야 합니다. 시트에 새 노선 열을 추가했다면 맨 아래 "+ 노선 추가"로 같은 순서에 맞춰 추가해주세요. 이름만 바뀐 경우는 순서를 그대로 두고 글자만 고치면 됩니다.</p>
                        </>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {routeColumns.map((route, idx) => (
                                <span key={idx} className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-[13px] font-bold text-gray-700">{route}</span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 메인 스케줄 테이블 */}
            <div className="scroll-container bg-white rounded-3xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
                    <table className="w-full text-center table-fixed min-w-[1000px] border-collapse">
                        <thead>
                            <tr className="bg-[#0F172A] text-white select-none border-b border-gray-800">
                                <th className="w-[90px] py-4.5 text-[13.5px] font-bold tracking-wider uppercase opacity-85">날짜</th>
                                <th className="w-[70px] py-4.5 text-[13.5px] font-bold tracking-wider uppercase opacity-85">요일</th>
                                {routeColumns.map((route) => (
                                    <th key={route} className="py-4.5 text-[13.5px] font-extrabold tracking-wider uppercase hover:bg-slate-800 transition-colors cursor-pointer">
                                        {route}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {weekDates.map((dateObj) => {
                                const isoStr = getLocalDateString(dateObj);
                                const dayName = dayNames[dateObj.getDay()];
                                const isSunday = dateObj.getDay() === 0;
                                const isSaturday = dateObj.getDay() === 6;
                                const isTodayHighlight = isoStr === getLocalDateString(new Date());

                                return (
                                    <tr key={isoStr} className={`transition-colors duration-200 ${isTodayHighlight ? 'bg-blue-50/40 relative border-l-4 border-blue-600' : 'hover:bg-gray-50/50'}`}>
                                        <td className="py-4.5 text-[14.5px] font-extrabold text-slate-800">
                                            <div className="flex flex-col items-center justify-center">
                                                {isTodayHighlight && <span className="bg-blue-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full mb-1 tracking-wider uppercase animate-bounce">오늘</span>}
                                                {formatShortDate(dateObj)}
                                            </div>
                                        </td>
                                        <td className={`py-4.5 text-[14.5px] font-bold ${isSunday ? 'text-red-500' : isSaturday ? 'text-blue-500' : 'text-slate-500'}`}>
                                            {dayName}
                                        </td>
                                        {routeColumns.map((route) => {
                                            const driver = getDriver(dateObj, route);

                                            let cellClass = 'py-4.5 text-[13.5px] font-bold transition-all duration-200 cursor-pointer';
                                            let cellContent = '-';

                                            if (driver) {
                                                cellContent = driver;
                                                if (driver.includes('+') || driver.includes(',') || driver.includes('&') || driver.includes('/') || driver.length > 3) {
                                                    // 다중 노선 지원 / 부수 배정 (퍼플)
                                                    cellClass += ' text-purple-700 bg-purple-50/70 hover:bg-purple-100/80 border border-purple-100 rounded-xl m-1 display-block font-extrabold';
                                                } else if (multiRouteDrivers.has(driver)) {
                                                    // 다른 노선에도 투입되는 멀티 드라이버 (오렌지)
                                                    cellClass += ' text-amber-700 bg-amber-50/60 hover:bg-amber-100/80 border border-amber-100 rounded-xl m-1 display-block font-extrabold';
                                                } else {
                                                    // 일반 노선 배정 (블루)
                                                    cellClass += ' text-blue-700 bg-blue-50/40 hover:bg-blue-100/50 border border-blue-50 rounded-xl m-1 display-block font-bold';
                                                }
                                            } else {
                                                cellClass += ' text-gray-300 hover:bg-gray-100/50';
                                            }

                                            return (
                                                <td
                                                    key={route}
                                                    onClick={() => {
                                                        if (csvUrl) alert(`스케줄 데이터 수정은 연동된 구글 스프레드시트 원본에서 진행해 주셔야 자동 반영됩니다!`);
                                                        else alert(`${formatShortDate(dateObj)}(${dayName}) ${route} 노선 배차 정보가 없습니다.`);
                                                    }}
                                                    className="p-1"
                                                >
                                                    <span className={cellClass}>
                                                        {cellContent}
                                                    </span>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
            </div>

            <div className="w-full max-w-[1200px] flex items-center justify-center gap-6 mt-8 p-5 bg-white border border-gray-100 rounded-2xl shadow-sm text-xs text-gray-500 font-medium">
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-blue-50 border border-blue-100 rounded-full inline-block"></span> 일반 배차</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-amber-50 border border-amber-100 rounded-full inline-block"></span> 타 노선 동시 투입 기사</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-purple-50 border border-purple-100 rounded-full inline-block"></span> 다중배정/대리배송 등 특이사항</div>
            </div>

        </main>
    );
};

export { ScheduleManagement };