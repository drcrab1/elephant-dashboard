import { notify } from './ui-feedback';
import React, { useState } from 'react';
import { auth, storage } from './firebase';
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { formatPhoneNumber, HEAVY_OBJECT_CHECKS, CARGO_WORK_PLAN_ITEMS, RISK_ASSESSMENT_ITEMS } from './safety-constants';

// --- Sub-components (Forms) ---

const FormHeavyObject = ({ user, onSubmit, onCancel }) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [writer, setWriter] = useState('권오민');
    const [workerSelect, setWorkerSelect] = useState('송파4 배송인원');
    const [customWorker, setCustomWorker] = useState('');
    const [weight, setWeight] = useState('20kg 미만');
    const [equipment, setEquipment] = useState('1톤 화물자동차');
    const [checks, setChecks] = useState(HEAVY_OBJECT_CHECKS.map(q => ({ q, answer: '양호' })));

    const finalWorker = workerSelect === '직접입력' ? customWorker : workerSelect;

    const handleSubmit = () => {
        if (!finalWorker) return notify('작업자 이름을 입력(또는 선택)해주세요.');
        onSubmit({
            formType: 'cargo_vehicle',
            date,
            writer,
            worker: finalWorker,
            weight,
            equipment,
            checks,
            status: checks.some(c => c.answer === '불량') ? '조치필요' : '정상완료'
        });
    };

    const downloadPDF = () => {
        const element = document.getElementById('printable-heavy-form-creation');
        if (!element) return;
        toJpeg(element, {
            quality: 0.98,
            style: { transform: 'none', opacity: '1', visibility: 'visible' }
        }).then(dataUrl => {
            const pdf = new jsPDF('p', 'mm', 'a4');
            pdf.addImage(dataUrl, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
            pdf.save(`중량물취급_작업계획서_${user.name}_${new Date().toISOString().split('T')[0]}.pdf`);
        }).catch(err => notify('PDF 저장 실패: ' + err.message));
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-4xl mx-auto animate-fade-in text-black font-sans">
            <h3 className="text-2xl font-extrabold mb-6 pb-4 border-b">중량물취급 작업계획서 작성</h3>
            
            <div className="scroll-container bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4">
                <div id="printable-heavy-form-creation" className="bg-white p-5 border border-gray-300 w-[700px] mx-auto text-[10px] leading-tight mb-6 shadow-sm">
                <h2 className="text-center font-extrabold text-sm border-2 border-black py-1 mb-3">중량물취급 작업계획서</h2>
                <div className="grid grid-cols-2 gap-4 mb-4 text-[9.5px]">
                    <div className="flex items-center gap-1.5">
                        <span className="shrink-0 font-bold">작성자:</span>
                        <input type="text" value={writer} disabled className="border rounded px-2 py-0.5 w-full bg-gray-50 text-gray-500 font-bold cursor-not-allowed" />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="shrink-0 font-bold">작업 일자:</span>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border rounded px-2 py-0.5 w-full bg-white text-black font-bold" />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="shrink-0 font-bold">작업자:</span>
                        <select value={workerSelect} onChange={e => setWorkerSelect(e.target.value)} className="border rounded px-2 py-0.5 w-full bg-white text-black font-bold">
                            <option value="송파4 배송인원">송파4 배송인원</option>
                            <option value="남양주4 배송인원">남양주4 배송인원</option>
                            <option value="구리2 배송인원">구리2 배송인원</option>
                            <option value="F장안 배송인원">F장안 배송인원</option>
                            <option value="직접입력">직접 입력 (추가)</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="shrink-0 font-bold">주 취급 중량물:</span>
                        <select value={weight} onChange={e => setWeight(e.target.value)} className="border rounded px-2 py-0.5 w-full bg-white text-black font-bold">
                            <option>20kg 미만</option>
                            <option>30kg 미만</option>
                            <option>20kg ~ 30kg</option>
                            <option>30kg 초과</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-1.5 col-span-2">
                        <span className="shrink-0 font-bold">운반 장비:</span>
                        <select value={equipment} onChange={e => setEquipment(e.target.value)} className="border rounded px-2 py-0.5 w-full bg-white text-black font-bold">
                            <option>1톤 화물자동차</option>
                            <option>롤테이너 (RT)</option>
                            <option>수레 (대차)</option>
                        </select>
                    </div>
                </div>

                {workerSelect === '직접입력' && (
                    <div className="mb-4">
                        <input type="text" placeholder="직접 추가 작업자 이름 입력" value={customWorker} onChange={e => setCustomWorker(e.target.value)} className="border rounded px-2 py-1 w-full bg-white text-black text-xs font-bold" />
                    </div>
                )}

                <h4 className="font-bold text-[10px] mb-2 text-blue-800 border-b pb-1">작업전점검표</h4>
                <div className="space-y-2">
                    {checks.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100">
                            <p className="font-medium text-[9.5px] flex-1 pr-4">{item.q}</p>
                            <div className="flex rounded overflow-hidden border border-gray-300 w-[100px] shrink-0 text-[9px]">
                                <button onClick={() => { const newC = [...checks]; newC[idx].answer = '양호'; setChecks(newC); }} className={`flex-1 py-1 font-bold transition-colors ${item.answer === '양호' ? 'bg-green-500 text-white' : 'bg-white text-gray-500'}`}>양호</button>
                                <button onClick={() => { const newC = [...checks]; newC[idx].answer = '불량'; setChecks(newC); }} className={`flex-1 py-1 font-bold transition-colors ${item.answer === '불량' ? 'bg-red-500 text-white' : 'bg-white text-gray-500'}`}>불량</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            </div>

            <div className="flex gap-4">
                <button onClick={onCancel} className="flex-1 py-3.5 rounded-xl border font-bold text-gray-600 hover:bg-gray-50">취소</button>
                <button onClick={downloadPDF} className="flex-1 py-3.5 rounded-xl border border-blue-200 text-blue-600 font-bold hover:bg-blue-50 transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-sm">
                    📥 PDF 다운로드
                </button>
                <button onClick={handleSubmit} className="flex-[2] py-3.5 rounded-xl bg-blue-600 text-white font-extrabold hover:bg-blue-700 shadow-md">작업계획서 제출 및 서명</button>
            </div>
        </div>
    );
};

const FormCargoVehicle = ({ user, onSubmit, onCancel }) => {
    const [workName, setWorkName] = useState('택배화물 상 하차 및 배송작업');
    const [workPeriod, setWorkPeriod] = useState('26년1월~12월');
    const [companyName, setCompanyName] = useState('코끼리물류');
    const [workerNames, setWorkerNames] = useState('김성준외11명');
    const [driverName, setDriverName] = useState('김성준외11명');
    const [driverPhone, setDriverPhone] = useState('010-5197-9193');
    const [guideName, setGuideName] = useState('권오민');
    const [guidePhone, setGuidePhone] = useState('010-2514-4826');
    const [preSurvey, setPreSurvey] = useState('차량 출입구, 상 하차장, 주차구역위치확인, 보행자 이동 통로 및 차량운행 동선확인, 작업장내 제한속도 확인, 경사로, 과속방지턱, 협소구간등 위험구간확인');
    const [machineSpecs, setMachineSpecs] = useState('1T 화물자동차 12대');
    const [checks, setChecks] = useState(CARGO_WORK_PLAN_ITEMS.map(i => ({ ...i, answer: '적정', action: '' })));

    const handleCheckChange = (idx, field, value) => {
        setChecks(prev => prev.map(c => c.idx === idx ? { ...c, [field]: value } : c));
    };

    const downloadPDF = () => {
        const element = document.getElementById('printable-cargo-form-creation');
        if (!element) return;
        toJpeg(element, {
            quality: 0.98,
            style: { transform: 'none', opacity: '1', visibility: 'visible' }
        }).then(dataUrl => {
            const pdf = new jsPDF('p', 'mm', 'a4');
            pdf.addImage(dataUrl, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
            pdf.save(`화물자동차_작업계획서_${user.name}_${new Date().toISOString().split('T')[0]}.pdf`);
        }).catch(err => notify('PDF 저장 실패: ' + err.message));
    };

    const handleSubmit = () => {
        onSubmit({
            formType: 'heavy_object',
            date: new Date().toISOString().split('T')[0],
            workName,
            workPeriod,
            companyName,
            workerNames,
            driverName,
            driverPhone,
            guideName,
            guidePhone,
            preSurvey,
            machineSpecs,
            checks,
            status: checks.some(c => c.answer === '부적정') ? '조치필요' : '정상완료'
        });
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 max-w-5xl mx-auto animate-fade-in text-black font-sans">
            <h3 className="text-xl font-extrabold mb-4 pb-2 border-b text-blue-800">화물자동차 작업계획서 작성</h3>
            
            <div className="scroll-container bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4">
                <div id="printable-cargo-form-creation" className="bg-white p-5 border border-gray-300 w-[800px] mx-auto text-[9px] leading-tight">
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex-1 text-center pt-2">
                            <h1 className="font-extrabold text-base border-b-2 border-black pb-1 inline-block">화물자동차 작업계획서</h1>
                            <p className="text-[10px] text-gray-500 mt-1">- 차량계 하역운반기계 -</p>
                        </div>
                        <table className="border-collapse border border-black text-center text-[8.5px] w-[120px] shrink-0">
                            <tbody>
                                <tr>
                                    <td className="border border-black bg-gray-100 font-bold p-1 w-[40%]">작성자</td>
                                    <td className="border border-black p-1 relative min-w-[70px]">
                                        권오민
                                        <span className="absolute right-1.5 top-0.5"><img src="/admin_seal.png" className="w-4 h-4 object-contain" alt="도장" /></span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <table className="w-full border-collapse border border-black text-left text-[8.5px] mb-3">
                        <tbody>
                            <tr>
                                <td className="border border-black bg-gray-100 font-bold p-1.5 text-center w-[15%]">작업명(장소)</td>
                                <td className="border border-black p-1 w-[45%] bg-white">
                                    <input type="text" value={workName} onChange={e => setWorkName(e.target.value)} className="w-full border border-gray-300 rounded px-1 py-0.5 text-[8.5px] font-bold" />
                                </td>
                                <td className="border border-black bg-gray-100 font-bold p-1.5 text-center w-[15%]">작업기간</td>
                                <td className="border border-black p-1 w-[25%] bg-white">
                                    <input type="text" value={workPeriod} onChange={e => setWorkPeriod(e.target.value)} className="w-full border border-gray-300 rounded px-1 py-0.5 text-[8.5px] font-bold" />
                                </td>
                            </tr>
                            <tr>
                                <td className="border border-black bg-gray-100 font-bold p-1.5 text-center">작업업체/작업자</td>
                                <td className="border border-black p-1 bg-white" colSpan={3}>
                                    <div className="flex gap-4 items-center">
                                        <div className="flex items-center gap-1">
                                            <span className="font-bold shrink-0">업체명:</span>
                                            <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} className="border border-gray-300 rounded px-1 py-0.5 text-[8.5px] font-bold w-[120px]" />
                                        </div>
                                        <div className="flex items-center gap-1 flex-1">
                                            <span className="font-bold shrink-0">작업자:</span>
                                            <input type="text" value={workerNames} onChange={e => setWorkerNames(e.target.value)} className="border border-gray-300 rounded px-1 py-0.5 text-[8.5px] font-bold w-full" />
                                        </div>
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td className="border border-black bg-gray-100 font-bold p-1.5 text-center">운전원</td>
                                <td className="border border-black p-1 bg-white" colSpan={3}>
                                    <div className="flex gap-4 items-center">
                                        <div className="flex items-center gap-1">
                                            <span className="font-bold shrink-0">성명:</span>
                                            <input type="text" value={driverName} onChange={e => setDriverName(e.target.value)} className="border border-gray-300 rounded px-1 py-0.5 text-[8.5px] font-bold w-[120px]" />
                                        </div>
                                        <div className="flex items-center gap-1 flex-1">
                                            <span className="font-bold shrink-0">연락처:</span>
                                            <input type="text" value={driverPhone} onChange={e => setDriverPhone(formatPhoneNumber(e.target.value))} className="border border-gray-300 rounded px-1 py-0.5 text-[8.5px] font-bold w-full" />
                                        </div>
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td className="border border-black bg-gray-100 font-bold p-1.5 text-center">유도자</td>
                                <td className="border border-black p-1 bg-white" colSpan={3}>
                                    <div className="flex gap-4 items-center">
                                        <div className="flex items-center gap-1">
                                            <span className="font-bold shrink-0">성명:</span>
                                            <input type="text" value={guideName} onChange={e => setGuideName(e.target.value)} className="border border-gray-300 rounded px-1 py-0.5 text-[8.5px] font-bold w-[120px]" />
                                        </div>
                                        <div className="flex items-center gap-1 flex-1">
                                            <span className="font-bold shrink-0">연락처:</span>
                                            <input type="text" value={guidePhone} onChange={e => setGuidePhone(formatPhoneNumber(e.target.value))} className="border border-gray-300 rounded px-1 py-0.5 text-[8.5px] font-bold w-full" />
                                        </div>
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td className="border border-black bg-gray-100 font-bold p-1.5 text-center">사전조사 내용</td>
                                <td className="border border-black p-1 bg-white" colSpan={3}>
                                    <textarea value={preSurvey} onChange={e => setPreSurvey(e.target.value)} className="w-full border border-gray-300 rounded p-1 text-[8px] leading-tight" rows={2} />
                                </td>
                            </tr>
                            <tr>
                                <td className="border border-black bg-gray-100 font-bold p-1.5 text-center">기계ㆍ장비 제원</td>
                                <td className="border border-black p-1 bg-white" colSpan={3}>
                                    <input type="text" value={machineSpecs} onChange={e => setMachineSpecs(e.target.value)} className="w-full border border-gray-300 rounded px-1 py-0.5 text-[8.5px] font-bold" />
                                </td>
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
                            {checks.map(c => (
                                <tr key={c.idx}>
                                    {c.idx === 1 && <td className="border border-black p-1 font-bold text-center" rowSpan={1}>운전자 자격</td>}
                                    {c.idx === 2 && <td className="border border-black p-1 font-bold text-center" rowSpan={1}>기계 검사</td>}
                                    {c.idx === 3 && <td className="border border-black p-1 font-bold text-center" rowSpan={5}>작업 전 조치</td>}
                                    {c.idx === 8 && <td className="border border-black p-1 font-bold text-center" rowSpan={7}>운행 및 작업 중 조치</td>}
                                    {c.idx === 15 && <td className="border border-black p-1 font-bold text-center" rowSpan={2}>수리 등 점검 시</td>}
                                    <td className="border border-black p-1 whitespace-pre-line">{c.q}</td>
                                    <td className="border border-black p-0.5 text-center bg-white">
                                        <input type="checkbox" checked={c.answer === '적정'} onChange={() => handleCheckChange(c.idx, 'answer', '적정')} className="w-3.5 h-3.5 cursor-pointer" />
                                    </td>
                                    <td className="border border-black p-0.5 text-center bg-white">
                                        <input type="checkbox" checked={c.answer === '부적정'} onChange={() => handleCheckChange(c.idx, 'answer', '부적정')} className="w-3.5 h-3.5 cursor-pointer" />
                                    </td>
                                    <td className="border border-black p-0.5 bg-white">
                                        <input type="text" value={c.action} onChange={e => handleCheckChange(c.idx, 'action', e.target.value)} className="w-full text-center border-0 bg-transparent text-[8px]" placeholder="조치 내용" />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex gap-4">
                <button onClick={onCancel} className="flex-1 py-3 bg-white border rounded-xl font-bold hover:bg-gray-50 text-xs">돌아가기</button>
                <button onClick={downloadPDF} className="flex-1 py-3 rounded-xl border border-blue-200 text-blue-600 font-bold hover:bg-blue-50 transition-all flex items-center justify-center gap-1 active:scale-95 shadow-sm text-xs">
                    📥 PDF 다운로드
                </button>
                <button onClick={handleSubmit} className="flex-[2] py-3 rounded-xl bg-brand text-white font-extrabold hover:bg-blue-700 shadow-md text-xs">작업계획서 저장</button>
            </div>
        </div>
    );
};

const SignaturePad = ({ value, onChange }) => {
    const canvasRef = React.useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);

    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        if (value) {
            const img = new Image();
            img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
            };
            img.src = value;
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }, [value]);

    const getEventPos = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        
        if (e.touches && e.touches.length > 0) {
            return {
                x: e.touches[0].clientX - rect.left,
                y: e.touches[0].clientY - rect.top
            };
        }
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const startDrawing = (e) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const pos = getEventPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const pos = getEventPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        const canvas = canvasRef.current;
        if (canvas) {
            onChange(canvas.toDataURL());
        }
    };

    const clearCanvas = (e) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        onChange('');
    };

    return (
        <div className="flex flex-col gap-2 w-full max-w-[320px] mx-auto border border-gray-200 rounded-2xl p-3 bg-gray-50/50 my-4">
            <div className="flex justify-between items-center text-xs font-bold text-gray-500 mb-1">
                <span>✍️ 조사 확인 서명 (손가락/터치 드로잉)</span>
                <button onClick={clearCanvas} className="text-red-500 hover:text-red-700 bg-red-50 px-2 py-0.5 rounded font-extrabold">지우기</button>
            </div>
            <canvas
                ref={canvasRef}
                width={300}
                height={120}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="bg-white border rounded-xl cursor-crosshair touch-none"
            />
        </div>
    );
};

