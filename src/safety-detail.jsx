import { notify } from './ui-feedback';
import React from 'react';
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { getTypeKorean } from './safety-constants';

// 제출된 안전보건 문서 1건을 열어 보고 PDF로 내려받는 창 (기록을 열 때만 불러옵니다)
const SafetyDetailModal = ({ activeItem, setActiveItem, isAdmin, deleteRecord }) => {
    if (!activeItem) return null;

    const downloadPDF = () => {
        const targetId = 
            activeItem.formType === 'musculo' ? 'printable-musculo-form' : 
            activeItem.formType === 'heavy_object' ? 'printable-heavy-form' : 
            activeItem.formType === 'cargo_vehicle' ? 'printable-cargo-form' : 
            activeItem.formType === 'musculo_checklist' ? 'printable-musculo-checklist-form' : 
            activeItem.formType === 'hazard_survey' ? 'printable-hazard-survey-form' : 
            activeItem.formType === 'emergency_plan' ? 'printable-emergency-plan-form' : 
            activeItem.formType === 'action_history' ? 'printable-action-history-form' : 
            activeItem.formType === 'agreement' ? 'printable-plan-form' : 
            activeItem.formType === 'risk_assessment' ? 'printable-risk-form' : '';
        const element = document.getElementById(targetId);
        if (!element) return;
        
        toJpeg(element, {
            quality: 0.98,
            style: {
                transform: 'none',
                opacity: '1',
                visibility: 'visible'
            }
        }).then(dataUrl => {
            const isLandscape = activeItem.formType === 'musculo_checklist' || activeItem.formType === 'hazard_survey' || activeItem.formType === 'action_history';
            const pdf = new jsPDF(isLandscape ? 'l' : 'p', 'mm', 'a4');
            const imgWidth = isLandscape ? 297 : 210; // A4 size
            const pageHeight = isLandscape ? 210 : 295;
            const imgHeight = (element.offsetHeight * imgWidth) / element.offsetWidth;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(dataUrl, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(dataUrl, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
                heightLeft -= pageHeight;
            }
            const filename = 
                activeItem.formType === 'musculo' ? '근골격계질환_증상조사표' : 
                activeItem.formType === 'heavy_object' ? '중량물취급_작업계획서' : 
                activeItem.formType === 'cargo_vehicle' ? '화물자동차_작업계획서' : 
                activeItem.formType === 'musculo_checklist' ? '근골격계부담작업_체크리스트' : 
                activeItem.formType === 'hazard_survey' ? '유해요인조사표' : 
                activeItem.formType === 'emergency_plan' ? '비상사태_대응_계획서' : 
                activeItem.formType === 'action_history' ? '안전보건_조치_이력_관리' : 
                activeItem.formType === 'agreement' ? '안전보건관리계획서' : '위험성평가표';
            pdf.save(`${filename}_${activeItem.name}_${activeItem.date}.pdf`);
        }).catch(err => {
            console.error('PDF 생성 중 오류 발생:', err);
            notify('PDF 생성 실패: ' + err.message);
        });
    };

    const demo = activeItem.surveyData?.demographics || {};
    const misc = activeItem.surveyData?.miscellaneous || {};
    const pain = activeItem.surveyData?.painDetails || {};

    const rows = ['상차(분류) / 하차장', '상차(적재) / 적재함', '차량운전 / 1톤화물차', '하차(운반) / 배송지', '프레쉬백 및 반품 수거'];

    const bodyAreas = [
        { key: 'neck', label: '목' },
        { key: 'shoulder', label: '어깨' },
        { key: 'elbow', label: '팔꿈치' },
        { key: 'wrist', label: '손/손목' },
        { key: 'back', label: '허리' },
        { key: 'leg', label: '다리/발' }
    ];

    return (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/40 backdrop-blur-sm flex justify-center items-center py-10 px-4">
            <div className="bg-white rounded-[24px] w-full max-w-4xl max-h-full overflow-y-auto p-6 md:p-8 shadow-2xl animate-fade-in relative">
                <button onClick={() => setActiveItem(null)} className="absolute top-6 right-6 text-gray-400 hover:text-black font-extrabold text-2xl">&times;</button>
                
                <div className="border-b pb-4 mb-6 flex justify-between items-center pr-10">
                    <div>
                        <span className="text-xs font-bold text-white bg-blue-600 px-2.5 py-1 rounded inline-block mb-3">{getTypeKorean(activeItem.formType)}</span>
                        <h2 className="text-2xl font-bold">{activeItem.name} 님의 기록</h2>
                        <p className="text-gray-500 mt-2 font-medium">실시일자: <span className="text-black font-bold">
                            {activeItem.formType === 'risk_assessment' ? (activeItem.dateRange || activeItem.date) : 
                             activeItem.formType === 'musculo_checklist' ? (activeItem.surveyDate || activeItem.date) : 
                             activeItem.formType === 'hazard_survey' ? (activeItem.surveyDate || activeItem.date) : 
                             activeItem.formType === 'emergency_plan' ? activeItem.date : 
                             activeItem.formType === 'action_history' ? activeItem.date : 
                             activeItem.date || '-'}
                        </span> | 판정: <span className="font-bold text-blue-600">{activeItem.status}</span></p>
                    </div>
                    <div className="flex gap-2">
                        {(activeItem.formType === 'musculo' || activeItem.formType === 'heavy_object' || activeItem.formType === 'cargo_vehicle' || activeItem.formType === 'musculo_checklist' || activeItem.formType === 'hazard_survey' || activeItem.formType === 'emergency_plan' || activeItem.formType === 'action_history' || activeItem.formType === 'agreement' || activeItem.formType === 'risk_assessment') && (
                            <button onClick={downloadPDF} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold shadow-sm active:scale-95 transition-all">
                                📥 법정 서식 PDF 다운로드
                            </button>
                        )}
                        {isAdmin && (
                            <button onClick={() => deleteRecord(activeItem.id)} className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-extrabold shadow-sm active:scale-95 transition-all">
                                🗑️ 기록 삭제
                            </button>
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    {activeItem.formType === 'action_history' && (
                        <div className="scroll-container border border-gray-100 rounded-3xl p-3 bg-gray-50/50 flex md:justify-center justify-start">
                            <div id="printable-action-history-form" className="bg-white p-5 border border-gray-300 w-[980px] text-[7px] leading-tight font-sans shadow-sm text-black">
                                <div className="bg-blue-700 text-white font-extrabold text-center text-xs py-2.5 mb-2 rounded-sm shadow-sm tracking-wider">
                                    안전보건 조치 이력 관리
                                </div>

                                <div className="flex justify-between items-center mb-3 font-bold text-[8.5px]">
                                    <div>회사명 : {activeItem.company} (대표자/관리자 : {activeItem.manager})</div>
                                    <div>대장 일자 : {activeItem.date}</div>
                                </div>

                                <table className="w-full border-collapse border border-black text-center text-[7px] leading-tight">
                                    <thead>
                                        <tr className="bg-gray-150 font-bold">
                                            <th className="border border-black p-1 w-[3%]" rowSpan={2}>NO.</th>
                                            <th className="border border-black p-1 w-[45%]" colSpan={5}>1. 개선 필요사항 (지적사항)</th>
                                            <th className="border border-black p-1 w-[32%]" colSpan={3}>2. 개선 계획 (개선 전)</th>
                                            <th className="border border-black p-1 w-[20%]" colSpan={3}>3. 개선 완료 결과 (개선 후)</th>
                                        </tr>
                                        <tr className="bg-gray-100 text-[6.5px]">
                                            <th className="border border-black p-1 w-[5%]">Date</th>
                                            <th className="border border-black p-1 w-[6%]">종류</th>
                                            <th className="border border-black p-1 w-[7%]">구분</th>
                                            <th className="border border-black p-1 w-[10%]">위치</th>
                                            <th className="border border-black p-1 w-[17%]">발견 사항/문제점</th>
                                            <th className="border border-black p-1 w-[16%]">개선 계획</th>
                                            <th className="border border-black p-1 w-[8%]">담당자</th>
                                            <th className="border border-black p-1 w-[8%]">완료예정일</th>
                                            <th className="border border-black p-1 w-[8%]">완료일지</th>
                                            <th className="border border-black p-1 w-[6%]">소요비</th>
                                            <th className="border border-black p-1 w-[6%]">비고</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {activeItem.rows?.map((row, idx) => (
                                            <tr key={idx}>
                                                <td className="border border-black p-1.5 font-bold bg-gray-50">{row.idx}</td>
                                                <td className="border border-black p-1.5 bg-white">{row.date}</td>
                                                <td className="border border-black p-1.5 bg-white">{row.type}</td>
                                                <td className="border border-black p-1.5 bg-white">{row.cat}</td>
                                                <td className="border border-black p-1.5 bg-white">{row.loc}</td>
                                                <td className="border border-black p-1.5 bg-white text-left whitespace-pre-wrap leading-tight">{row.issue}</td>
                                                <td className="border border-black p-1.5 bg-white text-left whitespace-pre-wrap leading-tight">{row.plan}</td>
                                                <td className="border border-black p-1.5 bg-white">{row.owner}</td>
                                                <td className="border border-black p-1.5 bg-white">{row.dueDate}</td>
                                                <td className="border border-black p-1.5 bg-white">{row.doneDate}</td>
                                                <td className="border border-black p-1.5 bg-white">{row.cost}</td>
                                                <td className="border border-black p-1.5 bg-white">{row.note || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeItem.formType === 'emergency_plan' && (
                        <div className="scroll-container border border-gray-100 rounded-3xl p-3 bg-gray-50/50 flex md:justify-center justify-start">
                            <div id="printable-emergency-plan-form" className="bg-white p-6 border border-gray-300 w-[700px] text-[9px] leading-tight font-sans shadow-sm space-y-8 text-black">
                                {/* PAGE 1: 교통사고 */}
                                <div className="border-b border-dashed border-gray-300 pb-8">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="text-[8px] font-bold text-gray-500">
                                            <div>페이지 : 1</div>
                                            <div>업체명 : {activeItem.company}</div>
                                        </div>
                                        <h2 className="text-center font-extrabold text-base pt-2 flex-1">(교통사고) 비상사태 대응 계획서</h2>
                                        <table className="border-collapse border border-black text-center text-[8px] w-[130px] shrink-0">
                                            <tbody>
                                                <tr className="bg-gray-100 font-bold">
                                                    <td className="border border-black p-1 w-[40%]">담당자</td>
                                                </tr>
                                                <tr>
                                                    <td className="border border-black p-1 bg-white font-bold">{activeItem.manager}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    <table className="w-full border-collapse border border-black text-left text-[8.5px] mb-2">
                                        <thead>
                                            <tr className="bg-gray-100 text-center font-bold">
                                                <th className="border border-black p-1.5 w-[20%]">상 황</th>
                                                <th className="border border-black p-1.5 w-[25%]" colSpan={3}>장비 및 소모품</th>
                                                <th className="border border-black p-1.5 w-[55%]">진 압 및 대 응 절 차</th>
                                            </tr>
                                            <tr className="bg-gray-50 text-center text-[7.5px]">
                                                <th className="border border-black p-1"></th>
                                                <th className="border border-black p-1">품명</th>
                                                <th className="border border-black p-1">규격</th>
                                                <th className="border border-black p-1">수량</th>
                                                <th className="border border-black p-1"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td className="border border-black bg-gray-50 font-bold text-center p-2 text-[10px]" rowSpan={2}>교통사고 발생</td>
                                                <td className="border border-black p-1.5 bg-white text-center font-bold">{activeItem.p1Eq?.name}</td>
                                                <td className="border border-black p-1.5 bg-white text-center font-bold">{activeItem.p1Eq?.spec}</td>
                                                <td className="border border-black p-1.5 bg-white text-center font-bold">{activeItem.p1Eq?.qty}</td>
                                                <td className="border border-black p-2.5 bg-white space-y-2 whitespace-pre-wrap text-[7.5px] leading-relaxed" rowSpan={2}>
                                                    {activeItem.p1Steps?.map((step, idx) => (
                                                        <p key={idx} className="mb-2">{step}</p>
                                                    ))}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="border border-black p-1 bg-white text-center">-</td>
                                                <td className="border border-black p-1 bg-white text-center">-</td>
                                                <td className="border border-black p-1 bg-white text-center">-</td>
                                            </tr>
                                        </tbody>
                                    </table>

                                    <p className="font-bold text-[8.5px] mb-1 bg-gray-50 p-1">비 상 연 락 처</p>
                                    <table className="w-full border-collapse border border-black text-center text-[8px] mb-2">
                                        <thead>
                                            <tr className="bg-gray-100 font-bold">
                                                <th className="border border-black p-1 w-[20%]"></th>
                                                <th className="border border-black p-1 w-[25%]">담당자</th>
                                                <th className="border border-black p-1 w-[35%]">연락처</th>
                                                <th className="border border-black p-1 w-[20%]">비고</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {activeItem.contacts?.map((c, idx) => (
                                                <tr key={idx}>
                                                    <td className="border border-black bg-gray-50 font-bold p-1">{c.role}</td>
                                                    <td className="border border-black p-1 bg-white">{c.name || '-'}</td>
                                                    <td className="border border-black p-1 bg-white font-bold">{c.phone}</td>
                                                    <td className="border border-black p-1 bg-white">{c.note || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div className="text-center font-bold text-red-600 text-[8.5px] mt-2">
                                        ※ 2차사고 주의 (초동대처 가능한 경우 제외하고 119 신고 최우선)
                                    </div>
                                </div>

                                {/* PAGE 2: 일반사고 */}
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="text-[8px] font-bold text-gray-500">
                                            <div>페이지 : 2</div>
                                            <div>업체명 : {activeItem.company}</div>
                                        </div>
                                        <h2 className="text-center font-extrabold text-base pt-2 flex-1">(일반사고) 비상사태 대응 계획서</h2>
                                        <table className="border-collapse border border-black text-center text-[8px] w-[130px] shrink-0">
                                            <tbody>
                                                <tr className="bg-gray-100 font-bold">
                                                    <td className="border border-black p-1 w-[40%]">담당자</td>
                                                </tr>
                                                <tr>
                                                    <td className="border border-black p-1 bg-white font-bold">{activeItem.manager}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    <table className="w-full border-collapse border border-black text-left text-[8.5px] mb-2">
                                        <thead>
                                            <tr className="bg-gray-100 text-center font-bold">
                                                <th className="border border-black p-1.5 w-[20%]">상 황</th>
                                                <th className="border border-black p-1.5 w-[25%]" colSpan={3}>장비 및 소모품</th>
                                                <th className="border border-black p-1.5 w-[55%]">진 압 및 대 응 절 차</th>
                                            </tr>
                                            <tr className="bg-gray-50 text-center text-[7.5px]">
                                                <th className="border border-black p-1"></th>
                                                <th className="border border-black p-1">품명</th>
                                                <th className="border border-black p-1">규격</th>
                                                <th className="border border-black p-1">수량</th>
                                                <th className="border border-black p-1"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td className="border border-black bg-gray-50 font-bold text-center p-2 text-[10px]" rowSpan={2}>사고 발생</td>
                                                <td className="border border-black p-1.5 bg-white text-center font-bold">{activeItem.p2Eq?.name}</td>
                                                <td className="border border-black p-1.5 bg-white text-center font-bold">{activeItem.p2Eq?.spec}</td>
                                                <td className="border border-black p-1.5 bg-white text-center font-bold">{activeItem.p2Eq?.qty}</td>
                                                <td className="border border-black p-2.5 bg-white space-y-2 whitespace-pre-wrap text-[7.5px] leading-relaxed" rowSpan={2}>
                                                    {activeItem.p2Steps?.map((step, idx) => (
                                                        <p key={idx} className="mb-2">{step}</p>
                                                    ))}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="border border-black p-1 bg-white text-center">-</td>
                                                <td className="border border-black p-1 bg-white text-center">-</td>
                                                <td className="border border-black p-1 bg-white text-center">-</td>
                                            </tr>
                                        </tbody>
                                    </table>

                                    <p className="font-bold text-[8.5px] mb-1 bg-gray-50 p-1">비 상 연 락 처</p>
                                    <table className="w-full border-collapse border border-black text-center text-[8px] mb-2">
                                        <thead>
                                            <tr className="bg-gray-100 font-bold">
                                                <th className="border border-black p-1 w-[20%]"></th>
                                                <th className="border border-black p-1 w-[25%]">담당자</th>
                                                <th className="border border-black p-1 w-[35%]">연락처</th>
                                                <th className="border border-black p-1 w-[20%]">비고</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {activeItem.contacts?.map((c, idx) => (
                                                <tr key={idx}>
                                                    <td className="border border-black bg-gray-50 font-bold p-1">{c.role}</td>
                                                    <td className="border border-black p-1 bg-white">{c.name || '-'}</td>
                                                    <td className="border border-black p-1 bg-white font-bold">{c.phone}</td>
                                                    <td className="border border-black p-1 bg-white">{c.note || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div className="text-center font-bold text-red-600 text-[8.5px] mt-2">
                                        ※ 2차사고 주의 (초동대처 가능한 경우 제외하고 119 신고 최우선)
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeItem.formType === 'hazard_survey' && (
                        <div className="scroll-container border border-gray-100 rounded-3xl p-3 bg-gray-50/50 flex md:justify-center justify-start">
                            <div id="printable-hazard-survey-form" className="bg-white p-4 border border-gray-300 w-[1000px] text-[7.5px] leading-tight font-sans shadow-sm flex gap-4 text-black">
                                {/* Panel 1 */}
                                <div className="flex-1 border border-black p-2 flex flex-col justify-between">
                                    <div>
                                        <h2 className="text-center font-extrabold text-[10px] border-b border-black pb-1 mb-2 bg-gray-100 py-1">유해요인조사표(제4조 관련)</h2>
                                        
                                        <p className="font-bold text-[8px] mb-1 bg-gray-50 p-0.5">가. 조사 개요</p>
                                        <table className="w-full border-collapse border border-black text-center mb-3 text-[7.5px]">
                                            <tbody>
                                                <tr>
                                                    <td className="border border-black bg-gray-100 font-bold p-1 w-[25%]">조사 일시</td>
                                                    <td className="border border-black p-1 w-[30%] font-bold">{activeItem.surveyDate}</td>
                                                    <td className="border border-black bg-gray-100 font-bold p-1 w-[20%]">조사자</td>
                                                    <td className="border border-black p-1 w-[25%] font-bold">{activeItem.surveyor}</td>
                                                </tr>
                                                <tr>
                                                    <td className="border border-black bg-gray-100 font-bold p-1">부서명</td>
                                                    <td className="border border-black p-1 text-left pl-1 font-bold" colSpan={3}>{activeItem.deptName}</td>
                                                </tr>
                                                <tr>
                                                    <td className="border border-black bg-gray-100 font-bold p-1">작업공정명</td>
                                                    <td className="border border-black p-1 text-left pl-1 font-bold" colSpan={3}>{activeItem.processName}</td>
                                                </tr>
                                                <tr>
                                                    <td className="border border-black bg-gray-100 font-bold p-1">작업명</td>
                                                    <td className="border border-black p-1 text-left pl-1 font-bold" colSpan={3}>{activeItem.workName}</td>
                                                </tr>
                                            </tbody>
                                        </table>

                                        <p className="font-bold text-[8px] mb-1 bg-gray-50 p-0.5">나. 작업장 상황 조사</p>
                                        <table className="w-full border-collapse border border-black text-left mb-2 text-[7.5px]">
                                            <tbody>
                                                <tr>
                                                    <td className="border border-black bg-gray-100 font-bold p-1 w-[25%] text-center">작업 설비</td>
                                                    <td className="border border-black p-1 bg-white font-bold">{activeItem.eqChange}</td>
                                                </tr>
                                                <tr>
                                                    <td className="border border-black bg-gray-100 font-bold p-1 text-center">작업량</td>
                                                    <td className="border border-black p-1 bg-white font-bold">{activeItem.volChange}</td>
                                                </tr>
                                                <tr>
                                                    <td className="border border-black bg-gray-100 font-bold p-1 text-center">작업 속도</td>
                                                    <td className="border border-black p-1 bg-white font-bold">{activeItem.speedChange}</td>
                                                </tr>
                                                <tr>
                                                    <td className="border border-black bg-gray-100 font-bold p-1 text-center">업무 변화</td>
                                                    <td className="border border-black p-1 bg-white font-bold">{activeItem.jobChange}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="text-right text-[6.5px] text-gray-400">1 / 3 Page</div>
                                </div>

                                {/* Panel 2 */}
                                <div className="flex-1 border border-black p-2 flex flex-col justify-between">
                                    <div>
                                        <p className="font-bold text-[8px] mb-1 bg-gray-50 p-0.5">다. 작업조건 조사 (인간공학적인 측면)</p>
                                        <p className="font-bold text-[7.5px] text-blue-800 mb-1">■ 1단계 : 작업별 주요 작업내용 (유해요인 조사자)</p>
                                        <table className="w-full border-collapse border border-black text-left mb-3 text-[7.5px]">
                                            <tbody>
                                                <tr className="bg-gray-100">
                                                    <td className="border border-black font-bold p-1 w-[25%] text-center">작업명</td>
                                                    <td className="border border-black p-1 bg-white font-bold">{activeItem.step1WorkName}</td>
                                                </tr>
                                                <tr>
                                                    <td className="border border-black bg-gray-100 font-bold p-1 text-center">작업내용<br/>(단위작업명)</td>
                                                    <td className="border border-black p-1.5 bg-white space-y-1 text-[7px] font-bold">
                                                        {activeItem.step1Details?.map((det, idx) => (
                                                            <p key={idx}>{idx + 1}) {det}</p>
                                                        ))}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>

                                        <p className="font-bold text-[7.5px] text-blue-800 mb-1">■ 2단계 : 작업별 작업부하 및 작업빈도 (근로자 면담)</p>
                                        <table className="w-full border-collapse border border-black text-center text-[7px] mb-2">
                                            <thead>
                                                <tr className="bg-gray-100 font-bold">
                                                    <th className="border border-black p-1 w-[25%]">단위작업명</th>
                                                    <th className="border border-black p-1 w-[20%]">부담작업(호)</th>
                                                    <th className="border border-black p-1 w-[18%]">작업부하(A)</th>
                                                    <th className="border border-black p-1 w-[18%]">작업빈도(B)</th>
                                                    <th className="border border-black p-1 w-[19%]">총점수(AxB)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {activeItem.step2Rows?.map((row, idx) => (
                                                    <tr key={idx}>
                                                        <td className="border border-black p-1 font-bold bg-white">{row.name}</td>
                                                        <td className="border border-black p-1 bg-white">{row.num}</td>
                                                        <td className="border border-black p-1 bg-white">{row.load}</td>
                                                        <td className="border border-black p-1 bg-white">{row.freq}</td>
                                                        <td className="border border-black p-1 bg-gray-50 font-bold text-[8px]">{row.load * row.freq}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="text-right text-[6.5px] text-gray-400">2 / 3 Page</div>
                                </div>

                                {/* Panel 3 */}
                                <div className="flex-1 border border-black p-2 flex flex-col justify-between">
                                    <div>
                                        <p className="font-bold text-[8px] mb-1 bg-gray-50 p-0.5">■ 3단계 : 유해요인평가</p>
                                        <table className="w-full border-collapse border border-black text-center mb-2 text-[7.5px]">
                                            <tbody>
                                                <tr className="bg-gray-100">
                                                    <td className="border border-black font-bold p-1 w-[20%]">작업명</td>
                                                    <td className="border border-black p-1 w-[30%] bg-white font-bold">{activeItem.step3WorkName}</td>
                                                    <td className="border border-black font-bold p-1 w-[20%]">근로자명</td>
                                                    <td className="border border-black p-1 w-[30%] bg-white font-bold">{activeItem.workerName}</td>
                                                </tr>
                                                <tr>
                                                    <td className="border border-black bg-gray-100 font-bold p-1 text-center" colSpan={4}>현장 관찰 관격 사진 (동작 사진)</td>
                                                </tr>
                                                <tr>
                                                    <td className="border border-black p-1.5 bg-white text-center" colSpan={4}>
                                                        {activeItem.workerPhoto ? (
                                                            <img src={activeItem.workerPhoto} className="w-[120px] h-[90px] object-cover mx-auto rounded border" alt="작업사진" />
                                                        ) : (
                                                            <span className="text-gray-400 text-[7px] font-bold">등록된 작업 사진이 없습니다.</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>

                                        <p className="font-bold text-[7.5px] mb-1">■ 작업별로 관찰된 유해요인에 대한 원인분석</p>
                                        <table className="w-full border-collapse border border-black text-center text-[6.5px] leading-tight mb-2">
                                            <thead>
                                                <tr className="bg-gray-150 font-bold">
                                                    <th className="border border-black p-0.5 w-[20%]">단위작업명</th>
                                                    <th className="border border-black p-0.5 w-[15%]">부담작업(호)</th>
                                                    <th className="border border-black p-0.5 w-[20%]">유해요인</th>
                                                    <th className="border border-black p-0.5 w-[35%]">발생 원인</th>
                                                    <th className="border border-black p-0.5 w-[10%]">비고</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {activeItem.analysisRows?.map((row, idx) => (
                                                    <tr key={idx}>
                                                        <td className="border border-black p-1 font-bold bg-white">{row.unitJob}</td>
                                                        <td className="border border-black p-1 bg-white">{row.num}</td>
                                                        <td className="border border-black p-1 bg-white">{row.hazard}</td>
                                                        <td className="border border-black p-1 bg-white text-left whitespace-pre-wrap">{row.cause}</td>
                                                        <td className="border border-black p-1 bg-white">{row.note}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="text-right text-[6.5px] text-gray-400">3 / 3 Page</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeItem.formType === 'heavy_object' && (
                        <div className="scroll-container border border-gray-100 rounded-3xl p-3 bg-gray-50/50 flex md:justify-center justify-start">
                            <div id="printable-heavy-form" className="bg-white p-5 text-black border border-gray-300 w-[700px] font-sans text-[10px] leading-tight shadow-sm">
                                <h2 className="text-center font-extrabold text-sm border-2 border-black py-1 mb-3">중량물취급 작업계획서</h2>
                                
                                <table className="w-full border-collapse border border-black text-left text-[9.5px] mb-3">
                                    <tbody>
                                        <tr>
                                            <td className="border border-black bg-gray-100 font-bold p-1.5 text-center w-[18%]">작성자</td>
                                            <td className="border border-black p-1.5 bg-white font-bold">{activeItem.writer}</td>
                                            <td className="border border-black bg-gray-100 font-bold p-1.5 text-center w-[18%]">작업 일자</td>
                                            <td className="border border-black p-1.5 bg-white font-bold">{activeItem.date}</td>
                                        </tr>
                                        <tr>
                                            <td className="border border-black bg-gray-100 font-bold p-1.5 text-center">작업자</td>
                                            <td className="border border-black p-1.5 bg-white font-bold">{activeItem.worker}</td>
                                            <td className="border border-black bg-gray-100 font-bold p-1.5 text-center">주 취급 중량물</td>
                                            <td className="border border-black p-1.5 bg-white font-bold">{activeItem.weight}</td>
                                        </tr>
                                        <tr>
                                            <td className="border border-black bg-gray-100 font-bold p-1.5 text-center">운반 장비</td>
                                            <td className="border border-black p-1.5 bg-white font-bold" colSpan={3}>{activeItem.equipment}</td>
                                        </tr>
                                    </tbody>
                                </table>

                                <h4 className="font-bold text-[10px] mb-2 text-blue-800 border-b pb-1">작업전점검표</h4>
                                <div className="space-y-1">
                                    {activeItem.checks?.map((c, i) => (
                                        <div key={i} className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100 text-[9px]">
                                            <p className="font-medium flex-1 pr-4">{c.q}</p>
                                            <span className={`font-bold px-2 py-0.5 rounded ${c.answer==='양호'?'bg-green-150 text-green-700':'bg-red-100 text-red-600'}`}>{c.answer}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeItem.formType === 'cargo_vehicle' && (
                        <div className="scroll-container border border-gray-100 rounded-3xl p-3 bg-gray-50/50 flex md:justify-center justify-start">
                            <div id="printable-cargo-form" className="bg-white p-5 text-black border border-gray-300 w-[800px] font-sans text-[9px] leading-tight shadow-sm">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex-1 text-center pt-2">
                                        <h1 className="font-extrabold text-base border-b-2 border-black pb-1 inline-block">화물자동차 작업계획서</h1>
                                        <p className="text-[10px] text-gray-500 mt-1">- 차량계 하역운반기계 -</p>
                                    </div>
                                    <table className="border-collapse border border-black text-center text-[8.5px] w-[180px] shrink-0">
                                        <tbody>
                                            <tr>
                                                <td className="border border-black bg-gray-100 font-bold p-1 w-[35%]">검토자</td>
                                                <td className="border border-black p-0.5 relative">
                                                    권오민
                                                    <span className="absolute right-2 top-0.5"><img src="/admin_seal.png" className="w-5 h-5 object-contain" alt="도장" /></span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="border border-black bg-gray-100 font-bold p-1">작성자</td>
                                                <td className="border border-black p-0.5 relative">
                                                    권오민
                                                    <span className="absolute right-2 top-0.5"><img src="/admin_seal.png" className="w-5 h-5 object-contain" alt="도장" /></span>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <table className="w-full border-collapse border border-black text-left text-[8.5px] mb-3">
                                    <tbody>
                                        <tr>
                                            <td className="border border-black bg-gray-100 font-bold p-1.5 text-center w-[15%]">작업명(장소)</td>
                                            <td className="border border-black p-1.5 w-[45%] bg-white font-bold">{activeItem.workName}</td>
                                            <td className="border border-black bg-gray-100 font-bold p-1.5 text-center w-[15%]">작업기간</td>
                                            <td className="border border-black p-1.5 w-[25%] bg-white font-bold">{activeItem.workPeriod}</td>
                                        </tr>
                                        <tr>
                                            <td className="border border-black bg-gray-100 font-bold p-1.5 text-center">작업업체/작업자</td>
                                            <td className="border border-black p-1.5 bg-white font-bold" colSpan={3}>
                                                업체명: {activeItem.companyName} &nbsp;|&nbsp; 작업자: {activeItem.workerNames}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="border border-black bg-gray-100 font-bold p-1.5 text-center">운전원</td>
                                            <td className="border border-black p-1.5 bg-white font-bold" colSpan={3}>
                                                성명: {activeItem.driverName} &nbsp;|&nbsp; 연락처: {activeItem.driverPhone}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="border border-black bg-gray-100 font-bold p-1.5 text-center">유도자</td>
                                            <td className="border border-black p-1.5 bg-white font-bold" colSpan={3}>
                                                성명: {activeItem.guideName} &nbsp;|&nbsp; 연락처: {activeItem.guidePhone}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="border border-black bg-gray-100 font-bold p-1.5 text-center">사전조사 내용</td>
                                            <td className="border border-black p-1.5 bg-white text-[8px] leading-tight" colSpan={3}>{activeItem.preSurvey}</td>
                                        </tr>
                                        <tr>
                                            <td className="border border-black bg-gray-100 font-bold p-1.5 text-center">기계ㆍ장비 제원</td>
                                            <td className="border border-black p-1.5 bg-white font-bold" colSpan={3}>{activeItem.machineSpecs}</td>
                                        </tr>
                                    </tbody>
                                </table>

                                <table className="w-full border-collapse border border-black text-[8px] leading-tight text-left">
                                    <thead>
                                        <tr className="bg-gray-100 text-center font-bold">
                                            <th className="border border-black p-1 w-[12%]">구분</th>
                                            <th className="border border-black p-1 w-[55%]">점검 항목</th>
                                            <th className="border border-black p-1 w-[8%]">적정</th>
                                            <th className="border border-black p-1 w-[8%]">부적정</th>
                                            <th className="border border-black p-1 w-[17%]">안전조치</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {activeItem.checks?.map(c => (
                                            <tr key={c.idx}>
                                                {c.idx === 1 && <td className="border border-black p-1 font-bold text-center" rowSpan={1}>운전자 자격</td>}
                                                {c.idx === 2 && <td className="border border-black p-1 font-bold text-center" rowSpan={1}>기계 검사</td>}
                                                {c.idx === 3 && <td className="border border-black p-1 font-bold text-center" rowSpan={5}>작업 전 조치</td>}
                                                {c.idx === 8 && <td className="border border-black p-1 font-bold text-center" rowSpan={7}>운행 및 작업 중 조치</td>}
                                                {c.idx === 15 && <td className="border border-black p-1 font-bold text-center" rowSpan={2}>수리 등 점검 시</td>}
                                                <td className="border border-black p-1 whitespace-pre-line">{c.q}</td>
                                                <td className="border border-black p-1 text-center font-bold">{c.answer === '적정' ? 'V' : ''}</td>
                                                <td className="border border-black p-1 text-center font-bold text-red-500">{c.answer === '부적정' ? 'V' : ''}</td>
                                                <td className="border border-black p-1">{c.action || ''}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    {activeItem.formType === 'musculo_checklist' && (
                        <div className="scroll-container border border-gray-100 rounded-3xl p-3 bg-gray-50/50 flex md:justify-center justify-start">
                            <div id="printable-musculo-checklist-form" className="bg-white p-5 text-black border border-gray-300 w-[940px] font-sans text-[7.5px] leading-tight shadow-sm">
                                <h2 className="text-center font-extrabold text-sm border-b-2 border-black pb-1.5 mb-3">근골격계부담작업 체크리스트</h2>
                                
                                <table className="w-full border-collapse border border-black text-center mb-2 text-[8px]">
                                    <tbody>
                                        <tr>
                                            <td className="border border-black bg-gray-100 font-bold p-1 w-[12%]">사업장명</td>
                                            <td className="border border-black p-1 w-[21%] font-bold">{activeItem.bizName}</td>
                                            <td className="border border-black bg-gray-100 font-bold p-1 w-[12%]">조사 일자</td>
                                            <td className="border border-black p-1 w-[21%] font-bold">{activeItem.surveyDate}</td>
                                            <td className="border border-black bg-gray-100 font-bold p-1 w-[12%]">조 사 자</td>
                                            <td className="border border-black p-1 w-[22%] font-bold">{activeItem.surveyor}</td>
                                        </tr>
                                        <tr>
                                            <td className="border border-black bg-gray-100 font-bold p-1">공 정 명</td>
                                            <td className="border border-black p-1 font-bold">{activeItem.processName}</td>
                                            <td className="border border-black bg-gray-100 font-bold p-1">공정 내용</td>
                                            <td className="border border-black p-1 text-left pl-2 font-bold" colSpan={3}>{activeItem.processDesc}</td>
                                        </tr>
                                    </tbody>
                                </table>

                                <table className="w-full border-collapse border border-black text-center text-[7px] leading-tight">
                                    <thead>
                                        <tr className="bg-gray-100 font-bold">
                                            <th className="border border-black p-1 w-[15%]" rowSpan={2}>구분</th>
                                            <th className="border border-black p-1 w-[7.7%]">(1)</th>
                                            <th className="border border-black p-1 w-[7.7%]">(2)</th>
                                            <th className="border border-black p-1 w-[7.7%]">(3)</th>
                                            <th className="border border-black p-1 w-[7.7%]">(4)</th>
                                            <th className="border border-black p-1 w-[7.7%]">(5)</th>
                                            <th className="border border-black p-1 w-[7.7%]">(6)</th>
                                            <th className="border border-black p-1 w-[7.7%]">(7)</th>
                                            <th className="border border-black p-1 w-[7.7%]">(8)</th>
                                            <th className="border border-black p-1 w-[7.7%]">(9)</th>
                                            <th className="border border-black p-1 w-[7.7%]">(10)</th>
                                            <th className="border border-black p-1 w-[7.7%]">(11)</th>
                                        </tr>
                                        <tr className="bg-gray-50 text-[6.5px]">
                                            <th className="border border-black p-1">스마트폰/PDA</th>
                                            <th className="border border-black p-1">반복동작</th>
                                            <th className="border border-black p-1">부적절자세1</th>
                                            <th className="border border-black p-1">부적절자세2</th>
                                            <th className="border border-black p-1">쪼그려앉기</th>
                                            <th className="border border-black p-1">손가락쥐기</th>
                                            <th className="border border-black p-1">물건쥐기</th>
                                            <th className="border border-black p-1">물건들기1</th>
                                            <th className="border border-black p-1">물건들기2</th>
                                            <th className="border border-black p-1">물건들기3</th>
                                            <th className="border border-black p-1">반복충격</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="bg-white">
                                            <td className="border border-black p-1.5 font-bold">구분</td>
                                            <td className="border border-black p-1.5 text-center text-xs bg-gray-50/20">📱</td>
                                            <td className="border border-black p-1.5 text-center text-xs bg-gray-50/20">🔄</td>
                                            <td className="border border-black p-1.5 text-center text-xs bg-gray-50/20">🙋</td>
                                            <td className="border border-black p-1.5 text-center text-xs bg-gray-50/20">🙇</td>
                                            <td className="border border-black p-1.5 text-center text-xs bg-gray-50/20">🧘</td>
                                            <td className="border border-black p-1.5 text-center text-xs bg-gray-50/20">🤏</td>
                                            <td className="border border-black p-1.5 text-center text-xs bg-gray-50/20">✊</td>
                                            <td className="border border-black p-1.5 text-center text-xs bg-gray-50/20">🏋️</td>
                                            <td className="border border-black p-1.5 text-center text-xs bg-gray-50/20">📦</td>
                                            <td className="border border-black p-1.5 text-center text-xs bg-gray-50/20">🤲</td>
                                            <td className="border border-black p-1.5 text-center text-xs bg-gray-50/20">💥</td>
                                        </tr>
                                        <tr className="bg-gray-50/50">
                                            <td className="border border-black p-1 font-bold">노출시간</td>
                                            {(activeItem.exposureTimes || ['하루에 총4시간 이상', '하루에 총2시간 이상', '하루에 총2시간 이상', '하루에 총2시간 이상', '하루에 총2시간 이상', '하루에 총2시간 이상', '하루에 총2시간 이상', '-', '-', '하루에 총2시간 이상', '하루에 총2시간 이상']).map((val, idx) => (
                                                <td key={idx} className="border border-black p-1 text-[6.5px]">{val}</td>
                                            ))}
                                        </tr>
                                        <tr className="bg-gray-50/50">
                                            <td className="border border-black p-1 font-bold">노출빈도</td>
                                            {(activeItem.exposureFreqs || ['-', '-', '-', '-', '-', '-', '-', '하루에 총 10회 이상', '하루에 총 25회 이상', '분당 2회 이상', '시간당 10회 이상']).map((val, idx) => (
                                                <td key={idx} className="border border-black p-1 text-[6.5px]">{val}</td>
                                            ))}
                                        </tr>
                                        <tr className="bg-gray-50/50">
                                            <td className="border border-black p-1 font-bold">신체부위</td>
                                            {(activeItem.bodyParts || ['손, 손가락', '목,어깨,손목,손,팔꿈치', '어깨, 팔', '목, 허리', '다리, 무릎', '손가락', '손', '허리', '손, 무릎', '허리', '손, 무릎, 팔꿈치']).map((val, idx) => (
                                                <td key={idx} className="border border-black p-1 text-[6.5px]">{val}</td>
                                            ))}
                                        </tr>
                                        <tr className="bg-gray-50/50 text-[6.2px] leading-tight">
                                            <td className="border border-black p-1 font-bold">작업자세 및 내용</td>
                                            {(activeItem.postures || ['스마트폰/PDA 스캐너 연속 등록 및 바코드 스캔 작업', '같은동작 반복', '머리위 손/팔꿈치 들림', '구부리거나 비틂', '쪼그려 앉거나 무릎꿇음', '한 손가락 쥐기', '물건을 쥐는 작업', '물건을 드는 작업', '무릎아래/어깨위, 팔뻗어 들기', '물건을 드는 작업', '반복적인 충격']).map((val, idx) => (
                                                <td key={idx} className="border border-black p-1 text-[6.2px] whitespace-pre-line">{val}</td>
                                            ))}
                                        </tr>
                                        <tr className="bg-gray-50/50">
                                            <td className="border border-black p-1 font-bold">무게</td>
                                            {(activeItem.weights || ['-', '-', '-', '-', '-', '1kg↑ / 2kg상응', '4.5kg↑', '25kg↑', '10kg↑', '4.5kg↑', '-']).map((val, idx) => (
                                                <td key={idx} className="border border-black p-1 text-[6.5px]">{val}</td>
                                            ))}
                                        </tr>
                                        {rows.map(row => (
                                            <tr key={row}>
                                                <td className="border border-black p-1 font-bold text-left bg-gray-50">{row}</td>
                                                {activeItem.matrix?.[row]?.map((val, colIdx) => (
                                                    <td key={colIdx} className={`border border-black p-1 font-extrabold text-[10px] ${val==='O'?'bg-blue-50/50 text-blue-700':'bg-white text-gray-300'}`}>
                                                        {val}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeItem.formType === 'musculo' && (
                        <div className="scroll-container border border-gray-100 rounded-3xl p-4 bg-gray-50/50">
                            <div id="printable-musculo-form" className="bg-white p-8 text-black border border-gray-300 w-[800px] mx-auto font-sans text-xs leading-normal">
                                <h2 className="text-center font-extrabold text-lg border-2 border-black py-2 mb-4">근골격계질환 증상조사표 (제4조 관련)</h2>
                                
                                <p className="font-extrabold mb-1">Ⅰ. 아래 사항을 직접 기입해 주시기 바랍니다.</p>
                                <table className="w-full border-collapse border border-black text-center mb-4">
                                    <tbody>
                                        <tr>
                                            <td className="border border-black bg-gray-100 font-bold p-2 w-[12%]">조사일자</td>
                                            <td className="border border-black p-2 text-left font-bold text-blue-700" colSpan={5}>{activeItem.date}</td>
                                        </tr>
                                        <tr>
                                            <td className="border border-black bg-gray-100 font-bold p-2 w-[12%]">성 명</td>
                                            <td className="border border-black p-2 w-[21%]">{demo.name}</td>
                                            <td className="border border-black bg-gray-100 font-bold p-2 w-[12%]">연 령</td>
                                            <td className="border border-black p-2 w-[21%]">{demo.age} 세</td>
                                            <td className="border border-black bg-gray-100 font-bold p-2 w-[12%]">성 별</td>
                                            <td className="border border-black p-2 w-[22%]">{demo.gender}</td>
                                        </tr>
                                        <tr>
                                            <td className="border border-black bg-gray-100 font-bold p-2">작업부서</td>
                                            <td className="border border-black p-2 text-left" colSpan={3}>
                                                {demo.deptPart} 부 {demo.deptLine} 라인 ({demo.deptTask} 작업)
                                            </td>
                                            <td className="border border-black bg-gray-100 font-bold p-2">결혼여부</td>
                                            <td className="border border-black p-2">{demo.maritalStatus}</td>
                                        </tr>
                                        <tr>
                                            <td className="border border-black bg-gray-100 font-bold p-2">현 직종경력</td>
                                            <td className="border border-black p-2 text-left" colSpan={5}>
                                                {demo.careerYears || '0'} 년 {demo.careerMonths || '0'} 개월째 근무 중
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="border border-black bg-gray-100 font-bold p-2">현재 작업<br/>(구체적으로)</td>
                                            <td className="border border-black p-2 text-left" colSpan={5}>
                                                작업내용: {demo.currentJobDesc || '-'}<br/>
                                                작업기간: {demo.currentJobYears || '0'} 년 {demo.currentJobMonths || '0'} 개월째 하고 있음
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="border border-black bg-gray-100 font-bold p-2">1일 근무시간</td>
                                            <td className="border border-black p-2 text-left" colSpan={5}>
                                                {demo.workHours || '0'} 시간 근무 중 휴식시간(식사시간 제외) {demo.breakTime || '0'} 분씩 {demo.breakCount || '0'} 회 휴식
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="border border-black bg-gray-100 font-bold p-2">이전 직업</td>
                                            <td className="border border-black p-2 text-left" colSpan={5}>
                                                작업내용: {demo.prevJobDesc || '-'}<br/>
                                                작업기간: {demo.prevJobYears || '0'} 년 {demo.prevJobMonths || '0'} 개월 동안 했음
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>

                                <p className="font-extrabold mb-1">Ⅱ. 기타 사항</p>
                                <div className="border border-black p-3 space-y-3 mb-4 text-left">
                                    <p><strong>1. 규칙적인 여가 및 취미 활동 (주 2-3회 이상):</strong> 
                                        [ {misc.hobbyActivities?.computer ? 'V' : ' '} ] 게임 등 컴퓨터 관련 활동 &nbsp;&nbsp;
                                        [ {misc.hobbyActivities?.instrument ? 'V' : ' '} ] 피아노, 드럼 등 악기 연주 &nbsp;&nbsp;
                                        [ {misc.hobbyActivities?.handcraft ? 'V' : ' '} ] 뜨개질, 붓글씨 등 &nbsp;&nbsp;
                                        [ {misc.hobbyActivities?.sports ? 'V' : ' '} ] 스포츠 활동 &nbsp;&nbsp;
                                        [ {misc.hobbyActivities?.none ? 'V' : ' '} ] 해당사항 없음
                                    </p>
                                    <p><strong>2. 귀하의 하루 평균 가사노동 시간:</strong> {misc.houseworkHours}</p>
                                    <p><strong>3. 특정 질병 진단 여부:</strong> 
                                        류머티스 관절염 [ {misc.diseaseType?.rheumatism ? 'V' : ' '} ] &nbsp;&nbsp;
                                        당뇨병 [ {misc.diseaseType?.diabetes ? 'V' : ' '} ] &nbsp;&nbsp;
                                        루프스병 [ {misc.diseaseType?.lupus ? 'V' : ' '} ] &nbsp;&nbsp;
                                        통풍 [ {misc.diseaseType?.gout ? 'V' : ' '} ] &nbsp;&nbsp;
                                        알코올중독 [ {misc.diseaseType?.alcoholism ? 'V' : ' '} ] 
                                        &nbsp;({misc.hasDisease === '예' ? `진단받음 / 상태: ${misc.diseaseStatus}` : '아니오'})
                                    </p>
                                    <p><strong>4. 과거 상해 경험 여부:</strong> 
                                        손/손가락 [ {misc.injuryParts?.hand ? 'V' : ' '} ] &nbsp;&nbsp;
                                        팔/팔꿈치 [ {misc.injuryParts?.elbow ? 'V' : ' '} ] &nbsp;&nbsp;
                                        어깨 [ {misc.injuryParts?.shoulder ? 'V' : ' '} ] &nbsp;&nbsp;
                                        목 [ {misc.injuryParts?.neck ? 'V' : ' '} ] &nbsp;&nbsp;
                                        허리 [ {misc.injuryParts?.back ? 'V' : ' '} ] &nbsp;&nbsp;
                                        다리/발 [ {misc.injuryParts?.leg ? 'V' : ' '} ]
                                        &nbsp;({misc.hasInjuryHistory === '예' ? '다친 적 있음' : '없음'})
                                    </p>
                                    <p><strong>5. 현재 업무의 육체적 부담 정도:</strong> {misc.physicalLoad}</p>
                                </div>

                                <p className="font-extrabold mb-1">Ⅲ. 근골격계 통증 및 불편함 조사</p>
                                <div className="border border-black p-3 text-left mb-4">
                                    지난 1년 동안 작업 관련 통증이나 불편함을 느낀 적이 있습니까? : <strong>{activeItem.surveyData?.hasPain || '아니오'}</strong>
                                </div>

                                {activeItem.surveyData?.hasPain === '예' && (
                                    <table className="w-full border-collapse border border-black text-center text-[9px] mb-4">
                                        <thead>
                                            <tr className="bg-gray-100">
                                                <th className="border border-black p-1.5 w-[20%]">통증 부위</th>
                                                {bodyAreas.map(a => (
                                                    <th key={a.key} className="border border-black p-1.5">{a.label}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td className="border border-black font-bold p-1.5">1. 통증 구체적 부위</td>
                                                {bodyAreas.map(a => {
                                                    const info = pain[a.key];
                                                    return <td key={a.key} className="border border-black p-1.5">{info?.checked ? info.side : '-'}</td>;
                                                })}
                                            </tr>
                                            <tr>
                                                <td className="border border-black font-bold p-1.5">2. 통증 지속 기간</td>
                                                {bodyAreas.map(a => {
                                                    const info = pain[a.key];
                                                    return <td key={a.key} className="border border-black p-1.5">{info?.checked ? info.duration : '-'}</td>;
                                                })}
                                            </tr>
                                            <tr>
                                                <td className="border border-black font-bold p-1.5">3. 통증 강도</td>
                                                {bodyAreas.map(a => {
                                                    const info = pain[a.key];
                                                    return <td key={a.key} className="border border-black p-1.5">{info?.checked ? info.intensity : '-'}</td>;
                                                })}
                                            </tr>
                                            <tr>
                                                <td className="border border-black font-bold p-1.5">4. 발생 빈도 (연간)</td>
                                                {bodyAreas.map(a => {
                                                    const info = pain[a.key];
                                                    return <td key={a.key} className="border border-black p-1.5">{info?.checked ? info.frequency : '-'}</td>;
                                                })}
                                            </tr>
                                            <tr>
                                                <td className="border border-black font-bold p-1.5">5. 지난 1주일 통증 여부</td>
                                                {bodyAreas.map(a => {
                                                    const info = pain[a.key];
                                                    return <td key={a.key} className="border border-black p-1.5">{info?.checked ? info.currentWeek : '-'}</td>;
                                                })}
                                            </tr>
                                            <tr>
                                                <td className="border border-black font-bold p-1.5">6. 지난 1년 동안 조치</td>
                                                {bodyAreas.map(a => {
                                                    const info = pain[a.key];
                                                    if (!info?.checked) return <td key={a.key} className="border border-black p-1.5">-</td>;
                                                    const actions = [];
                                                    if (info.effect?.hospital) actions.push('치료');
                                                    if (info.effect?.meds) actions.push('약');
                                                    if (info.effect?.compensation) actions.push('산재');
                                                    if (info.effect?.job_change) actions.push('작업전환');
                                                    if (info.effect?.none) actions.push('해당없음');
                                                    if (info.effect?.other) actions.push(info.effect.other);
                                                    return <td key={a.key} className="border border-black p-1.5 text-[8px]">{actions.join(', ')}</td>;
                                                })}
                                            </tr>
                                        </tbody>
                                    </table>
                                )}

                                <div className="mt-4 border-t pt-4 flex justify-between items-center px-4 mb-4">
                                    <p className="text-[10px] font-bold text-gray-500">작성자 서명:</p>
                                    {activeItem.signature ? (
                                        <img src={activeItem.signature} className="w-[100px] h-[40px] object-contain border border-gray-200 rounded" alt="서명" />
                                    ) : (
                                        <span className="text-[10px] text-gray-400 font-bold">(서명 누락)</span>
                                    )}
                                </div>

                                <div className="border border-gray-400 p-3 text-left text-[9px] text-gray-600 bg-gray-50/50">
                                    <p className="font-bold">※ 유의사항</p>
                                    <p>- 부담작업을 수행하는 근로자가 직접 읽어보고 문항을 체크합니다.</p>
                                    <p>- 증상조사표를 작성할 경우 증상을 과대 또는 과소 평가 해서는 안됩니다.</p>
                                    <p>- 증상조사 결과는 근골격계질환의 예방 또는 입증하는 근거나 반증자료로 활용할 수 있습니다.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeItem.formType === 'agreement' && (
                        <div className="scroll-container border border-gray-100 rounded-3xl p-3 bg-gray-50/50 flex md:justify-center justify-start">
                            <div id="printable-plan-form" className="bg-white p-5 text-black border border-gray-300 w-[700px] font-sans text-[10px] leading-tight shadow-sm">
                                <h2 className="text-center font-extrabold text-sm border-2 border-black py-1 mb-3">안전보건관리계획서</h2>
                                
                                <table className="w-full border-collapse border border-black text-left mb-2 text-[9.5px]">
                                    <tbody>
                                        <tr>
                                            <td className="border border-black bg-gray-100 font-bold p-2 text-center w-[18%]">업체현황</td>
                                            <td className="border border-black p-2 space-y-0.5">
                                                <p>1. 회사명 : 코끼리물류</p>
                                                <p>2. 소재지 : 경기 남양주시 경춘로2290번길 1, 205동 1502호</p>
                                                <p className="flex items-center gap-1.5">
                                                    3. 안전보건책임자(대표자) : 권오민 
                                                    <span className="relative inline-flex items-center justify-center w-7 h-7 -my-2"><img src="/admin_seal.png" className="w-7 h-7 object-contain" alt="도장" /></span>
                                                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(대표번호) : 010-2514-4826
                                                </p>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="border border-black bg-gray-100 font-bold p-2 text-center">장비 및<br/>보호구 현황</td>
                                            <td className="border border-black p-2 space-y-0.5">
                                                <p>1. 차량(대) : {activeItem.vehicles || '1ton 12대'}</p>
                                                <p>2. 인원(명) : {activeItem.workers || '12명'}</p>
                                                <p>3. 보호구 : {activeItem.protectiveGear || '안전화, 미끄럼방지 장갑, 손목보호대, 야간 랜턴'}</p>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="border border-black bg-gray-100 font-bold p-2 text-center">작업 위해요소</td>
                                            <td className="border border-black p-2 space-y-0.5">
                                                <p>1. 중량물 취급: 무거운 박스 반복 운반으로 인한 근골격계 질환, 허리·어깨 부상 위험</p>
                                                <p>2. 낙상·미끄러짐: 비·눈·결빙으로 인한 작업장 바닥 미끄러움, 차량 승하차 시 발목·무릎 부상</p>
                                                <p>3. 충돌·끼임: 지게차, 컨베이어, 차량 문 등에 신체가 끼이거나 부딪히는 사고</p>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="border border-black bg-gray-100 font-bold p-2 text-center">재해예방대책</td>
                                            <td className="border border-black p-2 space-y-0.5">
                                                <p>1. 중량물 취급 시 보조장비 활용과 올바른 작업자세 교육으로 근골격계 부담을 최소화</p>
                                                <p>2. 작업 전 점검·안전교육·보호구 착용을 통해 기본 안전수칙을 철저히 준수</p>
                                                <p>3. 운행 전 차량점검(브레이크·타이어 등)과 안전운전 수칙 준수(과속·휴대폰 사용 금지)를 철저히 이행</p>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="border border-black bg-gray-100 font-bold p-2 text-center">위험작업<br/>신호체계</td>
                                            <td className="border border-black p-2 space-y-0.5">
                                                <p>차량 이동 및 상·하차 시 작업 전 신호를 통일하고, 모든 작업자가 준수</p>
                                                <p>위험 발생 시 즉시 '정지' 신호로 작업을 중단하고, 교육·TBM을 통해 신호체계를 상시 숙지 및 적용</p>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="border border-black bg-gray-100 font-bold p-2 text-center">비상대책</td>
                                            <td className="border border-black p-2 space-y-0.5">
                                                <p>1. 화재·교통사고·낙상 등 사고 발생 시 즉시 작업 중지 후 119 및 관리자에게 신속 보고</p>
                                                <p>2. 비상연락망 운영 및 정기 훈련을 통해 신속한 대응과 피해 최소화 체계 구축</p>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="border border-black bg-gray-100 font-bold p-2 text-center" rowSpan={2}>비상연락망</td>
                                            <td className="border border-black p-2 bg-gray-50 font-bold text-gray-700">
                                                [업체] 코끼리물류 관리자 : 010-2514-4826 관리자 권오민
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="border border-black p-2 space-y-0.5">
                                                <p><strong>[유관기관]</strong></p>
                                                <p>서울아산병원(잠실 인근) 응급실 : 02-3010-3333</p>
                                                <p>건국대학교병원 응급의료센터 : 02-2030-5555</p>
                                                <p>송파소방서 : 02-6981-2119 / 광진소방서 : 02-6981-6119</p>
                                                <p>CLS 담당자 : 010-6397-0494</p>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>

                                <div className="border border-gray-300 p-3 bg-gray-50/50 mt-2 text-center text-[9px]">
                                    <p className="text-gray-600 font-bold">위 안전보건관리계획서에 의거하여 사내 안전 수칙을 명확히 이행할 것을 확인 서명합니다.</p>
                                    <p className="mt-2 text-right text-[10px] font-extrabold text-black">서명 제출자: {activeItem.name} (전자 서명 일시: {activeItem.date})</p>
                                </div>
                            </div>
                        </div>
                    )}
                    {activeItem.formType === 'risk_assessment' && (
                        <div className="scroll-container border border-gray-100 rounded-3xl p-3 bg-gray-50/50 flex md:justify-center justify-start">
                            <div id="printable-risk-form" className="bg-white p-5 text-black border border-gray-300 w-[840px] font-sans text-[8px] leading-tight shadow-sm">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex-1 text-center font-extrabold text-base pt-3">위 험 성 평 가</div>
                                    <table className="border-collapse border border-black text-center text-[7.5px] w-[220px] shrink-0">
                                        <tbody>
                                            <tr>
                                                <td className="border border-black bg-gray-100 font-bold p-1 w-[25%]">회사명</td>
                                                <td className="border border-black p-1">코끼리 물류</td>
                                            </tr>
                                            <tr>
                                                <td className="border border-black bg-gray-100 font-bold p-1">평가일시</td>
                                                <td className="border border-black p-1">{activeItem.dateRange}</td>
                                            </tr>
                                            <tr>
                                                <td className="border border-black bg-gray-100 font-bold p-1">평가자</td>
                                                <td className="border border-black p-1">{activeItem.evaluator}</td>
                                            </tr>
                                            <tr>
                                                <td className="border border-black bg-gray-100 font-bold p-1">참여자</td>
                                                <td className="border border-black p-1 text-left leading-tight">{activeItem.participants}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <table className="w-full border-collapse border border-black text-left text-[7.5px] leading-normal">
                                    <thead>
                                        <tr className="bg-gray-100 text-center font-bold">
                                            <th className="border border-black p-1 w-[8%]" rowSpan={2}>대상</th>
                                            <th className="border border-black p-1 w-[32%]" rowSpan={2}>유해위험요인</th>
                                            <th className="border border-black p-1 w-[22%]" colSpan={3}>위험성 추정결정 및 감소대책 수립</th>
                                            <th className="border border-black p-1 w-[14%]" colSpan={2}>이행확인</th>
                                        </tr>
                                        <tr className="bg-gray-100 text-center font-bold">
                                            <th className="border border-black p-1 w-[8%]">현재위험성</th>
                                            <th className="border border-black p-1 w-[6%]">결정</th>
                                            <th className="border border-black p-1 w-[18%]">위험성감소대책</th>
                                            <th className="border border-black p-1 w-[7%]">개선예정일</th>
                                            <th className="border border-black p-1 w-[7%]">담당자</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {activeItem.checks?.map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="border border-black p-1 font-bold text-center">{item.target}</td>
                                                <td className="border border-black p-1 whitespace-pre-line">{item.hazard}</td>
                                                <td className="border border-black p-1 text-center">{item.currentRisk}</td>
                                                <td className="border border-black p-1 text-center">{item.decision}</td>
                                                <td className="border border-black p-1 whitespace-pre-line">{item.measure}</td>
                                                <td className="border border-black p-1 text-center">{item.targetDate}</td>
                                                <td className="border border-black p-1 text-center">{item.owner}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                                            {activeItem.formType === 'safety_education' && (
                        <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100 space-y-4">
                            <p className="font-bold text-blue-900">최초교육수료 파일</p>
                            {activeItem.file ? (
                                activeItem.file.includes('.pdf') || activeItem.file.startsWith('data:application/pdf') ? (
                                    <a href={activeItem.file} target="_blank" rel="noopener noreferrer" className="block text-center py-3 bg-white border border-blue-200 rounded-xl text-blue-700 font-extrabold hover:bg-blue-50 transition-colors shadow-sm">
                                        📄 PDF 파일 열기 (이수증)
                                    </a>
                                ) : (
                                    <div className="border border-blue-200 rounded-xl overflow-hidden bg-white p-2">
                                        <img src={activeItem.file} className="w-full h-auto max-h-[400px] object-contain rounded-lg" alt="교육이수증" />
                                        <div className="text-center mt-2">
                                            <a href={activeItem.file} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 font-bold hover:underline">
                                                원본 이미지로 크게 보기
                                            </a>
                                        </div>
                                    </div>
                                )
                            ) : (
                                <p className="text-gray-400 text-sm font-bold">첨부된 증빙 서류 파일이 없습니다.</p>
                            )}
                        </div>
                    )}
                    {activeItem.formType === 'accident_report' && (
                        <div className="bg-red-50/50 p-5 rounded-xl border border-red-100 space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <p><span className="font-bold text-red-900">사고 발생일:</span> {activeItem.date}{activeItem.accidentTime ? ` ${activeItem.accidentTime}` : ''}</p>
                                <p><span className="font-bold text-red-900">사고 유형:</span> {activeItem.accidentType}</p>
                                <p className="col-span-2"><span className="font-bold text-red-900">발생 장소:</span> {activeItem.location}</p>
                            </div>
                            <div>
                                <p className="font-bold text-red-900 text-sm mb-1">사고 경위</p>
                                <p className="bg-white rounded-lg p-3 border border-red-100 text-sm whitespace-pre-line">{activeItem.description}</p>
                            </div>
                            {activeItem.injuryPart && (
                                <div>
                                    <p className="font-bold text-red-900 text-sm mb-1">부상 부위 / 정도</p>
                                    <p className="bg-white rounded-lg p-3 border border-red-100 text-sm">{activeItem.injuryPart}</p>
                                </div>
                            )}
                            {activeItem.actionTaken && (
                                <div>
                                    <p className="font-bold text-red-900 text-sm mb-1">초기 조치사항</p>
                                    <p className="bg-white rounded-lg p-3 border border-red-100 text-sm whitespace-pre-line">{activeItem.actionTaken}</p>
                                </div>
                            )}
                            {activeItem.witness && (
                                <p className="text-sm"><span className="font-bold text-red-900">목격자:</span> {activeItem.witness}</p>
                            )}
                            {activeItem.file && (
                                <div className="border border-red-200 rounded-xl overflow-hidden bg-white p-2">
                                    <img src={activeItem.file} className="w-full h-auto max-h-[400px] object-contain rounded-lg" alt="사고 현장" />
                                </div>
                            )}
                        </div>
                    )}
                    {!activeItem.formType && activeItem.items?.map((it, i) => (
                        <div key={i} className={`p-4 rounded-xl border ${it.isChecked ? 'bg-green-50/30' : 'bg-red-50 text-red-700'}`}>
                            <p className="font-bold text-sm mb-1">{it.task} : {it.isChecked ? 'O' : 'X'}</p>
                            {it.memo && <p className="text-xs opacity-70 mt-2">{it.memo}</p>}
                            {it.photo && <img src={it.photo} className="mt-2 h-20 rounded" alt="snap" />}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export { SafetyDetailModal };
