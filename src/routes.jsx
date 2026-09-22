import React, { useState } from 'react';
import { db, storage } from './firebase';
import { Icons } from './ui-components';

export const RouteManagement = ({ user, appRoutes = [], setAppRoutes }) => {
    const [selectedRoute, setSelectedRoute] = useState(null);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newName, setNewName] = useState('');
    const [newCamp, setNewCamp] = useState('구리2캠프');
    
    // View mode editor states
    const [editTips, setEditTips] = useState('');
    const [editRouteName, setEditRouteName] = useState('');
    const [isEditingName, setIsEditingName] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Initial grouping for the list view
    const routesByCamp = (appRoutes || []).reduce((acc, r) => {
        const campKey = r.camp || '기타 미지정 노선';
        if (!acc[campKey]) acc[campKey] = [];
        acc[campKey].push(r);
        return acc;
    }, {});

    const handleCreateRoute = async () => {
        if (!newName.trim()) return alert('노선(라우트) 이름을 입력해주세요.');
        const id = `route_${Date.now()}`;
        const newRoute = {
            id,
            name: newName,
            camp: newCamp,
            tips: '',
            mapUrl: null,
            createdBy: user.name,
            updatedAt: new Date().toISOString()
        };
        try {
            await db.collection('routes').doc(id).set(newRoute);
            setIsAddOpen(false);
            setNewName('');
            alert('새로운 노선이 생성되었습니다!');
        } catch (error) {
            alert('에러 발생: ' + error.message);
        }
    };

    const handleOpenRoute = (r) => {
        setSelectedRoute(r);
        setEditTips(r.tips || '');
        setEditRouteName(r.name);
        setIsEditingName(false);
    };

    const handleSaveTips = async () => {
        if (!selectedRoute) return;
        try {
            await db.collection('routes').doc(selectedRoute.id).update({
                tips: editTips,
                updatedAt: new Date().toISOString(),
                lastUpdatedBy: user.name
            });
            alert('배송 꿀팁이 안전하게 저장되었습니다!');
            setSelectedRoute({ ...selectedRoute, tips: editTips });
        } catch (e) {
            alert('저장 실패: ' + e.message);
        }
    };

    const handleSaveRouteName = async () => {
        if (!selectedRoute || !editRouteName.trim()) return;
        try {
            await db.collection('routes').doc(selectedRoute.id).update({
                name: editRouteName.trim(),
                updatedAt: new Date().toISOString(),
                lastUpdatedBy: user.name
            });
            setSelectedRoute({ ...selectedRoute, name: editRouteName.trim() });
            setIsEditingName(false);
            alert('노선 이름이 성공적으로 변경되었습니다!');
        } catch (e) {
            alert('노선 이름 변경 실패: ' + e.message);
        }
    };

    const handleMapImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedRoute) return;
        
        setIsUploading(true);
        try {
            const fileRef = storage.ref(`routes/${selectedRoute.id}_map`);
            await fileRef.put(file);
            const url = await fileRef.getDownloadURL();
            
            await db.collection('routes').doc(selectedRoute.id).update({
                mapUrl: url,
                updatedAt: new Date().toISOString(),
                lastUpdatedBy: user.name
            });
            
            setSelectedRoute({ ...selectedRoute, mapUrl: url });
        } catch (error) {
            alert('지도 이미지 업로드에 실패했습니다: ' + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <main className="md:ml-[260px] ml-0 px-4 md:px-10 py-6 md:py-12 flex-1 relative bg-[#F4F7FB] min-h-[100vh] w-full max-w-[100vw] md:max-w-[calc(100vw-260px)] overflow-x-hidden">
            <header className="mb-8 w-full flex flex-col md:flex-row justify-between items-start md:items-end border-b pb-6 border-gray-200 gap-4">
                <div>
                    <h2 className="text-[28px] font-extrabold mb-2 text-[#1E293B]">노선(라우트) 관리 및 투입 꿀팁</h2>
                    <p className="text-gray-500 text-[15px] font-medium">캠프별, 구간별 하차/주차 꿀팁과 지도를 서로 공유하는 위키 공간입니다. 기사님 누구나 노선을 추가할 수 있습니다.</p>
                </div>
                <button onClick={() => setIsAddOpen(true)} className="flex items-center gap-2 bg-[#1BC271] hover:bg-green-600 text-white px-6 py-3.5 rounded-[12px] font-bold text-[15px] shadow-sm transition-transform hover:-translate-y-0.5 shrink-0">
                    <Icons.Plus /> 새 배송노선(라우트) 추가하기
                </button>
            </header>

            {/* Sub-view: Active Route Info */}
            {selectedRoute ? (
                <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden min-h-[600px] flex flex-col md:flex-row animate-fade-in relative">
                    <button onClick={() => setSelectedRoute(null)} className="absolute top-6 right-6 text-gray-400 hover:text-black font-extrabold text-2xl z-20">&times;</button>
                    
                    {/* Left Panel: MAP */}
                    <div className="w-full md:w-1/2 bg-gray-50 border-b md:border-b-0 md:border-r border-gray-200 flex flex-col relative min-h-[350px]">
                        <div className="p-6 border-b flex flex-wrap justify-between items-center bg-white z-10 gap-3">
                            <div>
                                <span className="inline-block bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded-lg text-[13px] mb-2">{selectedRoute.camp}</span>
                                {isEditingName ? (
                                    <div className="flex items-center gap-2 mt-1">
                                        <input type="text" value={editRouteName} onChange={e => setEditRouteName(e.target.value)} className="border-b-2 border-blue-500 font-extrabold text-2xl text-[#0F172A] focus:outline-none bg-transparent" autoFocus />
                                        <button onClick={handleSaveRouteName} className="px-3 py-1 bg-green-500 text-white text-sm font-bold rounded-lg hover:bg-green-600">저장</button>
                                        <button onClick={() => setIsEditingName(false)} className="px-3 py-1 bg-gray-200 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-300">취소</button>
                                    </div>
                                ) : (
                                    <h3 className="text-2xl font-extrabold text-[#0F172A] flex items-center gap-2 mt-1">
                                        {selectedRoute.name} 노선도
                                        <button onClick={() => setIsEditingName(true)} className="text-sm font-medium text-gray-400 hover:text-blue-500 flex items-center gap-1"><Icons.Edit2 /> 수정</button>
                                    </h3>
                                )}
                            </div>
                            <label className="cursor-pointer px-4 py-2 border-2 border-dashed border-blue-400 text-blue-600 rounded-xl font-bold bg-blue-50 hover:bg-blue-100 transition-colors text-xs md:text-sm">
                                {isUploading ? '업로드 중...' : '🗺️ 새로운 지도사진 올리기'}
                                <input type="file" accept="image/*" className="hidden" disabled={isUploading} onChange={handleMapImageUpload} />
                            </label>
                        </div>
                        <div className="flex-1 bg-gray-100 flex items-center justify-center p-6 relative overflow-hidden min-h-[300px]">
                            {selectedRoute.mapUrl ? (
                                <img src={selectedRoute.mapUrl} className="w-full h-full object-contain drop-shadow" alt="노선지도" />
                            ) : (
                                <div className="text-center text-gray-400 font-bold opacity-80 flex flex-col items-center gap-2 p-4">
                                    <Icons.Camera />
                                    <p className="text-xs md:text-sm">등록된 지도 이미지가 없습니다.<br/>우측 상단 <strong>[새로운 지도사진 올리기]</strong> 버튼을 눌러 사진을 첨부해주세요.</p>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Right Panel: TIPS EDITOR */}
                    <div className="w-full md:w-1/2 flex flex-col bg-white min-h-[350px]">
                        <div className="p-6 border-b">
                            <h3 className="text-[17px] font-extrabold flex items-center gap-2 text-gray-800"><Icons.Edit2 /> 현장 배송 요령 및 실전 꿀팁</h3>
                            <p className="text-gray-400 text-[13px] mt-1">※ 주차 공간 제보, 비밀번호, 특정 상가 엘리베이터 위치 등을 기재해주세요.</p>
                        </div>
                        <div className="flex-1 p-6 flex flex-col">
                            <textarea 
                                value={editTips} 
                                onChange={e => setEditTips(e.target.value)} 
                                placeholder="예) 푸르지오 아파트 진입 시 우측 2번째 게이트가 빠릅니다. 101동 공동현관 번호 *1234# 입니다."
                                className="flex-1 w-full bg-[#f8fafc] border border-gray-200 rounded-2xl p-6 text-[15px] text-gray-800 leading-relaxed font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none shadow-inner mb-4 min-h-[160px]"
                            />
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                <p className="text-[13px] text-gray-400 font-bold">마지막 수정: {selectedRoute.lastUpdatedBy ? `${selectedRoute.lastUpdatedBy} (${new Date(selectedRoute.updatedAt).toLocaleDateString()})` : '기록 없음'}</p>
                                <button onClick={handleSaveTips} className="w-full sm:w-auto px-8 py-3 bg-[#2E68ED] hover:bg-blue-700 text-white font-extrabold rounded-xl shadow-md transition-transform hover:-translate-y-0.5 text-sm">꿀팁 즉시 보존 (저장)</button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* Main Grid View */
                <div className="space-y-12">
                    {Object.keys(routesByCamp).length === 0 && (
                        <div className="py-24 text-center text-gray-400 font-bold">등록된 노선이 하나도 없습니다. 첫 번째 배송 노선을 등록해주세요!</div>
                    )}
                    
                    {Object.keys(routesByCamp).map(campName => (
                        <section key={campName} className="animate-fade-in">
                            <h3 className="text-xl font-extrabold text-gray-800 mb-6 flex items-center gap-2">
                                <span className="w-2 h-6 bg-blue-600 rounded"></span> {campName} 그룹
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {routesByCamp[campName].map(r => (
                                    <div key={r.id} onClick={() => handleOpenRoute(r)} className="group bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -z-0 opacity-50 group-hover:scale-110 transition-transform"></div>
                                        <div className="relative z-10 flex flex-col h-full">
                                            <div className="flex justify-between items-start mb-4">
                                                <h4 className="text-[18px] font-extrabold text-[#0F172A]">{r.name}</h4>
                                                {r.mapUrl ? <span className="text-xl">🗺️</span> : <span className="text-xl grayscale opacity-30">🗺️</span>}
                                            </div>
                                            <p className="text-[14px] text-gray-500 font-medium mb-6 line-clamp-3">
                                                {r.tips ? r.tips : '아직 등록된 꿀팁/비밀번호가 없습니다. 이 노선을 눌러 요령을 남겨주세요.'}
                                            </p>
                                            <div className="mt-auto border-t pt-4 text-[12px] font-bold text-gray-400 flex justify-between items-center">
                                                <span>생성자: {r.createdBy}</span>
                                                <span className="bg-gray-100 px-2 py-1 rounded-md text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">열람 및 팁 쓰기 &rarr;</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            )}

            {/* ADD MODAL */}
            {isAddOpen && (
                <div className="fixed inset-0 z-50 bg-[#0F172A]/50 backdrop-blur-sm flex justify-center items-center py-10 px-4">
                    <div className="bg-white rounded-[24px] w-full max-w-md p-8 shadow-2xl animate-fade-in relative">
                        <button onClick={() => setIsAddOpen(false)} className="absolute top-6 right-6 text-gray-400 hover:text-black font-extrabold text-2xl">&times;</button>
                        <h2 className="text-2xl font-extrabold mb-6">➕ 신규 배송 노선 추가</h2>
                        
                        <div className="space-y-5">
                            <div className="flex flex-col gap-2">
                                <label className="text-[14px] font-bold text-gray-700">관리 캠프 (그룹 구분용)</label>
                                <select value={newCamp} onChange={e => setNewCamp(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[15px] font-bold focus:bg-white focus:outline-none focus:border-blue-500">
                                    <option>구리2캠프</option>
                                    <option>남양주4캠프</option>
                                    <option>송파4캠프</option>
                                    <option>경기광주 (간선)</option>
                                    <option>기타 미지정 노선</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[14px] font-bold text-gray-700">핵심 라우트 (노선명)</label>
                                <input value={newName} onChange={e => setNewName(e.target.value)} type="text" placeholder="예: 구리2A (토평/수택동 일대)" className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[15px] font-bold focus:outline-none focus:border-blue-500" />
                            </div>
                        </div>

                        <div className="mt-8">
                            <button onClick={handleCreateRoute} className="w-full py-4 bg-[#2E68ED] hover:bg-blue-700 text-white font-extrabold text-[16px] rounded-xl shadow-md transition-colors">새로운 라우트 방 만들기</button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
};