const FormMusculoskeletal = ({ user, onSubmit, onCancel }) => {
    const [step, setStep] = useState(1);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // 1. Demographics Form State
    const [name, setName] = useState(user?.name || '');
    const [age, setAge] = useState('');
    const [gender, setGender] = useState('남');
    const [careerYears, setCareerYears] = useState('');
    const [careerMonths, setCareerMonths] = useState('');
    const [deptPart, setDeptPart] = useState('');
    const [deptLine, setDeptLine] = useState('');
    const [deptTask, setDeptTask] = useState('');
    const [maritalStatus, setMaritalStatus] = useState('미혼');
    
    const [currentJobDesc, setCurrentJobDesc] = useState('');
    const [currentJobYears, setCurrentJobYears] = useState('');
    const [currentJobMonths, setCurrentJobMonths] = useState('');
    
    const [workHours, setWorkHours] = useState('');
    const [breakTime, setBreakTime] = useState('');
    const [breakCount, setBreakCount] = useState('');
    
    const [prevJobDesc, setPrevJobDesc] = useState('');
    const [prevJobYears, setPrevJobYears] = useState('');
    const [prevJobMonths, setPrevJobMonths] = useState('');

    // 2. Miscellaneous Form State
    const [hobbyActivities, setHobbyActivities] = useState({
        computer: false,
        instrument: false,
        handcraft: false,
        sports: false,
        none: true
    });
    const [houseworkHours, setHouseworkHours] = useState('거의 하지 않는다');
    
    const [hasDisease, setHasDisease] = useState('아니오');
    const [diseaseType, setDiseaseType] = useState({
        rheumatism: false,
        diabetes: false,
        lupus: false,
        gout: false,
        alcoholism: false
    });
    const [diseaseStatus, setDiseaseStatus] = useState('완치');

    const [hasInjuryHistory, setHasInjuryHistory] = useState('아니오');
    const [injuryParts, setInjuryParts] = useState({
        hand: false,
        elbow: false,
        shoulder: false,
        neck: false,
        back: false,
        leg: false
    });
    
    const [physicalLoad, setPhysicalLoad] = useState('견딜만 함');

    // 3. Pain Symptoms Survey State
    const [hasPain, setHasPain] = useState('아니오');
    const [signature, setSignature] = useState('');
    
    // Pain details for each of the 6 areas: neck, shoulder, elbow, wrist, back, leg
    const bodyAreas = [
        { key: 'neck', label: '목' },
        { key: 'shoulder', label: '어깨' },
        { key: 'elbow', label: '팔꿈치' },
        { key: 'wrist', label: '손/손목/손가락' },
        { key: 'back', label: '허리' },
        { key: 'leg', label: '다리/발' }
    ];

    const [painDetails, setPainDetails] = useState({
        neck: { checked: false, side: '양쪽', duration: '1일 미만', intensity: '약한 통증', frequency: '6개월에 1번', currentWeek: '아니오', effect: { hospital: false, meds: false, compensation: false, job_change: false, none: true, other: '' } },
        shoulder: { checked: false, side: '양쪽', duration: '1일 미만', intensity: '약한 통증', frequency: '6개월에 1번', currentWeek: '아니오', effect: { hospital: false, meds: false, compensation: false, job_change: false, none: true, other: '' } },
        elbow: { checked: false, side: '양쪽', duration: '1일 미만', intensity: '약한 통증', frequency: '6개월에 1번', currentWeek: '아니오', effect: { hospital: false, meds: false, compensation: false, job_change: false, none: true, other: '' } },
        wrist: { checked: false, side: '양쪽', duration: '1일 미만', intensity: '약한 통증', frequency: '6개월에 1번', currentWeek: '아니오', effect: { hospital: false, meds: false, compensation: false, job_change: false, none: true, other: '' } },
        back: { checked: false, side: '양쪽', duration: '1일 미만', intensity: '약한 통증', frequency: '6개월에 1번', currentWeek: '아니오', effect: { hospital: false, meds: false, compensation: false, job_change: false, none: true, other: '' } },
        leg: { checked: false, side: '양쪽', duration: '1일 미만', intensity: '약한 통증', frequency: '6개월에 1번', currentWeek: '아니오', effect: { hospital: false, meds: false, compensation: false, job_change: false, none: true, other: '' } }
    });

    const toggleHobby = (key) => {
        setHobbyActivities(prev => {
            if (key === 'none') {
                return { computer: false, instrument: false, handcraft: false, sports: false, none: true };
            } else {
                return { ...prev, [key]: !prev[key], none: false };
            }
        });
    };

    const toggleDiseaseType = (key) => {
        setDiseaseType(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const toggleInjuryPart = (key) => {
        setInjuryParts(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const updatePainField = (areaKey, field, val) => {
        setPainDetails(prev => ({
            ...prev,
            [areaKey]: {
                ...prev[areaKey],
                [field]: val
            }
        }));
    };

    const updatePainEffect = (areaKey, effectKey, val) => {
        setPainDetails(prev => {
            const currentEffect = { ...prev[areaKey].effect };
            if (effectKey === 'none') {
                return {
                    ...prev,
                    [areaKey]: {
                        ...prev[areaKey],
                        effect: { hospital: false, meds: false, compensation: false, job_change: false, none: true, other: '' }
                    }
                };
            } else {
                currentEffect[effectKey] = val;
                currentEffect.none = false;
                return {
                    ...prev,
                    [areaKey]: {
                        ...prev[areaKey],
                        effect: currentEffect
                    }
                };
            }
        });
    };

    const handleNext = () => {
        if (step === 1) {
            if (!name || !age || !deptTask) return notify('필수 입력란(*표시)을 모두 기재해 주세요.');
            setStep(2);
        } else if (step === 2) {
            setStep(3);
        }
    };

    const handleSubmit = () => {
        const hazardArray = [];
        if (hasPain === '예') {
            bodyAreas.forEach(a => {
                if (painDetails[a.key].checked) hazardArray.push(a.label);
            });
        }
        onSubmit({
            formType: 'musculo',
            date,
            signature,
            surveyData: {
                demographics: {
                    name, age, gender, careerYears, careerMonths, deptPart, deptLine, deptTask, maritalStatus,
                    currentJobDesc, currentJobYears, currentJobMonths,
                    workHours, breakTime, breakCount,
                    prevJobDesc, prevJobYears, prevJobMonths
                },
                miscellaneous: {
                    hobbyActivities, houseworkHours, hasDisease, diseaseType, diseaseStatus,
                    hasInjuryHistory, injuryParts, physicalLoad
                },
                hasPain,
                painDetails
            },
            status: hasPain === '예' && hazardArray.length > 0 ? `증상있음(${hazardArray.join(',')})` : '정상완료'
        });
    };

    return (
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 md:p-8 max-w-4xl mx-auto animate-fade-in font-sans">
            <div className="border-b pb-4 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h3 className="text-[22px] font-extrabold text-ink">근골격계질환 증상조사표 작성</h3>
                    <p className="text-[13px] text-gray-500 font-medium mt-1">산업안전보건법에 의거하여 작업자의 신체 상태 조사를 실시합니다.</p>
                </div>
                <div className="flex gap-1.5 bg-gray-50 p-1 rounded-xl border">
                    <button onClick={() => step > 1 && setStep(1)} className={`px-3 py-1 text-xs font-bold rounded-lg ${step === 1 ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>1. 인적사항</button>
                    <button onClick={() => step > 2 && setStep(2)} className={`px-3 py-1 text-xs font-bold rounded-lg ${step === 2 ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>2. 작업환경</button>
                    <button className={`px-3 py-1 text-xs font-bold rounded-lg ${step === 3 ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>3. 증상조사</button>
                </div>
            </div>

            {/* STEP 1: DEMOGRAPHICS */}
            {step === 1 && (
                <div className="space-y-6">
                    <h4 className="font-extrabold text-[16px] text-brand-dark bg-blue-50/50 p-3.5 rounded-xl border border-blue-100">Ⅰ. 아래 사항을 직접 기입해 주시기 바랍니다.</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-bold text-brand-dark">조사/작성일자 *</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border border-gray-200 rounded-xl p-3 bg-white outline-none focus:border-blue-500 transition-all text-sm font-bold text-black cursor-pointer shadow-sm" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-bold text-gray-700">성명 *</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 focus:bg-white outline-none focus:border-blue-500 transition-all text-sm font-bold" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-bold text-gray-700">연령 *</label>
                            <div className="flex items-center gap-2">
                                <input type="number" placeholder="예: 35" value={age} onChange={e => setAge(e.target.value)} className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 focus:bg-white outline-none focus:border-blue-500 transition-all text-sm font-bold w-full" />
                                <span className="font-bold text-gray-500 text-sm whitespace-nowrap">세</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-bold text-gray-700">성별 *</label>
                            <div className="flex gap-2 p-1.5 border border-gray-200 rounded-xl bg-gray-50/50">
                                <button onClick={() => setGender('남')} className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all ${gender === '남' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>남성</button>
                                <button onClick={() => setGender('여')} className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all ${gender === '여' ? 'bg-white shadow-sm text-pink-600' : 'text-gray-500'}`}>여성</button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-bold text-gray-700">현 직종 경력</label>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 w-full">
                                    <input type="number" placeholder="년" value={careerYears} onChange={e => setCareerYears(e.target.value)} className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 focus:bg-white text-sm font-bold text-center w-full" />
                                    <span className="text-xs font-bold text-gray-400">년</span>
                                </div>
                                <div className="flex items-center gap-1 w-full">
                                    <input type="number" placeholder="개월" value={careerMonths} onChange={e => setCareerMonths(e.target.value)} className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 focus:bg-white text-sm font-bold text-center w-full" />
                                    <span className="text-xs font-bold text-gray-400">개월</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1.5 md:col-span-2">
                            <label className="text-sm font-bold text-gray-700">작업 부서 및 라인 / 수행 작업 *</label>
                            <div className="grid grid-cols-3 gap-2">
                                <input type="text" placeholder="부서" value={deptPart} onChange={e => setDeptPart(e.target.value)} className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 focus:bg-white text-xs font-bold" />
                                <input type="text" placeholder="라인" value={deptLine} onChange={e => setDeptLine(e.target.value)} className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 focus:bg-white text-xs font-bold" />
                                <input type="text" placeholder="수행작업" value={deptTask} onChange={e => setDeptTask(e.target.value)} className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 focus:bg-white text-xs font-bold" />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-bold text-gray-700">결혼 여부</label>
                            <div className="flex gap-2 p-1.5 border border-gray-200 rounded-xl bg-gray-50/50">
                                <button onClick={() => setMaritalStatus('기혼')} className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all ${maritalStatus === '기혼' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>기혼</button>
                                <button onClick={() => setMaritalStatus('미혼')} className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all ${maritalStatus === '미혼' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-500'}`}>미혼</button>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1.5 md:col-span-2">
                            <label className="text-sm font-bold text-gray-700">현재 하고 있는 작업 (구체적으로)</label>
                            <div className="flex gap-2">
                                <input type="text" placeholder="구체적인 작업 내용" value={currentJobDesc} onChange={e => setCurrentJobDesc(e.target.value)} className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 focus:bg-white text-xs font-bold flex-1" />
                                <div className="flex items-center gap-1 shrink-0 w-[160px]">
                                    <input type="number" placeholder="년" value={currentJobYears} onChange={e => setCurrentJobYears(e.target.value)} className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 focus:bg-white text-xs font-bold text-center w-full" />
                                    <span className="text-xs font-bold text-gray-400">년</span>
                                    <input type="number" placeholder="월" value={currentJobMonths} onChange={e => setCurrentJobMonths(e.target.value)} className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 focus:bg-white text-xs font-bold text-center w-full" />
                                    <span className="text-xs font-bold text-gray-400">월</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-bold text-gray-700">1일 근무시간 및 휴식시간</label>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="flex items-center gap-1">
                                    <input type="number" placeholder="시간" value={workHours} onChange={e => setWorkHours(e.target.value)} className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 focus:bg-white text-xs font-bold text-center w-full" />
                                    <span className="text-[11px] font-bold text-gray-400 whitespace-nowrap">시간</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <input type="number" placeholder="분" value={breakTime} onChange={e => setBreakTime(e.target.value)} className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 focus:bg-white text-xs font-bold text-center w-full" />
                                    <span className="text-[11px] font-bold text-gray-400 whitespace-nowrap">분씩</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <input type="number" placeholder="회" value={breakCount} onChange={e => setBreakCount(e.target.value)} className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 focus:bg-white text-xs font-bold text-center w-full" />
                                    <span className="text-[11px] font-bold text-gray-400 whitespace-nowrap">회 휴식</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-bold text-gray-700">현 직무 전 가졌던 직업 및 기간</label>
                            <div className="flex gap-2">
                                <input type="text" placeholder="과거 업무명" value={prevJobDesc} onChange={e => setPrevJobDesc(e.target.value)} className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 focus:bg-white text-xs font-bold flex-1" />
                                <div className="flex items-center gap-1 shrink-0 w-[140px]">
                                    <input type="number" placeholder="년" value={prevJobYears} onChange={e => setPrevJobYears(e.target.value)} className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 focus:bg-white text-xs font-bold text-center w-full" />
                                    <span className="text-xs font-bold text-gray-400">년</span>
                                    <input type="number" placeholder="월" value={prevJobMonths} onChange={e => setPrevJobMonths(e.target.value)} className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 focus:bg-white text-xs font-bold text-center w-full" />
                                    <span className="text-xs font-bold text-gray-400">월</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 2: MISCELLANEOUS */}
            {step === 2 && (
                <div className="space-y-6">
                    <h4 className="font-extrabold text-[16px] text-brand-dark bg-blue-50/50 p-3.5 rounded-xl border border-blue-100">Ⅱ. 기타 사항</h4>
                    
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-gray-700">1. 규칙적인 여가 및 취미 활동 (한번에 30분 이상, 1주일에 적어도 2-3회 이상) 취미가 있는 항목을 선택해 주십시오.</label>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                            {[
                                { key: 'computer', label: '게임 등 컴퓨터 관련 활동' },
                                { key: 'instrument', label: '피아노, 드럼 등 악기 연주' },
                                { key: 'handcraft', label: '뜨개질, 붓글씨 등' },
                                { key: 'sports', label: '테니스, 축구 등 스포츠 활동' },
                                { key: 'none', label: '해당사항 없음' }
                            ].map(h => (
                                <button key={h.key} onClick={() => toggleHobby(h.key)} className={`p-3 border rounded-xl text-xs font-bold transition-all ${hobbyActivities[h.key] ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-gray-50/50 border-gray-200 text-gray-500'}`}>{h.label}</button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-bold text-gray-700">2. 귀하의 하루 평균 가사노동 시간 (밥하기, 빨래하기, 청소하기, 아기돌보기 등)</label>
                            <select value={houseworkHours} onChange={e => setHouseworkHours(e.target.value)} className="border border-gray-200 rounded-xl p-3.5 bg-gray-50 text-sm font-bold outline-none focus:border-blue-500">
                                <option>거의 하지 않는다</option>
                                <option>1시간 미만</option>
                                <option>1-2시간 미만</option>
                                <option>2-3시간 미만</option>
                                <option>3시간 이상</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-bold text-gray-700">5. 현재 하시는 일의 육체적 부담 정도는 어느 정도라고 생각 합니까?</label>
                            <select value={physicalLoad} onChange={e => setPhysicalLoad(e.target.value)} className="border border-gray-200 rounded-xl p-3.5 bg-gray-50 text-sm font-bold outline-none focus:border-blue-500">
                                <option>전혀 힘들지 않음</option>
                                <option>견딜만 함</option>
                                <option>약간 힘들음</option>
                                <option>힘들음</option>
                                <option>매우 힘들음</option>
                            </select>
                        </div>
                    </div>

                    <div className="p-4 border rounded-2xl bg-gray-50/50 space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                            <label className="text-sm font-bold text-gray-700">3. 귀하는 의사로부터 다음과 같은 질병에 대해 진단을 받은 적이 있습니까?</label>
                            <div className="flex gap-2 border p-1 rounded-xl bg-white w-fit shrink-0">
                                <button onClick={() => setHasDisease('아니오')} className={`px-4 py-1 text-xs font-bold rounded-lg ${hasDisease === '아니오' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>아니오</button>
                                <button onClick={() => setHasDisease('예')} className={`px-4 py-1 text-xs font-bold rounded-lg ${hasDisease === '예' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>예</button>
                            </div>
                        </div>
                        {hasDisease === '예' && (
                            <div className="pt-3 border-t space-y-4 animate-fade-in">
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                    {[
                                        { key: 'rheumatism', label: '류머티스 관절염' },
                                        { key: 'diabetes', label: '당뇨병' },
                                        { key: 'lupus', label: '루프스병' },
                                        { key: 'gout', label: '통풍' },
                                        { key: 'alcoholism', label: '알코올중독' }
                                    ].map(d => (
                                        <button key={d.key} onClick={() => toggleDiseaseType(d.key)} className={`p-2.5 border rounded-xl text-[11px] font-bold transition-all ${diseaseType[d.key] ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-200 text-gray-500'}`}>{d.label}</button>
                                    ))}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-bold text-gray-500 whitespace-nowrap">('예'인 경우 현재 상태는?):</span>
                                    <div className="flex gap-1.5 p-1 bg-white border rounded-xl w-fit">
                                        <button onClick={() => setDiseaseStatus('완치')} className={`px-3 py-1 text-xs font-bold rounded-lg ${diseaseStatus === '완치' ? 'bg-blue-50 text-blue-700' : 'text-gray-400'}`}>완치</button>
                                        <button onClick={() => setDiseaseStatus('치료나 관찰 중')} className={`px-3 py-1 text-xs font-bold rounded-lg ${diseaseStatus === '치료나 관찰 중' ? 'bg-blue-50 text-blue-700' : 'text-gray-400'}`}>치료나 관찰 중</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 border rounded-2xl bg-gray-50/50 space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                            <label className="text-sm font-bold text-gray-700">4. 과거에 운동 중 혹은 사고(교통사고, 넘어짐, 추락 등)로 인해 손/손가락, 팔/팔꿈치, 어깨, 목, 허리, 다리/발 부위를 다친 적이 있습니까?</label>
                            <div className="flex gap-2 border p-1 rounded-xl bg-white w-fit shrink-0">
                                <button onClick={() => setHasInjuryHistory('아니오')} className={`px-4 py-1 text-xs font-bold rounded-lg ${hasInjuryHistory === '아니오' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>아니오</button>
                                <button onClick={() => setHasInjuryHistory('예')} className={`px-4 py-1 text-xs font-bold rounded-lg ${hasInjuryHistory === '예' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>예</button>
                            </div>
                        </div>
                        {hasInjuryHistory === '예' && (
                            <div className="pt-3 border-t space-y-2 animate-fade-in">
                                <p className="text-xs font-bold text-gray-500 mb-2">상해 부위 선택:</p>
                                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                                    {[
                                        { key: 'hand', label: '손/손가락/손목' },
                                        { key: 'elbow', label: '팔/팔꿈치' },
                                        { key: 'shoulder', label: '어깨' },
                                        { key: 'neck', label: '목' },
                                        { key: 'back', label: '허리' },
                                        { key: 'leg', label: '다리/발' }
                                    ].map(i => (
                                        <button key={i.key} onClick={() => toggleInjuryPart(i.key)} className={`p-2.5 border rounded-xl text-[11px] font-bold transition-all ${injuryParts[i.key] ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-200 text-gray-500'}`}>{i.label}</button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* STEP 3: PAIN SYMPTOMS SURVEY */}
            {step === 3 && (
                <div className="space-y-6">
                    <h4 className="font-extrabold text-[16px] text-red-700 bg-red-50/50 p-3.5 rounded-xl border border-red-100">
                        Ⅲ. 지난 1년 동안 손/손가락/손목, 팔/팔꿈치, 어깨, 목, 허리, 다리/발 중 어느 한 부위에서 귀하의 작업과 관련하여 통증이나 불편함(통증, 쑤시는 느낌, 뻣뻣함, 화끈거리는 느낌, 무감각 혹은 찌릿찌릿함 등)을 느끼신 적이 있습니까?
                    </h4>
                    
                    <div className="flex items-center justify-center gap-4 py-4 bg-gray-50/50 border rounded-2xl">
                        <button onClick={() => setHasPain('아니오')} className={`flex items-center gap-2 px-8 py-3.5 rounded-2xl border font-bold text-sm transition-all ${hasPain === '아니오' ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-105' : 'bg-white text-gray-600'}`}>아니오 (설문 완료)</button>
                        <button onClick={() => setHasPain('예')} className={`flex items-center gap-2 px-8 py-3.5 rounded-2xl border font-bold text-sm transition-all ${hasPain === '예' ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-105' : 'bg-white text-gray-600'}`}>예 (상세 기재)</button>
                    </div>

                    {hasPain === '예' && (
                        <div className="space-y-8 animate-fade-in pt-4">
                            <p className="text-xs font-bold text-red-500">※ 아래 통증부위에 체크하고 세로줄로 내려가며 문항에 체크(V)해 주십시오.</p>
                            
                            {bodyAreas.map(area => (
                                <div key={area.key} className="border border-gray-100 rounded-3xl p-5 bg-white shadow-sm space-y-4">
                                    <label className="flex items-center gap-3 cursor-pointer bg-slate-50 p-3 rounded-2xl border border-slate-100 hover:bg-slate-100/50 transition-colors">
                                        <input type="checkbox" checked={painDetails[area.key].checked} onChange={e => updatePainField(area.key, 'checked', e.target.checked)} className="w-5 h-5 text-blue-600 rounded" />
                                        <span className="font-extrabold text-[16px] text-slate-800">{area.label} 부위 통증 있음</span>
                                    </label>

                                    {painDetails[area.key].checked && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-3 pl-3 border-l-2 border-blue-500 animate-fade-in">
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-xs font-bold text-gray-600">1. 통증의 구체적 부위는?</label>
                                                <div className="flex gap-1.5 p-1 bg-gray-50 border rounded-xl w-fit">
                                                    {['오른쪽', '왼쪽', '양쪽'].map(opt => (
                                                        <button key={opt} onClick={() => updatePainField(area.key, 'side', opt)} className={`px-4 py-1.5 text-xs font-bold rounded-lg ${painDetails[area.key].side === opt ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>{opt}</button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-xs font-bold text-gray-600">2. 한번 아프면 통증 지속 기간은?</label>
                                                <select value={painDetails[area.key].duration} onChange={e => updatePainField(area.key, 'duration', e.target.value)} className="border border-gray-200 rounded-xl p-2 bg-gray-50 text-xs font-bold outline-none">
                                                    <option>1일 미만</option>
                                                    <option>1일-1주일 미만</option>
                                                    <option>1주일-1개월 미만</option>
                                                    <option>1개월-6개월 미만</option>
                                                    <option>6개월 이상</option>
                                                </select>
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-xs font-bold text-gray-600">3. 한번 아프면 통증 강도는?</label>
                                                <select value={painDetails[area.key].intensity} onChange={e => updatePainField(area.key, 'intensity', e.target.value)} className="border border-gray-200 rounded-xl p-2 bg-gray-50 text-xs font-bold outline-none">
                                                    <option>약한 통증</option>
                                                    <option>중간 통증</option>
                                                    <option>심한 통증</option>
                                                    <option>매우 심한 통증</option>
                                                </select>
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-xs font-bold text-gray-600">4. 지난 1년 동안 이러한 증상을 얼마나 자주 경험하셨습니까?</label>
                                                <select value={painDetails[area.key].frequency} onChange={e => updatePainField(area.key, 'frequency', e.target.value)} className="border border-gray-200 rounded-xl p-2 bg-gray-50 text-xs font-bold outline-none">
                                                    <option>6개월에 1번</option>
                                                    <option>2-3달에 1번</option>
                                                    <option>1달에 1번</option>
                                                    <option>1주일에 1번</option>
                                                    <option>매일</option>
                                                </select>
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-xs font-bold text-gray-600">5. 지난 1주일 동안에도 이러한 증상이 있었습니까?</label>
                                                <div className="flex gap-1.5 p-1 bg-gray-50 border rounded-xl w-fit">
                                                    {['아니오', '예'].map(opt => (
                                                        <button key={opt} onClick={() => updatePainField(area.key, 'currentWeek', opt)} className={`px-4 py-1.5 text-xs font-bold rounded-lg ${painDetails[area.key].currentWeek === opt ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>{opt}</button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-1.5 sm:col-span-2">
                                                <label className="text-xs font-bold text-gray-600">6. 지난 1년 동안 이러한 증상으로 인해 어떤 일이 있었습니까? (중복 선택)</label>
                                                <div className="flex flex-wrap gap-2 pt-1">
                                                    {[
                                                        { k: 'hospital', l: '병원·의원 치료' },
                                                        { k: 'meds', l: '약 복용' },
                                                        { k: 'compensation', l: '산재 요양' },
                                                        { k: 'job_change', l: '작업 전환' },
                                                        { k: 'none', l: '해당사항 없음' }
                                                    ].map(opt => (
                                                        <button key={opt.k} onClick={() => updatePainEffect(area.key, opt.k, !painDetails[area.key].effect[opt.k])} className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition-all ${painDetails[area.key].effect[opt.k] ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-200 text-gray-500'}`}>{opt.l}</button>
                                                    ))}
                                                    <input type="text" placeholder="기타 직접 기재" value={painDetails[area.key].effect.other} onChange={e => updatePainEffect(area.key, 'other', e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold w-full sm:w-[200px]" />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    <SignaturePad value={signature} onChange={setSignature} />

                    <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl text-xs space-y-2 text-slate-500 font-medium">
                        <p className="font-bold text-slate-700">※ 유의사항</p>
                        <p>- 부담작업을 수행하는 근로자가 직접 읽어보고 문항을 체크합니다.</p>
                        <p>- 증상조사표를 작성할 경우 증상을 과대 또는 과소 평가 해서는 안됩니다.</p>
                        <p>- 증상조사 결과는 근골격계질환의 예방 또는 입증하는 근거나 반증자료로 활용할 수 있습니다.</p>
                    </div>
                </div>
            )}

            {/* NAVIGATION BUTTONS */}
            <div className="flex gap-4 mt-8 pt-6 border-t">
                {step > 1 ? (
                    <button onClick={() => setStep(step - 1)} className="flex-1 py-3.5 rounded-2xl border font-bold text-sm text-gray-600 hover:bg-gray-50 transition-all active:scale-95">이전 단계</button>
                ) : (
                    <button onClick={onCancel} className="flex-1 py-3.5 rounded-2xl border font-bold text-sm text-gray-500 hover:bg-gray-50 transition-all active:scale-95">작성 취소</button>
                )}
                
                {step < 3 ? (
                    <button onClick={handleNext} className="flex-[2] py-3.5 rounded-2xl bg-blue-600 text-white font-extrabold text-sm hover:bg-blue-700 shadow-md transition-all active:scale-95">다음 단계</button>
                ) : (
                    <button onClick={handleSubmit} className="flex-[2] py-3.5 rounded-2xl bg-orange-600 text-white font-extrabold text-sm hover:bg-orange-700 shadow-md transition-all active:scale-95">최종 설문지 제출</button>
                )}
            </div>
        </div>
    );
};


const FormSafetyPlan = ({ user, onSubmit, onCancel }) => {
    const [vehicles, setVehicles] = useState('1ton 12대');
    const [workers, setWorkers] = useState('12명');
    const [protectiveGear, setProtectiveGear] = useState('안전화, 미끄럼방지 장갑, 손목보호대, 야간 랜턴');

    const downloadPDF = () => {
        const element = document.getElementById('printable-plan-form-creation');
        if (!element) return;
        toJpeg(element, {
            quality: 0.98,
            style: { transform: 'none', opacity: '1', visibility: 'visible' }
        }).then(dataUrl => {
            const pdf = new jsPDF('p', 'mm', 'a4');
            pdf.addImage(dataUrl, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
            pdf.save(`안전보건관리계획서_${user.name}_${new Date().toISOString().split('T')[0]}.pdf`);
        }).catch(err => notify('PDF 저장 실패: ' + err.message));
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 max-w-4xl mx-auto animate-fade-in">
            <h3 className="text-xl font-extrabold mb-4 pb-2 border-b text-blue-800">안전보건관리계획서</h3>
            
            <div className="scroll-container bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4">
                <div id="printable-plan-form-creation" className="bg-white p-5 text-black border border-gray-300 w-[700px] mx-auto font-sans text-[10px] leading-tight shadow-sm">
                    <h2 className="text-center font-extrabold text-sm border-2 border-black py-1 mb-3">안전보건관리계획서</h2>
                    
                    <table className="w-full border-collapse border border-black text-left mb-2 text-[9.5px]">
                        <tbody>
                            <tr>
                                <td className="border border-black bg-gray-100 font-bold p-1.5 text-center w-[18%]">업체현황</td>
                                <td className="border border-black p-1.5 space-y-0.5">
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
                                <td className="border border-black bg-gray-100 font-bold p-1.5 text-center">장비 및<br/>보호구 현황</td>
                                <td className="border border-black p-1.5 space-y-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <span className="shrink-0 font-bold">1. 차량(대) :</span>
                                        <input type="text" value={vehicles} onChange={e => setVehicles(e.target.value)} className="border rounded px-2 py-0.5 w-full text-[9px] font-bold bg-white text-black" />
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="shrink-0 font-bold">2. 인원(명) :</span>
                                        <input type="text" value={workers} onChange={e => setWorkers(e.target.value)} className="border rounded px-2 py-0.5 w-full text-[9px] font-bold bg-white text-black" />
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="shrink-0 font-bold">3. 보호구 :</span>
                                        <input type="text" value={protectiveGear} onChange={e => setProtectiveGear(e.target.value)} className="border rounded px-2 py-0.5 w-full text-[9px] font-bold bg-white text-black" />
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td className="border border-black bg-gray-100 font-bold p-1.5 text-center">작업 위해요소</td>
                                <td className="border border-black p-1.5 space-y-0.5">
                                    <p>1. 중량물 취급: 무거운 박스 반복 운반으로 인한 근골격계 질환, 허리·어깨 부상 위험</p>
                                    <p>2. 낙상·미끄러짐: 비·눈·결빙으로 인한 작업장 바닥 미끄러움, 차량 승하차 시 발목·무릎 부상</p>
                                    <p>3. 충돌·끼임: 지게차, 컨베이어, 차량 문 등에 신체가 끼이거나 부딪히는 사고</p>
                                </td>
                            </tr>
                            <tr>
                                <td className="border border-black bg-gray-100 font-bold p-1.5 text-center">재해예방대책</td>
                                <td className="border border-black p-1.5 space-y-0.5">
                                    <p>1. 중량물 취급 시 보조장비 활용과 올바른 작업자세 교육으로 근골격계 부담을 최소화</p>
                                    <p>2. 작업 전 점검·안전교육·보호구 착용을 통해 기본 안전수칙을 철저히 준수</p>
                                    <p>3. 운행 전 차량점검(브레이크·타이어 등)과 안전운전 수칙 준수(과속·휴대폰 사용 금지)를 철저히 이행</p>
                                </td>
                            </tr>
                            <tr>
                                <td className="border border-black bg-gray-100 font-bold p-1.5 text-center">위험작업<br/>신호체계</td>
                                <td className="border border-black p-1.5 space-y-0.5">
                                    <p>차량 이동 및 상·하차 시 작업 전 신호를 통일하고, 모든 작업자가 준수</p>
                                    <p>위험 발생 시 즉시 '정지' 신호로 작업을 중단하고, 교육·TBM을 통해 신호체계를 상시 숙지 및 적용</p>
                                </td>
                            </tr>
                            <tr>
                                <td className="border border-black bg-gray-100 font-bold p-1.5 text-center">비상대책</td>
                                <td className="border border-black p-1.5 space-y-0.5">
                                    <p>1. 화재·교통사고·낙상 등 사고 발생 시 즉시 작업 중지 후 119 및 관리자에게 신속 보고</p>
                                    <p>2. 비상연락망 운영 및 정기 훈련을 통해 신속한 대응과 피해 최소화 체계 구축</p>
                                </td>
                            </tr>
                            <tr>
                                <td className="border border-black bg-gray-100 font-bold p-1.5 text-center" rowSpan={2}>비상연락망</td>
                                <td className="border border-black p-1.5 bg-gray-50 font-bold text-gray-700">
                                    [업체] 코끼리물류 관리자 : 010-2514-4826 관리자 권오민
                                </td>
                            </tr>
                            <tr>
                                <td className="border border-black p-1.5 space-y-0.5">
                                    <p><strong>[유관기관]</strong></p>
                                    <p>서울아산병원(잠실 인근) 응급실 : 02-3010-3333</p>
                                    <p>건국대학교병원 응급의료센터 : 02-2030-5555</p>
                                    <p>송파소방서 : 02-6981-2119 / 광진소방서 : 02-6981-6119</p>
                                    <p>CLS 담당자 : 010-6397-0494</p>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex gap-4">
                <button onClick={onCancel} className="flex-1 py-3 bg-white border rounded-xl font-bold hover:bg-gray-50 text-xs">돌아가기</button>
                <button onClick={downloadPDF} className="flex-1 py-3 rounded-xl border border-blue-200 text-blue-600 font-bold hover:bg-blue-50 transition-all flex items-center justify-center gap-1 active:scale-95 shadow-sm text-xs">
                    📥 PDF 다운로드
                </button>
                <button onClick={() => onSubmit({ formType: 'agreement', date: new Date().toISOString().split('T')[0], status: '열람 및 동의', agreed: true, vehicles, workers, protectiveGear })} className="flex-[2] py-3 rounded-xl bg-brand text-white font-extrabold hover:bg-blue-700 shadow-md text-xs">계획서 확인 및 서명 제출</button>
            </div>
        </div>
    );
};

const FormActionHistory = ({ user, onSubmit, onCancel }) => {
    const [manager, setManager] = useState('권오민');
    const [company, setCompany] = useState('코끼리물류');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    const [rows, setRows] = useState([
        { idx: 1, date: '4/11', type: '안전', cat: '행동/장비', loc: '배송지 연석/도로', issue: '야간 배송 중 어두운 환경으로 인해 연석/턱에 발목 접질림 사고 위험', plan: '발목을 보호하는 안전화/트레킹화 지급 및 야간 시야 확보용 휴대용 랜턴 지급', owner: '권오민', dueDate: '4/15', doneDate: '4/15', cost: '14', note: '' },
        { idx: 2, date: '4/18', type: '안전', cat: '행동/장비', loc: '배송지 계단', issue: '우천 및 결로 발생 시 계단 미끄러짐 및 넘어짐 사고 위험', plan: '접지력이 뛰어난 미끄럼 방지 기능성 안전화 지급 및 이동 수칙 교육', owner: '권오민', dueDate: '4/20', doneDate: '4/20', cost: '14', note: '' },
        { idx: 3, date: '6/5', type: '보건', cat: '작업환경', loc: '하차장/차량', issue: '20kg 이상 중량박스 반복 운반 시 허리 부상 및 손 끼임 위험', plan: '이동대차(카트) 사용 의무화 및 작업용 미끄럼방지 장갑 전원 지급', owner: '권오민', dueDate: '6/7', doneDate: '6/7', cost: '12', note: '' },
        { idx: 4, date: '6/10', type: '보건', cat: '행동/장비', loc: '상하차장/배송지', issue: '소형화물 및 20kg 이상 중량박스 반복 운반으로 인한 손목 통증 및 부상 위험', plan: '손목 통증 호소 근로자 대상 손목 보호대 지급 및 올바른 중량물 적재/운반 자세 교육', owner: '권오민', dueDate: '6/12', doneDate: '6/12', cost: '5', note: '' },
        { idx: 5, date: '', type: '', cat: '', loc: '', issue: '', plan: '', owner: '', dueDate: '', doneDate: '', cost: '', note: '' }
    ]);

    const handleRowChange = (idx, field, val) => {
        setRows(prev => {
            const arr = [...prev];
            arr[idx] = { ...arr[idx], [field]: val };
            return arr;
        });
    };

    const addRow = () => {
        setRows(prev => [...prev, { idx: prev.length + 1, date: '', type: '', cat: '', loc: '', issue: '', plan: '', owner: '', dueDate: '', doneDate: '', cost: '', note: '' }]);
    };

    const downloadPDF = () => {
        const element = document.getElementById('printable-action-history-creation');
        if (!element) return;
        toJpeg(element, {
            quality: 0.98,
            style: { transform: 'none', opacity: '1', visibility: 'visible' }
        }).then(dataUrl => {
            const pdf = new jsPDF('l', 'mm', 'a4');
            pdf.addImage(dataUrl, 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
            pdf.save(`안전보건_조치_이력_관리_${date}.pdf`);
        }).catch(err => notify('PDF 저장 실패: ' + err.message));
    };

    const handleSubmit = () => {
        onSubmit({
            formType: 'action_history',
            date,
            manager,
            company,
            rows,
            status: '조치 이력 갱신'
        });
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 max-w-[1100px] mx-auto animate-fade-in text-black font-sans">
            <h3 className="text-xl font-extrabold mb-4 pb-2 border-b text-blue-700">안전보건 조치 이력 관리</h3>
            
            <div className="scroll-container bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4">
                <div id="printable-action-history-creation" className="bg-white p-5 border border-gray-300 w-[980px] mx-auto text-[7px] leading-tight font-sans shadow-sm text-black">
                    {/* Blue Title Header Row */}
                    <div className="bg-blue-700 text-white font-extrabold text-center text-xs py-2.5 mb-2 rounded-sm shadow-sm tracking-wider">
                        안전보건 조치 이력 관리
                    </div>

                    <div className="flex justify-between items-center mb-3 font-bold text-[8.5px]">
                        <div>회사명 : {company} (대표자/관리자 : {manager})</div>
                        <div className="flex gap-2">
                            <span>대장 일자 :</span>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border border-gray-200 rounded px-1 outline-none text-[8px]" />
                        </div>
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
                            {rows.map((row, idx) => (
                                <tr key={idx} className="hover:bg-blue-50/20">
                                    <td className="border border-black p-1 font-bold bg-gray-50">{row.idx}</td>
                                    <td className="border border-black p-0.5 bg-white">
                                        <input type="text" value={row.date} onChange={e => handleRowChange(idx, 'date', e.target.value)} className="w-full text-center border-0 bg-transparent text-[7px]" />
                                    </td>
                                    <td className="border border-black p-0.5 bg-white">
                                        <input type="text" value={row.type} onChange={e => handleRowChange(idx, 'type', e.target.value)} className="w-full text-center border-0 bg-transparent text-[7px]" />
                                    </td>
                                    <td className="border border-black p-0.5 bg-white">
                                        <input type="text" value={row.cat} onChange={e => handleRowChange(idx, 'cat', e.target.value)} className="w-full text-center border-0 bg-transparent text-[7px]" />
                                    </td>
                                    <td className="border border-black p-0.5 bg-white">
                                        <input type="text" value={row.loc} onChange={e => handleRowChange(idx, 'loc', e.target.value)} className="w-full text-center border-0 bg-transparent text-[7px]" />
                                    </td>
                                    <td className="border border-black p-0.5 bg-white">
                                        <textarea value={row.issue} onChange={e => handleRowChange(idx, 'issue', e.target.value)} className="w-full border-0 bg-transparent text-[6.5px] leading-tight resize-none h-[22px] p-0.5" />
                                    </td>
                                    <td className="border border-black p-0.5 bg-white">
                                        <textarea value={row.plan} onChange={e => handleRowChange(idx, 'plan', e.target.value)} className="w-full border-0 bg-transparent text-[6.5px] leading-tight resize-none h-[22px] p-0.5" />
                                    </td>
                                    <td className="border border-black p-0.5 bg-white">
                                        <input type="text" value={row.owner} onChange={e => handleRowChange(idx, 'owner', e.target.value)} className="w-full text-center border-0 bg-transparent text-[7px]" />
                                    </td>
                                    <td className="border border-black p-0.5 bg-white">
                                        <input type="text" value={row.dueDate} onChange={e => handleRowChange(idx, 'dueDate', e.target.value)} className="w-full text-center border-0 bg-transparent text-[7px]" />
                                    </td>
                                    <td className="border border-black p-0.5 bg-white">
                                        <input type="text" value={row.doneDate} onChange={e => handleRowChange(idx, 'doneDate', e.target.value)} className="w-full text-center border-0 bg-transparent text-[7px]" />
                                    </td>
                                    <td className="border border-black p-0.5 bg-white">
                                        <input type="text" value={row.cost} onChange={e => handleRowChange(idx, 'cost', e.target.value)} className="w-full text-center border-0 bg-transparent text-[7px]" />
                                    </td>
                                    <td className="border border-black p-0.5 bg-white">
                                        <input type="text" value={row.note} onChange={e => handleRowChange(idx, 'note', e.target.value)} className="w-full text-center border-0 bg-transparent text-[7px]" />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <button onClick={addRow} className="w-full py-1.5 border border-dashed rounded text-[7px] hover:bg-gray-100 text-gray-500 font-bold mt-2">+ 조치 이력 행 추가</button>
                </div>
            </div>

            <div className="flex gap-4">
                <button onClick={onCancel} className="flex-1 py-3 bg-white border rounded-xl font-bold hover:bg-gray-50 text-xs">돌아가기</button>
                <button onClick={downloadPDF} className="flex-1 py-3 rounded-xl border border-blue-200 text-blue-600 font-bold hover:bg-blue-50 transition-all flex items-center justify-center gap-1 active:scale-95 shadow-sm text-xs">
                    📥 PDF 다운로드
                </button>
                <button onClick={handleSubmit} className="flex-[2] py-3 rounded-xl bg-blue-600 text-white font-extrabold hover:bg-blue-700 shadow-md text-xs">이력 대장 저장</button>
            </div>
        </div>
    );
};



const FormEmergencyPlan = ({ user, onSubmit, onCancel }) => {
    const [manager, setManager] = useState('권오민');
    const [company, setCompany] = useState('코끼리물류');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // Page 1: 교통사고
    const [p1Eq, setP1Eq] = useState({ name: '안내 표지판', spec: '-', qty: '1개' });
    const [p1Steps, setP1Steps] = useState([
        '1) 차량정지\n: 사고자 및 최초 발견자는 차량 정지상태를 확인한다.',
        '2) 사상자 구호\n: 사상자가 발생했을 시 소방서(119)에 구조 요청을 한 후 부상여부에 따라 적절한 응급조치를 실시한다.',
        '3) 사고현장보존\n: 사망자 발생 시에는 현장을 보존하고 소방서(119)에 신고한다.\n: 차량을 갓길로 이동하거나 안내표지판을 설치하여 후속사고를 방지한다.',
        '4) 사고자 후송\n: 전문기관 및 전문기관(소방서, 병원)의 도움을 받아 부상자(사망자)를 병원으로 후송한다.',
        '5) 영업점 보고\n: 영업점에 재해발생보고(사고보고서, 사진촬영, 목격자 확보 등)를 한다.'
    ]);

    // Page 2: 일반사고
    const [p2Eq, setP2Eq] = useState({ name: '-', spec: '-', qty: '-' });
    const [p2Steps, setP2Steps] = useState([
        '1. 현장조사 (Check)\n1) 사고현장 안전상태와 추가 위험요소 파악\n2) 구조자 본인의 안전 여부 확인\n3) 사고 상황과 부상자 수 파악\n4) 지원 가능한 주변 인력 파악\n5) 환자의 상태 확인',
        '2. 구조요청\n1) 현장 조사와 동시에 응급구조 체계에 신고\n2) 의식이 없는 경우 즉시 119에 구조 요청\n3) 자동심장충격기 (AED) 요청',
        '3. 응급처치\n1) 의식이 없을시 구조 요청 후 즉시 심폐소생술 시행\n2) 주변이 위험한 환경이면 안전한 장소로 환자 이동\n3) 의식이 있을시 따뜻한 음료 등 공급해 체온을 유지',
        '4. 보고 및 보존\n1) 대표 등 사고 상황에 대한 보고\n2) 사고 현장 주변 출입 통제하고 현장을 보존\n\n※ 경미한 부상이라도 인근 병원 등 이동하여 전문의료진의 치료를 받을 수 있도록 할 것'
    ]);

    // Contacts
    const [contacts, setContacts] = useState([
        { role: '대표', name: '권오민', phone: '010-2514-4826', note: '' },
        { role: '총괄팀장', name: '김성준', phone: '010-5197-9193', note: '' },
        { role: '소방서', name: '', phone: '119', note: '' },
        { role: '병원', name: '서울 건대병원 응급실', phone: '02-2030-5555', note: '' },
        { role: '병원', name: '서울 아산병원 응급실', phone: '02-3010-3333', note: '' },
        { role: 'CLS담당', name: '소피', phone: '010-6397-0494', note: '' }
    ]);

    const handleContactChange = (idx, field, val) => {
        setContacts(prev => {
            const arr = [...prev];
            arr[idx] = { ...arr[idx], [field]: val };
            return arr;
        });
    };

    const handleP1StepChange = (idx, val) => {
        const arr = [...p1Steps];
        arr[idx] = val;
        setP1Steps(arr);
    };

    const handleP2StepChange = (idx, val) => {
        const arr = [...p2Steps];
        arr[idx] = val;
        setP2Steps(arr);
    };

    const downloadPDF = () => {
        const element = document.getElementById('printable-emergency-plan-creation');
        if (!element) return;
        toJpeg(element, {
            quality: 0.98,
            style: { transform: 'none', opacity: '1', visibility: 'visible' }
        }).then(dataUrl => {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageHeight = 295;
            const imgWidth = 210;
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
            pdf.save(`비상사태_대응_계획서_${company}_${date}.pdf`);
        }).catch(err => notify('PDF 저장 실패: ' + err.message));
    };

    const handleSubmit = () => {
        onSubmit({
            formType: 'emergency_plan',
            date,
            manager,
            company,
            p1Eq,
            p1Steps,
            p2Eq,
            p2Steps,
            contacts,
            status: '조약/대응 구축 완료'
        });
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 max-w-[850px] mx-auto animate-fade-in text-black font-sans">
            <h3 className="text-xl font-extrabold mb-4 pb-2 border-b text-red-600">비상사태 대응 계획서 작성</h3>
            
            <div className="scroll-container bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4 max-h-[600px]">
                <div id="printable-emergency-plan-creation" className="bg-white p-6 border border-gray-300 w-[700px] mx-auto text-[9px] leading-tight font-sans shadow-sm space-y-8 text-black">
                    {/* PAGE 1: 교통사고 */}
                    <div className="border-b border-dashed border-gray-300 pb-8">
                        <div className="flex justify-between items-start mb-2">
                            <div className="text-[8px] font-bold text-gray-500">
                                <div>페이지 : 1</div>
                                <div className="flex gap-1 items-center mt-1">업체명 : <input type="text" value={company} onChange={e => setCompany(e.target.value)} className="border border-gray-200 rounded px-1 py-0.5 text-[8px] w-[60px]" /></div>
                            </div>
                            <h2 className="text-center font-extrabold text-base pt-2 flex-1">(교통사고) 비상사태 대응 계획서</h2>
                            <table className="border-collapse border border-black text-center text-[8px] w-[130px] shrink-0">
                                <tbody>
                                    <tr className="bg-gray-100 font-bold">
                                        <td className="border border-black p-1 w-[40%]">담당자</td>
                                    </tr>
                                    <tr>
                                        <td className="border border-black p-1 bg-white">
                                            <input type="text" value={manager} onChange={e => setManager(e.target.value)} className="w-full text-center border-0 bg-transparent text-[8.5px] font-bold outline-none" />
                                        </td>
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
                                    <td className="border border-black p-1 bg-white text-center">
                                        <input type="text" value={p1Eq.name} onChange={e => setP1Eq({ ...p1Eq, name: e.target.value })} className="w-full text-center border-0 bg-transparent text-[8px]" />
                                    </td>
                                    <td className="border border-black p-1 bg-white text-center">
                                        <input type="text" value={p1Eq.spec} onChange={e => setP1Eq({ ...p1Eq, spec: e.target.value })} className="w-full text-center border-0 bg-transparent text-[8px]" />
                                    </td>
                                    <td className="border border-black p-1 bg-white text-center">
                                        <input type="text" value={p1Eq.qty} onChange={e => setP1Eq({ ...p1Eq, qty: e.target.value })} className="w-full text-center border-0 bg-transparent text-[8px]" />
                                    </td>
                                    <td className="border border-black p-2 bg-white space-y-2" rowSpan={2}>
                                        {p1Steps.map((step, idx) => (
                                            <textarea key={idx} value={step} onChange={e => handleP1StepChange(idx, e.target.value)} className="w-full border border-gray-200 rounded p-1 text-[7.5px] leading-tight resize-none min-h-[40px]" />
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
                                {contacts.map((c, idx) => (
                                    <tr key={idx}>
                                        <td className="border border-black bg-gray-50 font-bold p-1">{c.role}</td>
                                        <td className="border border-black p-0.5 bg-white">
                                            <input type="text" value={c.name} onChange={e => handleContactChange(idx, 'name', e.target.value)} className="w-full text-center border-0 bg-transparent text-[8px]" />
                                        </td>
                                        <td className="border border-black p-0.5 bg-white">
                                            <input type="text" value={c.phone} onChange={e => handleContactChange(idx, 'phone', e.target.value)} className="w-full text-center border-0 bg-transparent text-[8px] font-bold" />
                                        </td>
                                        <td className="border border-black p-0.5 bg-white">
                                            <input type="text" value={c.note} onChange={e => handleContactChange(idx, 'note', e.target.value)} className="w-full text-center border-0 bg-transparent text-[7.5px]" />
                                        </td>
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
                                <div>업체명 : {company}</div>
                            </div>
                            <h2 className="text-center font-extrabold text-base pt-2 flex-1">(일반사고) 비상사태 대응 계획서</h2>
                            <table className="border-collapse border border-black text-center text-[8px] w-[130px] shrink-0">
                                <tbody>
                                    <tr className="bg-gray-100 font-bold">
                                        <td className="border border-black p-1 w-[40%]">담당자</td>
                                    </tr>
                                    <tr>
                                        <td className="border border-black p-1 bg-white font-bold">{manager}</td>
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
                                    <td className="border border-black p-1 bg-white text-center">
                                        <input type="text" value={p2Eq.name} onChange={e => setP2Eq({ ...p2Eq, name: e.target.value })} className="w-full text-center border-0 bg-transparent text-[8px]" />
                                    </td>
                                    <td className="border border-black p-1 bg-white text-center">
                                        <input type="text" value={p2Eq.spec} onChange={e => setP2Eq({ ...p2Eq, spec: e.target.value })} className="w-full text-center border-0 bg-transparent text-[8px]" />
                                    </td>
                                    <td className="border border-black p-1 bg-white text-center">
                                        <input type="text" value={p2Eq.qty} onChange={e => setP2Eq({ ...p2Eq, qty: e.target.value })} className="w-full text-center border-0 bg-transparent text-[8px]" />
                                    </td>
                                    <td className="border border-black p-2 bg-white space-y-2" rowSpan={2}>
                                        {p2Steps.map((step, idx) => (
                                            <textarea key={idx} value={step} onChange={e => handleP2StepChange(idx, e.target.value)} className="w-full border border-gray-200 rounded p-1 text-[7.5px] leading-tight resize-none min-h-[50px]" />
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
                                {contacts.map((c, idx) => (
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

            <div className="flex gap-4">
                <button onClick={onCancel} className="flex-1 py-3 bg-white border rounded-xl font-bold hover:bg-gray-50 text-xs">돌아가기</button>
                <button onClick={downloadPDF} className="flex-1 py-3 rounded-xl border border-blue-200 text-blue-600 font-bold hover:bg-blue-50 transition-all flex items-center justify-center gap-1 active:scale-95 shadow-sm text-xs">
                    📥 PDF 다운로드
                </button>
                <button onClick={handleSubmit} className="flex-[2] py-3 rounded-xl bg-red-600 text-white font-extrabold hover:bg-red-700 shadow-md text-xs">계획서 최종저장</button>
            </div>
        </div>
    );
};



const FormHazardSurvey = ({ user, onSubmit, onCancel }) => {
    // 가. 조사 개요
    const [surveyDate, setSurveyDate] = useState('2026-06-10');
    const [surveyor, setSurveyor] = useState('권오민');
    const [deptName, setDeptName] = useState('코끼리물류 배송팀');
    const [processName, setProcessName] = useState('화물 상ㆍ하차 및 배송');
    const [workName, setWorkName] = useState('택배 및 소형화물 배송, 프레쉬백 수거');

    // 나. 작업장 상황 조사
    const [eqChange, setEqChange] = useState('변화 없음');
    const [volChange, setVolChange] = useState('늘어남(인제부터: 상시/물량지속증가)');
    const [speedChange, setSpeedChange] = useState('변화 없음');
    const [jobChange, setJobChange] = useState('변화 없음');

    // 다. 작업조건 조사 - 1단계
    const [step1WorkName, setStep1WorkName] = useState('화물 상차 (적재)');
    const [step1Details, setStep1Details] = useState([
        '화물 상차 및 적재함 정리 (0.1kg~최대30kg 박스 수동 적재)',
        '1톤 화물차 운전 및 배송지 이동 (장시간 운전 자세)',
        '배송지 화물 하차, 수거 및 하차 운반 (계단 이동 및 카트 운반)'
    ]);

    // 2단계
    const [step2Rows, setStep2Rows] = useState([
        { name: '상차(적재)', num: '9호', load: 4, freq: 3 },
        { name: '하차(운반)', num: '4호9호', load: 4, freq: 4 },
        { name: '', num: '', load: 0, freq: 0 }
    ]);

    // 3단계
    const [step3WorkName, setStep3WorkName] = useState('상차(적재)');
    const [workerName, setWorkerName] = useState('김대훈');
    const [workerPhoto, setWorkerPhoto] = useState(''); // Base64 or image url
    const [analysisRows, setAnalysisRows] = useState([
        { unitJob: '상치', num: '9호', hazard: '과도한 힘', cause: '상품을 RT에서 차량까지 들어서 적재하는 작업시 과도한 힘', note: '' },
        { unitJob: '', num: '', hazard: '', cause: '', note: '' }
    ]);

    const handlePhotoUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setWorkerPhoto(reader.result);
        };
        reader.readAsDataURL(file);
    };

    const handleStep2Change = (idx, field, val) => {
        setStep2Rows(prev => {
            const arr = [...prev];
            arr[idx] = { ...arr[idx], [field]: val };
            return arr;
        });
    };

    const handleAnalysisChange = (idx, field, val) => {
        setAnalysisRows(prev => {
            const arr = [...prev];
            arr[idx] = { ...arr[idx], [field]: val };
            return arr;
        });
    };

    const addStep2Row = () => {
        setStep2Rows(prev => [...prev, { name: '', num: '', load: 0, freq: 0 }]);
    };

    const addAnalysisRow = () => {
        setAnalysisRows(prev => [...prev, { unitJob: '', num: '', hazard: '', cause: '', note: '' }]);
    };

    const downloadPDF = () => {
        const element = document.getElementById('printable-hazard-survey-creation');
        if (!element) return;
        toJpeg(element, {
            quality: 0.98,
            style: { transform: 'none', opacity: '1', visibility: 'visible' }
        }).then(dataUrl => {
            const pdf = new jsPDF('l', 'mm', 'a4');
            pdf.addImage(dataUrl, 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
            pdf.save(`유해요인조사표_${workerName || surveyor}_${surveyDate}.pdf`);
        }).catch(err => notify('PDF 저장 실패: ' + err.message));
    };

    const handleSubmit = () => {
        onSubmit({
            formType: 'hazard_survey',
            date: surveyDate,
            surveyDate,
            surveyor,
            deptName,
            processName,
            workName,
            eqChange,
            volChange,
            speedChange,
            jobChange,
            step1WorkName,
            step1Details,
            step2Rows,
            step3WorkName,
            workerName,
            workerPhoto,
            analysisRows,
            status: '조사 완료'
        });
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 max-w-[1100px] mx-auto animate-fade-in text-black font-sans">
            <h3 className="text-xl font-extrabold mb-4 pb-2 border-b text-brand">유해요인조사표(제4조 관련) 작성</h3>
            
            <div className="scroll-container bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4">
                <div id="printable-hazard-survey-creation" className="bg-white p-4 border border-gray-300 w-[1000px] mx-auto text-[7.5px] leading-tight font-sans shadow-sm flex gap-4">
                    {/* Panel 1: 가. 조사개요 & 나. 작업장 상황조사 */}
                    <div className="flex-1 border border-black p-2 flex flex-col justify-between">
                        <div>
                            <h2 className="text-center font-extrabold text-[10px] border-b border-black pb-1 mb-2 bg-gray-100 py-1">유해요인조사표(제4조 관련)</h2>
                            
                            <p className="font-bold text-[8px] mb-1 bg-gray-50 p-0.5">가. 조사 개요</p>
                            <table className="w-full border-collapse border border-black text-center mb-3">
                                <tbody>
                                    <tr>
                                        <td className="border border-black bg-gray-100 font-bold p-1 w-[25%]">조사 일시</td>
                                        <td className="border border-black p-0.5 w-[30%]">
                                            <input type="date" value={surveyDate} onChange={e => setSurveyDate(e.target.value)} className="w-full text-center border-0 bg-transparent text-[8px] font-bold outline-none" />
                                        </td>
                                        <td className="border border-black bg-gray-100 font-bold p-1 w-[20%]">조사자</td>
                                        <td className="border border-black p-0.5 w-[25%]">
                                            <input type="text" value={surveyor} onChange={e => setSurveyor(e.target.value)} className="w-full text-center border-0 bg-transparent text-[8px] font-bold outline-none" />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="border border-black bg-gray-100 font-bold p-1">부서명</td>
                                        <td className="border border-black p-0.5 text-left pl-1" colSpan={3}>
                                            <input type="text" value={deptName} onChange={e => setDeptName(e.target.value)} className="w-full border-0 bg-transparent text-[8px] font-bold outline-none" />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="border border-black bg-gray-100 font-bold p-1">작업공정명</td>
                                        <td className="border border-black p-0.5 text-left pl-1" colSpan={3}>
                                            <input type="text" value={processName} onChange={e => setProcessName(e.target.value)} className="w-full border-0 bg-transparent text-[8px] font-bold outline-none" />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="border border-black bg-gray-100 font-bold p-1">작업명</td>
                                        <td className="border border-black p-0.5 text-left pl-1" colSpan={3}>
                                            <input type="text" value={workName} onChange={e => setWorkName(e.target.value)} className="w-full border-0 bg-transparent text-[8px] font-bold outline-none" />
                                        </td>
                                    </tr>
                                </tbody>
                            </table>

                            <p className="font-bold text-[8px] mb-1 bg-gray-50 p-0.5">나. 작업장 상황 조사</p>
                            <table className="w-full border-collapse border border-black text-left mb-2">
                                <tbody>
                                    <tr>
                                        <td className="border border-black bg-gray-100 font-bold p-1 w-[25%] text-center">작업 설비</td>
                                        <td className="border border-black p-1 bg-white">
                                            <input type="text" value={eqChange} onChange={e => setEqChange(e.target.value)} className="w-full border-0 bg-transparent text-[7.5px] outline-none" />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="border border-black bg-gray-100 font-bold p-1 text-center">작업량</td>
                                        <td className="border border-black p-1 bg-white">
                                            <input type="text" value={volChange} onChange={e => setVolChange(e.target.value)} className="w-full border-0 bg-transparent text-[7.5px] outline-none" />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="border border-black bg-gray-100 font-bold p-1 text-center">작업 속도</td>
                                        <td className="border border-black p-1 bg-white">
                                            <input type="text" value={speedChange} onChange={e => setSpeedChange(e.target.value)} className="w-full border-0 bg-transparent text-[7.5px] outline-none" />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="border border-black bg-gray-100 font-bold p-1 text-center">업무 변화</td>
                                        <td className="border border-black p-1 bg-white">
                                            <input type="text" value={jobChange} onChange={e => setJobChange(e.target.value)} className="w-full border-0 bg-transparent text-[7.5px] outline-none" />
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="text-right text-[6.5px] text-gray-400">1 / 3 Page</div>
                    </div>

                    {/* Panel 2: 다. 작업조건 조사 (1단계 & 2단계) */}
                    <div className="flex-1 border border-black p-2 flex flex-col justify-between">
                        <div>
                            <p className="font-bold text-[8px] mb-1 bg-gray-50 p-0.5">다. 작업조건 조사 (인간공학적인 측면)</p>
                            <p className="font-bold text-[7.5px] text-blue-800 mb-1">■ 1단계 : 작업별 주요 작업내용 (유해요인 조사자)</p>
                            <table className="w-full border-collapse border border-black text-left mb-3">
                                <tbody>
                                    <tr className="bg-gray-100">
                                        <td className="border border-black font-bold p-1 w-[25%] text-center">작업명</td>
                                        <td className="border border-black p-1 bg-white">
                                            <input type="text" value={step1WorkName} onChange={e => setStep1WorkName(e.target.value)} className="w-full border-0 bg-transparent text-[7.5px] font-bold outline-none" />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="border border-black bg-gray-100 font-bold p-1 text-center">작업내용<br/>(단위작업명)</td>
                                        <td className="border border-black p-1 bg-white space-y-1">
                                            {step1Details.map((det, idx) => (
                                                <input key={idx} type="text" value={det} onChange={e => {
                                                    const arr = [...step1Details];
                                                    arr[idx] = e.target.value;
                                                    setStep1Details(arr);
                                                }} className="w-full border border-gray-200 rounded px-1 text-[7px]" />
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
                                    {step2Rows.map((row, idx) => (
                                        <tr key={idx}>
                                            <td className="border border-black p-0.5 bg-white">
                                                <input type="text" value={row.name} onChange={e => handleStep2Change(idx, 'name', e.target.value)} className="w-full border-0 text-center text-[7px] outline-none" placeholder="단위공정" />
                                            </td>
                                            <td className="border border-black p-0.5 bg-white">
                                                <input type="text" value={row.num} onChange={e => handleStep2Change(idx, 'num', e.target.value)} className="w-full border-0 text-center text-[7px] outline-none" placeholder="예: 9호" />
                                            </td>
                                            <td className="border border-black p-0.5 bg-white">
                                                <select value={row.load} onChange={e => handleStep2Change(idx, 'load', parseInt(e.target.value))} className="w-full border-0 text-center text-[7px] outline-none bg-transparent">
                                                    {[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n}점</option>)}
                                                </select>
                                            </td>
                                            <td className="border border-black p-0.5 bg-white">
                                                <select value={row.freq} onChange={e => handleStep2Change(idx, 'freq', parseInt(e.target.value))} className="w-full border-0 text-center text-[7px] outline-none bg-transparent">
                                                    {[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n}점</option>)}
                                                </select>
                                            </td>
                                            <td className="border border-black p-1 bg-gray-50 font-bold text-[8px]">{row.load * row.freq}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <button onClick={addStep2Row} className="w-full py-1 border border-dashed rounded text-[7px] hover:bg-gray-100 text-gray-500 font-bold mb-2">+ 2단계 평가 행 추가</button>
                        </div>
                        <div className="text-right text-[6.5px] text-gray-400">2 / 3 Page</div>
                    </div>

                    {/* Panel 3: 3단계: 유해요인평가 (사진첨부 & 원인분석) */}
                    <div className="flex-1 border border-black p-2 flex flex-col justify-between">
                        <div>
                            <p className="font-bold text-[8px] mb-1 bg-gray-50 p-0.5">■ 3단계 : 유해요인평가</p>
                            <table className="w-full border-collapse border border-black text-center mb-2">
                                <tbody>
                                    <tr className="bg-gray-100">
                                        <td className="border border-black font-bold p-1 w-[20%]">작업명</td>
                                        <td className="border border-black p-0.5 w-[30%] bg-white">
                                            <input type="text" value={step3WorkName} onChange={e => setStep3WorkName(e.target.value)} className="w-full text-center border-0 bg-transparent text-[7.5px] font-bold outline-none" />
                                        </td>
                                        <td className="border border-black font-bold p-1 w-[20%]">근로자명</td>
                                        <td className="border border-black p-0.5 w-[30%] bg-white">
                                            <input type="text" value={workerName} onChange={e => setWorkerName(e.target.value)} className="w-full text-center border-0 bg-transparent text-[7.5px] font-bold outline-none" />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="border border-black bg-gray-100 font-bold p-1.5 text-center" colSpan={4}>현장 관찰 관격 사진 (동작 사진)</td>
                                    </tr>
                                    <tr>
                                        <td className="border border-black p-2 bg-white text-center" colSpan={4}>
                                            {workerPhoto ? (
                                                <div className="relative inline-block">
                                                    <img src={workerPhoto} className="w-[120px] h-[90px] object-cover mx-auto rounded border border-gray-300" alt="작업사진" />
                                                    <button onClick={() => setWorkerPhoto('')} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center font-bold text-[8px]">&times;</button>
                                                </div>
                                            ) : (
                                                <div className="border border-dashed border-gray-300 rounded p-4 text-center">
                                                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" id="hazard-photo-picker" />
                                                    <label htmlFor="hazard-photo-picker" className="cursor-pointer text-[7px] text-blue-600 font-bold hover:underline">📷 작업 사진 업로드</label>
                                                </div>
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
                                    {analysisRows.map((row, idx) => (
                                        <tr key={idx}>
                                            <td className="border border-black p-0.5 bg-white">
                                                <input type="text" value={row.unitJob} onChange={e => handleAnalysisChange(idx, 'unitJob', e.target.value)} className="w-full border-0 text-center text-[6.5px] outline-none" placeholder="상차 등" />
                                            </td>
                                            <td className="border border-black p-0.5 bg-white">
                                                <input type="text" value={row.num} onChange={e => handleAnalysisChange(idx, 'num', e.target.value)} className="w-full border-0 text-center text-[6.5px] outline-none" />
                                            </td>
                                            <td className="border border-black p-0.5 bg-white">
                                                <input type="text" value={row.hazard} onChange={e => handleAnalysisChange(idx, 'hazard', e.target.value)} className="w-full border-0 text-center text-[6.5px] outline-none" />
                                            </td>
                                            <td className="border border-black p-0.5 bg-white">
                                                <textarea value={row.cause} onChange={e => handleAnalysisChange(idx, 'cause', e.target.value)} className="w-full border-0 text-left text-[6.5px] outline-none resize-none h-[22px] p-0.5 leading-tight" />
                                            </td>
                                            <td className="border border-black p-0.5 bg-white">
                                                <input type="text" value={row.note} onChange={e => handleAnalysisChange(idx, 'note', e.target.value)} className="w-full border-0 text-center text-[6.5px] outline-none" />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <button onClick={addAnalysisRow} className="w-full py-1 border border-dashed rounded text-[7px] hover:bg-gray-100 text-gray-500 font-bold mb-2">+ 분석 행 추가</button>
                        </div>
                        <div className="text-right text-[6.5px] text-gray-400">3 / 3 Page</div>
                    </div>
                </div>
            </div>

            <div className="flex gap-4">
                <button onClick={onCancel} className="flex-1 py-3 bg-white border rounded-xl font-bold hover:bg-gray-50 text-xs">돌아가기</button>
                <button onClick={downloadPDF} className="flex-1 py-3 rounded-xl border border-blue-200 text-blue-600 font-bold hover:bg-blue-50 transition-all flex items-center justify-center gap-1 active:scale-95 shadow-sm text-xs">
                    📥 PDF 다운로드
                </button>
                <button onClick={handleSubmit} className="flex-[2] py-3 rounded-xl bg-brand text-white font-extrabold hover:bg-blue-700 shadow-md text-xs">조사표 저장</button>
            </div>
        </div>
    );
};



const FormMusculoChecklist = ({ user, onSubmit, onCancel }) => {
    const [bizName, setBizName] = useState('코끼리 물류');
    const [surveyDate, setSurveyDate] = useState(new Date().toISOString().split('T')[0]);
    const [surveyor, setSurveyor] = useState('권오민');
    const [processName, setProcessName] = useState('화물배송');
    const [processDesc, setProcessDesc] = useState('화물 상ㆍ하차');

    const [matrix, setMatrix] = useState({
        '상차(분류) / 하차장': ['O', 'O', 'X', 'O', 'X', 'X', 'X', 'O', 'O', 'O', 'X'],
        '상차(적재) / 적재함': ['O', 'O', 'O', 'O', 'X', 'X', 'X', 'X', 'O', 'O', 'X'],
        '차량운전 / 1톤화물차': ['X', 'X', 'X', 'O', 'O', 'X', 'X', 'X', 'X', 'X', 'X'],
        '하차(운반) / 배송지': ['O', 'O', 'O', 'O', 'X', 'X', 'X', 'X', 'O', 'O', 'X'],
        '프레쉬백 및 반품 수거': ['X', 'X', 'X', 'X', 'X', 'X', 'X', 'X', 'X', 'X', 'X']
    });

    const toggleCell = (row, colIdx) => {
        setMatrix(prev => {
            const current = [...prev[row]];
            current[colIdx] = current[colIdx] === 'O' ? 'X' : 'O';
            return { ...prev, [row]: current };
        });
    };

    const downloadPDF = () => {
        const element = document.getElementById('printable-musculo-checklist-creation');
        if (!element) return;
        toJpeg(element, {
            quality: 0.98,
            style: { transform: 'none', opacity: '1', visibility: 'visible' }
        }).then(dataUrl => {
            const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape A4 size
            pdf.addImage(dataUrl, 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
            pdf.save(`근골격계부담작업_체크리스트_${surveyor}_${new Date().toISOString().split('T')[0]}.pdf`);
        }).catch(err => notify('PDF 저장 실패: ' + err.message));
    };

    const handleSubmit = () => {
        onSubmit({
            formType: 'musculo_checklist',
            date: surveyDate,
            bizName,
            surveyDate,
            surveyor,
            processName,
            processDesc,
            matrix,
            status: '조사 완료'
        });
    };

    const rows = ['상차(분류) / 하차장', '상차(적재) / 적재함', '차량운전 / 1톤화물차', '하차(운반) / 배송지', '프레쉬백 및 반품 수거'];

    const colHeaders = [
        { id: '(1)', label: '자료입력', desc: '집중적인 자료 입력 작업\n(마우스, 키보드)' },
        { id: '(2)', label: '반복동작', desc: '같은 동작 반복 작업' },
        { id: '(3)', label: '부적절한 자세1', desc: '머리 위의 손, 팔꿈치가 들림, 팔꿈치 몸통 뒤' },
        { id: '(4)', label: '부적절한 자세2', desc: '목, 허리를 구부리거나 비틂' },
        { id: '(5)', label: '쪼그려앉기', desc: '쪼그려 앉거나 무릎을 꿇음' },
        { id: '(6)', label: '손가락쥐기', desc: '한 손가락 쥐기 작업 (1kg↑)' },
        { id: '(7)', label: '물건쥐기', desc: '물건을 쥐는 작업 (4.5kg↑)' },
        { id: '(8)', label: '물건들기1', desc: '물건을 드는 작업 (25kg↑)' },
        { id: '(9)', label: '물건들기2', desc: '무릎아래/어깨위, 팔뻗어 들기 (10kg↑)' },
        { id: '(10)', label: '물건들기3', desc: '물건을 드는 작업 (4.5kg↑)' },
        { id: '(11)', label: '반복충격', desc: '신체 부위를 사용한 반복적인 충격' }
    ];

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 max-w-[1000px] mx-auto animate-fade-in text-black font-sans">
            <h3 className="text-xl font-extrabold mb-4 pb-2 border-b text-blue-800">근골격계부담작업 체크리스트 작성</h3>
            
            <div className="scroll-container bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4">
                <div id="printable-musculo-checklist-creation" className="bg-white p-5 border border-gray-300 w-[940px] mx-auto text-[7.5px] leading-tight font-sans shadow-sm">
                    <h2 className="text-center font-extrabold text-sm border-b-2 border-black pb-1.5 mb-3">근골격계부담작업 체크리스트</h2>
                    
                    <table className="w-full border-collapse border border-black text-center mb-2">
                        <tbody>
                            <tr>
                                <td className="border border-black bg-gray-100 font-bold p-1 w-[12%]">사업장명</td>
                                <td className="border border-black p-0.5 w-[21%]">
                                    <input type="text" value={bizName} onChange={e => setBizName(e.target.value)} className="w-full text-center border-0 bg-transparent text-[8px] font-bold outline-none" />
                                </td>
                                <td className="border border-black bg-gray-100 font-bold p-1 w-[12%]">조사 일자</td>
                                <td className="border border-black p-0.5 w-[21%]">
                                    <input type="date" value={surveyDate} onChange={e => setSurveyDate(e.target.value)} className="w-full text-center border border-gray-300 rounded px-1 py-0.5 text-[8px] font-bold bg-white text-black outline-none" />
                                </td>
                                <td className="border border-black bg-gray-100 font-bold p-1 w-[12%]">조 사 자</td>
                                <td className="border border-black p-0.5 w-[22%]">
                                    <input type="text" value={surveyor} onChange={e => setSurveyor(e.target.value)} className="w-full text-center border-0 bg-transparent text-[8px] font-bold outline-none" />
                                </td>
                            </tr>
                            <tr>
                                <td className="border border-black bg-gray-100 font-bold p-1">공 정 명</td>
                                <td className="border border-black p-0.5">
                                    <input type="text" value={processName} onChange={e => setProcessName(e.target.value)} className="w-full text-center border-0 bg-transparent text-[8px] font-bold outline-none" />
                                </td>
                                <td className="border border-black bg-gray-100 font-bold p-1">공정 내용</td>
                                <td className="border border-black p-0.5 text-left pl-2" colSpan={3}>
                                    <input type="text" value={processDesc} onChange={e => setProcessDesc(e.target.value)} className="w-full border-0 bg-transparent text-[8px] font-bold outline-none" />
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <table className="w-full border-collapse border border-black text-center text-[7px] leading-tight">
                        <thead>
                            <tr className="bg-gray-100 font-bold">
                                <th className="border border-black p-1 w-[15%]" rowSpan={2}>구분</th>
                                {colHeaders.map(h => (
                                    <th key={h.id} className="border border-black p-1 w-[7.7%]">{h.id}</th>
                                ))}
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
                                {colHeaders.map(h => (
                                    <td key={h.id} className="border border-black p-1.5 text-center text-xs bg-gray-50/20">
                                        {h.emoji}
                                    </td>
                                ))}
                            </tr>
                            <tr className="bg-gray-50/50">
                                <td className="border border-black p-1 font-bold">노출시간</td>
                                <td className="border border-black p-1 text-[6.5px]">하루에 총4시간 이상</td>
                                <td className="border border-black p-1 text-[6.5px]">하루에 총2시간 이상</td>
                                <td className="border border-black p-1 text-[6.5px]">하루에 총2시간 이상</td>
                                <td className="border border-black p-1 text-[6.5px]">하루에 총2시간 이상</td>
                                <td className="border border-black p-1 text-[6.5px]">하루에 총2시간 이상</td>
                                <td className="border border-black p-1 text-[6.5px]">하루에 총2시간 이상</td>
                                <td className="border border-black p-1 text-[6.5px]">하루에 총2시간 이상</td>
                                <td className="border border-black p-1">-</td>
                                <td className="border border-black p-1">-</td>
                                <td className="border border-black p-1 text-[6.5px]">하루에 총2시간 이상</td>
                                <td className="border border-black p-1 text-[6.5px]">하루에 총2시간 이상</td>
                            </tr>
                            <tr className="bg-gray-50/50">
                                <td className="border border-black p-1 font-bold">노출빈도</td>
                                <td className="border border-black p-1">-</td>
                                <td className="border border-black p-1">-</td>
                                <td className="border border-black p-1">-</td>
                                <td className="border border-black p-1">-</td>
                                <td className="border border-black p-1">-</td>
                                <td className="border border-black p-1">-</td>
                                <td className="border border-black p-1">-</td>
                                <td className="border border-black p-1 text-[6.5px]">하루에 총 10회 이상</td>
                                <td className="border border-black p-1 text-[6.5px]">하루에 총 25회 이상</td>
                                <td className="border border-black p-1 text-[6.5px]">분당 2회 이상</td>
                                <td className="border border-black p-1 text-[6.5px]">시간당 10회 이상</td>
                            </tr>
                            <tr className="bg-gray-50/50">
                                <td className="border border-black p-1 font-bold">신체부위</td>
                                <td className="border border-black p-1">손, 손가락</td>
                                <td className="border border-black p-1">목,어깨,손목,손,팔꿈치</td>
                                <td className="border border-black p-1">어깨, 팔</td>
                                <td className="border border-black p-1">목, 허리</td>
                                <td className="border border-black p-1">다리, 무릎</td>
                                <td className="border border-black p-1">손가락</td>
                                <td className="border border-black p-1">손</td>
                                <td className="border border-black p-1">허리</td>
                                <td className="border border-black p-1">손, 무릎</td>
                                <td className="border border-black p-1">허리</td>
                                <td className="border border-black p-1">손, 무릎, 팔꿈치</td>
                            </tr>
                            <tr className="bg-gray-50/50 text-[6.2px] leading-tight">
                                <td className="border border-black p-1 font-bold">작업자세 및 내용</td>
                                <td className="border border-black p-1">집중 자료입력</td>
                                <td className="border border-black p-1">같은동작 반복</td>
                                <td className="border border-black p-1">머리위 손/팔꿈치 들림</td>
                                <td className="border border-black p-1">구부리거나 비틂</td>
                                <td className="border border-black p-1">쪼그려 앉거나 무릎꿇음</td>
                                <td className="border border-black p-1">한 손가락 쥐기</td>
                                <td className="border border-black p-1">물건을 쥐는 작업</td>
                                <td className="border border-black p-1">물건을 드는 작업</td>
                                <td className="border border-black p-1">무릎아래/어깨위, 팔뻗어 들기</td>
                                <td className="border border-black p-1">물건을 드는 작업</td>
                                <td className="border border-black p-1">반복적인 충격</td>
                            </tr>
                            <tr className="bg-gray-50/50">
                                <td className="border border-black p-1 font-bold">무게</td>
                                <td className="border border-black p-1">-</td>
                                <td className="border border-black p-1">-</td>
                                <td className="border border-black p-1">-</td>
                                <td className="border border-black p-1">-</td>
                                <td className="border border-black p-1">-</td>
                                <td className="border border-black p-1">1kg↑ / 2kg상응</td>
                                <td className="border border-black p-1">4.5kg↑</td>
                                <td className="border border-black p-1">25kg↑</td>
                                <td className="border border-black p-1">10kg↑</td>
                                <td className="border border-black p-1">4.5kg↑</td>
                                <td className="border border-black p-1">-</td>
                            </tr>
                            {rows.map(row => (
                                <tr key={row} className="hover:bg-blue-50/20">
                                    <td className="border border-black p-1 font-bold text-left bg-gray-50">{row}</td>
                                    {matrix[row]?.map((val, colIdx) => (
                                        <td key={colIdx} onClick={() => toggleCell(row, colIdx)} className={`border border-black p-1 font-extrabold text-[10px] cursor-pointer transition-colors ${val==='O'?'bg-blue-50/50 text-blue-700':'bg-white text-gray-300'}`}>
                                            {val}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex gap-4">
                <button onClick={onCancel} className="flex-1 py-3 bg-white border rounded-xl font-bold hover:bg-gray-50 text-xs">돌아가기</button>
                <button onClick={downloadPDF} className="flex-1 py-3 rounded-xl border border-blue-200 text-blue-600 font-bold hover:bg-blue-50 transition-all flex items-center justify-center gap-1 active:scale-95 shadow-sm text-xs">
                    📥 PDF 다운로드
                </button>
                <button onClick={handleSubmit} className="flex-[2] py-3 rounded-xl bg-brand text-white font-extrabold hover:bg-blue-700 shadow-md text-xs">체크리스트 저장</button>
            </div>
        </div>
    );
};



const FormRiskAssessment = ({ user, onSubmit, onCancel }) => {
    const [evalDate, setEvalDate] = useState(new Date().toISOString().split('T')[0]);
    const [evaluator, setEvaluator] = useState('권오민');
    const [participants, setParticipants] = useState('김성훈, 김성준, 김대건, 김대효, 백종순, 전원, 설영대, 황원동, 임재섭, 이성규, 김백준, 김선용');
    const [checks, setChecks] = useState(RISK_ASSESSMENT_ITEMS);

    if (user.email !== 's01025144826@gmail.com') {
        return <div className="p-10 text-center font-bold text-gray-500">위험성 평가는 관리자 전용 메뉴입니다.</div>;
    }

    const handleCellChange = (index, field, value) => {
        const newChecks = [...checks];
        newChecks[index][field] = value;
        setChecks(newChecks);
    };

    const handleSubmit = () => {
        onSubmit({
            formType: 'risk_assessment',
            date: new Date().toISOString().split('T')[0],
            dateRange: evalDate, // Save date picker value as dateRange
            evaluator,
            participants,
            checks,
            status: '평가 완료'
        });
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 max-w-5xl mx-auto animate-fade-in text-black font-sans">
            <h3 className="text-xl font-extrabold mb-4 pb-2 border-b text-blue-800">위험성 평가 작성 (관리자용)</h3>
            
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4">
                <div className="bg-white p-5 border border-gray-300 w-[840px] mx-auto text-[10px] leading-tight">
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex-1 text-center font-extrabold text-lg pt-4">위 험 성 평 가</div>
                        <table className="border-collapse border border-black text-center text-[9px] w-[260px] shrink-0">
                            <tbody>
                                <tr>
                                    <td className="border border-black bg-gray-100 font-bold p-1 w-[25%]">회사명</td>
                                    <td className="border border-black p-1">코끼리 물류</td>
                                </tr>
                                <tr>
                                    <td className="border border-black bg-gray-100 font-bold p-1">평가일시</td>
                                    <td className="border border-black p-1 bg-white">
                                        <input type="date" value={evalDate} onChange={e => setEvalDate(e.target.value)} className="w-full text-center border border-gray-300 rounded px-1 py-0.5 text-[9px] font-bold bg-white text-black outline-none focus:border-blue-500 shadow-sm" />
                                    </td>
                                </tr>
                                <tr>
                                    <td className="border border-black bg-gray-100 font-bold p-1">평가자</td>
                                    <td className="border border-black p-1 bg-white">
                                        <input type="text" value={evaluator} onChange={e => setEvaluator(e.target.value)} className="w-full text-center border border-gray-300 rounded px-1 py-0.5 text-[9px] font-bold bg-white text-black outline-none focus:border-blue-500 shadow-sm" />
                                    </td>
                                </tr>
                                <tr>
                                    <td className="border border-black bg-gray-100 font-bold p-1">참여자</td>
                                    <td className="border border-black p-1 bg-white">
                                        <textarea value={participants} onChange={e => setParticipants(e.target.value)} className="w-full border border-gray-300 rounded text-[8.5px] leading-tight font-bold bg-white text-black outline-none p-1 resize-y min-h-[40px] focus:border-blue-500 shadow-sm" />
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <table className="w-full border-collapse border border-black text-left text-[8.5px] leading-normal">
                        <thead>
                            <tr className="bg-gray-100 text-center font-bold">
                                <th className="border border-black p-1.5 w-[8%]" rowSpan={2}>대상</th>
                                <th className="border border-black p-1.5 w-[30%]" rowSpan={2}>유해위험요인</th>
                                <th className="border border-black p-1.5 w-[22%]" colSpan={3}>위험성 추정결정 및 감소대책 수립</th>
                                <th className="border border-black p-1.5 w-[15%]" colSpan={2}>이행확인</th>
                            </tr>
                            <tr className="bg-gray-100 text-center font-bold">
                                <th className="border border-black p-1 w-[8%]">현재위험성</th>
                                <th className="border border-black p-1 w-[6%]">결정</th>
                                <th className="border border-black p-1 w-[18%]">위험성감소대책</th>
                                <th className="border border-black p-1 w-[8%]">개선예정일</th>
                                <th className="border border-black p-1 w-[7%]">담당자</th>
                            </tr>
                        </thead>
                        <tbody>
                            {checks.map((item, idx) => (
                                <tr key={idx}>
                                    <td className="border border-black p-1 font-bold text-center">{item.target}</td>
                                    <td className="border border-black p-1 whitespace-pre-line">{item.hazard}</td>
                                    <td className="border border-black p-0.5 text-center bg-white">
                                        <select value={item.currentRisk} onChange={e => handleCellChange(idx, 'currentRisk', e.target.value)} className="w-full bg-white border border-gray-300 rounded text-[8px] font-bold outline-none text-center focus:border-blue-500 py-0.5 cursor-pointer appearance-auto">
                                            <option value="낮음">낮음</option>
                                            <option value="보통">보통</option>
                                            <option value="높음">높음</option>
                                        </select>
                                    </td>
                                    <td className="border border-black p-0.5 text-center bg-white">
                                        <select value={item.decision} onChange={e => handleCellChange(idx, 'decision', e.target.value)} className="w-full bg-white border border-gray-300 rounded text-[8px] font-bold outline-none text-center focus:border-blue-500 py-0.5 cursor-pointer appearance-auto">
                                            <option value="적정">적정</option>
                                            <option value="보완">보완</option>
                                        </select>
                                    </td>
                                    <td className="border border-black p-1 bg-white">
                                        <textarea value={item.measure} onChange={e => handleCellChange(idx, 'measure', e.target.value)} className="w-full border border-gray-200 rounded p-0.5 bg-white text-[8px] leading-tight outline-none resize-none min-h-[30px] focus:border-blue-500" />
                                    </td>
                                    <td className="border border-black p-0.5 bg-white">
                                        <input type="date" value={item.targetDate} onChange={e => handleCellChange(idx, 'targetDate', e.target.value)} className="w-full text-center border border-gray-300 rounded p-0.5 text-[8px] font-bold bg-white text-black outline-none focus:border-blue-500" />
                                    </td>
                                    <td className="border border-black p-0.5 bg-white">
                                        <input type="text" value={item.owner} onChange={e => handleCellChange(idx, 'owner', e.target.value)} className="w-full text-center border border-gray-300 rounded p-0.5 text-[8px] font-bold bg-white text-black outline-none focus:border-blue-500" />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex gap-4">
                <button onClick={onCancel} className="flex-1 py-3 bg-white border rounded-xl font-bold hover:bg-gray-50 text-xs">취소</button>
                <button onClick={handleSubmit} className="flex-[2] py-3 rounded-xl bg-blue-600 text-white font-extrabold hover:bg-blue-700 shadow-md text-xs">위험성 평가 저장</button>
            </div>
        </div>
    );
};

// --- Safety Education Upload Component ---
const FormSafetyEducationUpload = ({ user, onSubmit, onCancel }) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [fileData, setFileData] = useState(null);
    const [fileName, setFileName] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFileName(file.name);
            const reader = new FileReader();
            reader.onload = evt => {
                setFileData(evt.target.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async () => {
        if (!fileData) return notify('최초교육수료 증빙 서류(사진 또는 PDF)를 등록해 주세요.');
        setIsUploading(true);
        try {
            const recordId = `safe_${Date.now()}`;
            let finalFileUrl = '';
            
            if (fileData.startsWith('data:')) {
                const storageRef = storage.ref(`safety_education/${auth.currentUser.email}/${recordId}`);
                await storageRef.putString(fileData, 'data_url');
                finalFileUrl = await storageRef.getDownloadURL();
            }

            onSubmit({
                formType: 'safety_education',
                date,
                file: finalFileUrl || fileData,
                status: '제출완료'
            });
        } catch (e) {
            console.error(e);
            notify('파일 업로드 및 저장 실패: ' + e.message);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="bg-white rounded-3xl shadow-md border border-gray-100 p-8 max-w-xl mx-auto animate-fade-in">
            <h3 className="text-2xl font-extrabold mb-6 pb-4 border-b text-ink">최초 교육수료 파일 업로드</h3>
            
            <div className="space-y-6 mb-8">
                <div className="flex flex-col gap-2">
                    <label className="font-bold text-slate-700">교육 이수(실시) 일자</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border rounded-2xl p-3.5 bg-gray-50 focus:bg-white outline-none focus:border-blue-500 transition-all font-medium" />
                </div>
                
                <div className="flex flex-col gap-2">
                    <label className="font-bold text-slate-700">이수증 파일 등록 (이미지 또는 PDF)</label>
                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-3xl p-6 bg-slate-50 hover:bg-slate-100/50 transition-all cursor-pointer relative">
                        <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                        <span className="text-3xl mb-2">📁</span>
                        <p className="font-bold text-[14px] text-slate-600">{fileName || '이수증 사진 혹은 PDF 파일을 선택하세요'}</p>
                        <p className="text-xs text-gray-400 mt-1">파일을 끌어다 놓거나 클릭하여 탐색기 열기</p>
                    </div>
                    {fileData && !fileName.endsWith('.pdf') && (
                        <div className="mt-4 border rounded-2xl overflow-hidden bg-white p-2 flex justify-center">
                            <img src={fileData} className="max-h-[180px] rounded-xl object-contain" alt="이수증 미리보기" />
                        </div>
                    )}
                </div>
            </div>

            <div className="flex gap-4">
                <button onClick={onCancel} disabled={isUploading} className="flex-1 py-3.5 rounded-2xl border font-bold hover:bg-gray-50 active:scale-95 transition-all">취소</button>
                <button onClick={handleSubmit} disabled={isUploading} className="flex-[2] py-3.5 rounded-2xl bg-blue-600 text-white font-extrabold hover:bg-blue-700 shadow-md active:scale-95 transition-all flex items-center justify-center gap-2">
                    {isUploading ? (
                        <>
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            업로드 및 저장 중...
                        </>
                    ) : '이수증 제출하기'}
                </button>
            </div>
        </div>
    );
};

// --- Accident Report Component ---
const ACCIDENT_TYPES = ['교통사고', '낙상/전도', '끼임/협착', '충돌', '화상', '근골격계(요통 등)', '기타'];

const FormAccidentReport = ({ user, onSubmit, onCancel }) => {
    const [accidentDate, setAccidentDate] = useState(new Date().toISOString().split('T')[0]);
    const [accidentTime, setAccidentTime] = useState('');
    const [location, setLocation] = useState('');
    const [accidentType, setAccidentType] = useState('교통사고');
    const [description, setDescription] = useState('');
    const [injuryPart, setInjuryPart] = useState('');
    const [actionTaken, setActionTaken] = useState('');
    const [witness, setWitness] = useState('');
    const [fileData, setFileData] = useState(null);
    const [fileName, setFileName] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFileName(file.name);
            const reader = new FileReader();
            reader.onload = evt => setFileData(evt.target.result);
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async () => {
        if (!location.trim()) return notify('사고 발생 장소를 입력해주세요.');
        if (!description.trim()) return notify('사고 경위를 입력해주세요.');
        setIsUploading(true);
        try {
            const recordId = `safe_${Date.now()}`;
            let finalFileUrl = '';
            if (fileData && fileData.startsWith('data:')) {
                const storageRef = storage.ref(`accident_reports/${auth.currentUser.email}/${recordId}`);
                await storageRef.putString(fileData, 'data_url');
                finalFileUrl = await storageRef.getDownloadURL();
            }
            onSubmit({
                formType: 'accident_report',
                date: accidentDate,
                accidentTime,
                location: location.trim(),
                accidentType,
                description: description.trim(),
                injuryPart: injuryPart.trim(),
                actionTaken: actionTaken.trim(),
                witness: witness.trim(),
                file: finalFileUrl || '',
                status: '확인 필요'
            });
        } catch (e) {
            console.error(e);
            notify('저장 실패: ' + e.message);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="bg-white rounded-3xl shadow-md border border-red-100 p-8 max-w-xl mx-auto animate-fade-in">
            <h3 className="text-2xl font-extrabold mb-2 text-ink">🚨 사고 발생 보고</h3>
            <p className="text-sm text-gray-500 font-medium mb-6 pb-4 border-b">사고를 당한 본인이 직접 작성하거나, 어려운 경우 관리자가 대신 작성할 수 있어요. 제출하는 즉시 관리자에게 확인이 필요한 항목으로 표시됩니다.</p>

            <div className="space-y-5 mb-8">
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="font-bold text-slate-700 text-sm">사고 발생일</label>
                        <input type="date" value={accidentDate} onChange={e => setAccidentDate(e.target.value)} className="border rounded-2xl p-3 bg-gray-50 focus:bg-white outline-none focus:border-blue-500 transition-all font-medium" />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="font-bold text-slate-700 text-sm">사고 발생 시각</label>
                        <input type="time" value={accidentTime} onChange={e => setAccidentTime(e.target.value)} className="border rounded-2xl p-3 bg-gray-50 focus:bg-white outline-none focus:border-blue-500 transition-all font-medium" />
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="font-bold text-slate-700 text-sm">사고 발생 장소 <span className="text-red-500">*</span></label>
                    <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="예: 남양주4 배송구역, ○○아파트 앞" className="border rounded-2xl p-3.5 bg-gray-50 focus:bg-white outline-none focus:border-blue-500 transition-all font-medium" />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="font-bold text-slate-700 text-sm">사고 유형</label>
                    <select value={accidentType} onChange={e => setAccidentType(e.target.value)} className="border rounded-2xl p-3.5 bg-gray-50 focus:bg-white outline-none focus:border-blue-500 transition-all font-bold cursor-pointer">
                        {ACCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="font-bold text-slate-700 text-sm">사고 경위 <span className="text-red-500">*</span></label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="언제, 어떤 상황에서, 어떻게 사고가 발생했는지 최대한 자세히 적어주세요." className="border rounded-2xl p-3.5 bg-gray-50 focus:bg-white outline-none focus:border-blue-500 transition-all font-medium min-h-[110px] resize-y" />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="font-bold text-slate-700 text-sm">부상 부위 / 정도</label>
                    <input type="text" value={injuryPart} onChange={e => setInjuryPart(e.target.value)} placeholder="예: 왼쪽 발목 염좌, 특이사항 없음 등" className="border rounded-2xl p-3.5 bg-gray-50 focus:bg-white outline-none focus:border-blue-500 transition-all font-medium" />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="font-bold text-slate-700 text-sm">초기 조치사항</label>
                    <textarea value={actionTaken} onChange={e => setActionTaken(e.target.value)} placeholder="예: 119 신고, 병원 이송, 자체 응급처치 등" className="border rounded-2xl p-3.5 bg-gray-50 focus:bg-white outline-none focus:border-blue-500 transition-all font-medium min-h-[70px] resize-y" />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="font-bold text-slate-700 text-sm">목격자 (있는 경우)</label>
                    <input type="text" value={witness} onChange={e => setWitness(e.target.value)} placeholder="이름 또는 관계" className="border rounded-2xl p-3.5 bg-gray-50 focus:bg-white outline-none focus:border-blue-500 transition-all font-medium" />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="font-bold text-slate-700 text-sm">현장 사진 (선택)</label>
                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-3xl p-6 bg-slate-50 hover:bg-slate-100/50 transition-all cursor-pointer relative">
                        <input type="file" accept="image/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                        <span className="text-3xl mb-2">📷</span>
                        <p className="font-bold text-[14px] text-slate-600">{fileName || '사고 현장 사진을 선택하세요'}</p>
                    </div>
                    {fileData && (
                        <div className="mt-2 border rounded-2xl overflow-hidden bg-white p-2 flex justify-center">
                            <img src={fileData} className="max-h-[180px] rounded-xl object-contain" alt="사고 현장 미리보기" />
                        </div>
                    )}
                </div>
            </div>

            <div className="flex gap-4">
                <button onClick={onCancel} disabled={isUploading} className="flex-1 py-3.5 rounded-2xl border font-bold hover:bg-gray-50 active:scale-95 transition-all">취소</button>
                <button onClick={handleSubmit} disabled={isUploading} className="flex-[2] py-3.5 rounded-2xl bg-red-600 text-white font-extrabold hover:bg-red-700 shadow-md active:scale-95 transition-all flex items-center justify-center gap-2">
                    {isUploading ? (
                        <>
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            제출 중...
                        </>
                    ) : '사고 보고서 제출'}
                </button>
            </div>
        </div>
    );
};

// 양식 이름(path)에 맞는 작성 화면을 골라서 보여줍니다. (양식 묶음은 실제로 작성할 때만 불러옵니다)
const SAFETY_FORM_COMPONENTS = {
    heavy: FormHeavyObject,
    cargo: FormCargoVehicle,
    musculo: FormMusculoskeletal,
    plan: FormSafetyPlan,
    risk: FormRiskAssessment,
    musculo_checklist: FormMusculoChecklist,
    edu: FormSafetyEducationUpload,
    hazard_survey: FormHazardSurvey,
    emergency_plan: FormEmergencyPlan,
    action_history: FormActionHistory,
    accident: FormAccidentReport,
};
const SafetyFormHost = ({ path, user, onSubmit, onCancel }) => {
    const FormComponent = SAFETY_FORM_COMPONENTS[path];
    if (!FormComponent) return null;
    return <FormComponent user={user} onSubmit={onSubmit} onCancel={onCancel} />;
};

export { SafetyFormHost, FormHeavyObject, FormCargoVehicle, FormMusculoskeletal, FormSafetyPlan, FormActionHistory, FormEmergencyPlan, FormHazardSurvey, FormMusculoChecklist, FormRiskAssessment, FormSafetyEducationUpload, FormAccidentReport };
