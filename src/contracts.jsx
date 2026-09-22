import React, { useState, useMemo, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { toJpeg } from 'html-to-image';
import { auth, db, storage } from './firebase';
import { Icons, DraggableNode, SignaturePadModal, PdfTemplate } from './ui-components';

const ADMIN_EMAIL = 's01025144826@gmail.com';

// contracts.js
// --- Drag & Drop Document Builder ---
const DocumentBuilder = ({ user, onClose, onSaveContract }) => {
    const [bgImgSrc, setBgImgSrc] = useState(null);
    const [fields, setFields] = useState([]); // {id, text, x, y}
    const [signature, setSignature] = useState(null); // {id, dataUrl, x, y}
    const [isSigning, setIsSigning] = useState(false);
    const [contractTitle, setContractTitle] = useState('맞춤형 양식');

    // Upload Custom Image Background
    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            setContractTitle(file.name);
            const reader = new FileReader();
            reader.onload = (evt) => setBgImgSrc(evt.target.result);
            reader.readAsDataURL(file);
        } else {
            alert('이미지 파일(JPG/PNG)만 업로드 가능합니다.');
        }
    };

    // Click background to add text
    const handleBgClick = (e) => {
        if (e.target.tagName.toLowerCase() !== 'img') return;
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const newField = { id: Date.now().toString(), text: '', x, y };
        setFields([...fields, newField]);
    };

    const updateFieldPos = (id, x, y) => {
        setFields(fields.map(f => f.id === id ? { ...f, x, y } : f));
    };
    const updateFieldText = (id, text) => {
        setFields(fields.map(f => f.id === id ? { ...f, text } : f));
    };
    const deleteField = (id) => setFields(fields.filter(f => f.id !== id));

    const handleSignatureSave = (dataUrl) => {
        setSignature({ id: 'sig1', dataUrl, x: 100, y: 100 });
        setIsSigning(false);
    };

    const handleFinalSave = () => {
        if (!bgImgSrc) return alert('배경 이미지를 업로드해주세요.');
        const finalFields = fields.filter(f => f.text.trim() !== '');
        onSaveContract({
            title: contractTitle,
            templateType: 'custom',
            bgImage: bgImgSrc,
            textFields: finalFields,
            signatureField: signature
        });
    };

    return (
        <div className="fixed inset-0 z-40 bg-[#f1f5f9] flex flex-col overflow-hidden animate-fade-in">
            {/* Toolbar */}
            <div className="h-[70px] bg-white border-b border-gray-200 px-6 flex items-center justify-between shadow-sm shrink-0">
                <h2 className="text-xl font-bold flex items-center gap-2"><Icons.Contract /> 에디터: {contractTitle}</h2>
                <div className="flex gap-3">
                    <button onClick={onClose} className="px-5 py-2 rounded-xl text-gray-600 font-bold hover:bg-gray-100 transition-colors">닫기</button>
                    <button disabled={!bgImgSrc} onClick={() => setIsSigning(true)} className="px-5 py-2 rounded-xl text-indigo-600 border border-indigo-200 bg-indigo-50 font-bold disabled:opacity-50">서명 패드</button>
                    <button disabled={!bgImgSrc} onClick={handleFinalSave} className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50 shadow-sm transition-colors">문서 저장 및 등록</button>
                </div>
            </div>

            {/* Workspace */}
            <div className="flex-1 overflow-auto bg-gray-300 p-8 flex justify-center items-start">
                {!bgImgSrc ? (
                    <div className="mt-[10%] text-center">
                        <input type="file" id="bg-upload" onChange={handleImageUpload} accept="image/png, image/jpeg" className="hidden" />
                        <label htmlFor="bg-upload" className="inline-flex flex-col items-center justify-center w-80 h-48 bg-white border-2 border-dashed border-gray-400 rounded-2xl cursor-pointer hover:bg-gray-50 hover:border-blue-500 transition-all shadow-sm">
                            <Icons.Upload />
                            <span className="mt-3 font-bold text-gray-700">빈 양식(이미지) 업로드</span>
                            <span className="text-sm text-gray-500 mt-1">스캔된 계약서나 합의서 JPG/PNG</span>
                        </label>
                    </div>
                ) : (
                    <div className="relative shadow-2xl bg-white select-none" style={{ minWidth: '800px', maxWidth: '1000px' }} onClick={handleBgClick}>
                        <img src={bgImgSrc} alt="template background" className="w-full h-auto pointer-events-auto display-block" draggable={false} />

                        {fields.map(f => (
                            <DraggableNode key={f.id} id={f.id} initialX={f.x} initialY={f.y} onUpdate={updateFieldPos}>
                                <div className="flex items-center gap-1 group bg-white/80 p-0.5 rounded shadow-sm border border-transparent hover:border-blue-300">
                                    <input type="text" value={f.text} onChange={(e) => updateFieldText(f.id, e.target.value)} placeholder="클릭하여 입력" className="bg-transparent text-lg text-black font-semibold outline-none px-1 py-0.5 w-[120px]" />
                                    <button onClick={(e) => { e.stopPropagation(); deleteField(f.id); }} className="text-red-500 bg-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 -mt-3 shadow-md border font-bold text-xs" title="삭제">&times;</button>
                                </div>
                            </DraggableNode>
                        ))}

                        {signature && (
                            <DraggableNode key={signature.id} id={signature.id} initialX={signature.x} initialY={signature.y} onUpdate={(id, x, y) => setSignature({ ...signature, x, y })}>
                                <div className="relative group p-1 border border-transparent hover:border-green-400 rounded">
                                    <img src={signature.dataUrl} alt="서명" className="w-[120px] object-contain drop-shadow" style={{ mixBlendMode: 'multiply' }} draggable={false} />
                                    <button onClick={(e) => { e.stopPropagation(); setSignature(null); }} className="absolute -top-2 -right-2 text-white bg-red-500 rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-md font-bold text-sm" title="삭제">&times;</button>
                                </div>
                            </DraggableNode>
                        )}
                    </div>
                )}
            </div>

            <div className="bg-indigo-900 text-white text-sm py-2 px-6 shadow-inner shrink-0 text-center">
                에디터 사용법: 스캔본 위를 <strong>클릭</strong>하여 글씨 칸을 추가하고 문자를 타이핑합니다. 상단의 <strong>[서명 패드]</strong>로 서명을 추가 후 드래그하여 배치하세요.
            </div>

            {isSigning && <SignaturePadModal onSave={handleSignatureSave} onClose={() => setIsSigning(false)} />}
        </div>
    );
}

// --- Contract Management Page ---
const ContractManagement = ({ user, contracts, setContracts, contacts }) => {
    const [showBuilder, setShowBuilder] = useState(false);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [activePdfContract, setActivePdfContract] = useState(null);
    const [signingContract, setSigningContract] = useState(null);
    const [previewContract, setPreviewContract] = useState(null);

    const isAdmin = user && user.email === ADMIN_EMAIL;
    const visibleContracts = useMemo(() => {
        if (isAdmin) return contracts;
        return contracts.filter(c => c.ownerEmail === user.email || c.targetEmail === user.email);
    }, [user.email, contracts, isAdmin]);

    const [templateData, setTemplateData] = useState({ 
        templateType: 'standard_consignment', 
        targetEmail: '', 
        targetDate: '', 
        routeFees: [{ route: '', unitPrice: '' }], 
        docDate: new Date().toISOString().split('T')[0],
        carNumber: '',
        licenseNumber: ''
    });

    const handleAddRouteFee = () => {
        setTemplateData({
            ...templateData,
            routeFees: [...templateData.routeFees, { route: '', unitPrice: '' }]
        });
    };

    const handleRemoveRouteFee = (index) => {
        if (templateData.routeFees.length === 1) {
            alert('최소 1개의 구역/단가가 필요합니다.');
            return;
        }
        const updated = templateData.routeFees.filter((_, idx) => idx !== index);
        setTemplateData({ ...templateData, routeFees: updated });
    };

    const handleRouteFeeChange = (index, field, value) => {
        const updated = templateData.routeFees.map((rf, idx) => {
            if (idx === index) {
                return { ...rf, [field]: value };
            }
            return rf;
        });
        setTemplateData({ ...templateData, routeFees: updated });
    };

    const handleSaveBuilder = async (docData) => {
        const today = new Date().toISOString().split('T')[0];
        const newDocId = 'contract_' + Date.now().toString();
        let finalBgImage = docData.bgImage;
        let finalSignature = docData.signatureField;
        try {
            if (finalBgImage && finalBgImage.startsWith('data:image')) {
                const bgRef = storage.ref(`contracts/${newDocId}_bg`);
                await bgRef.putString(finalBgImage, 'data_url');
                finalBgImage = await bgRef.getDownloadURL();
            }
            if (finalSignature && finalSignature.dataUrl && finalSignature.dataUrl.startsWith('data:image')) {
                const sigRef = storage.ref(`contracts/${newDocId}_sig`);
                await sigRef.putString(finalSignature.dataUrl, 'data_url');
                finalSignature.dataUrl = await sigRef.getDownloadURL();
            }
            const newRecord = { name: user.name, title: docData.title, ownerEmail: user.email, status: finalSignature ? '서명완료' : '작성중', date: today, templateType: 'custom', bgImage: finalBgImage, textFields: docData.textFields, signatureField: finalSignature || null };
            await db.collection('contracts').doc(newDocId).set(newRecord);
            setShowBuilder(false);
        } catch (e) { console.error(e); alert('계약서 저장 및 업로드 실패: ' + e.message); }
    };

    const validateTemplateData = () => {
        if (!templateData.targetEmail) { alert('서명 요청을 수신할 기사님을 선택해주세요.'); return false; }
        if (templateData.templateType === 'standard_consignment' && !templateData.targetDate) {
            alert('계약 개시일을 입력해주세요.');
            return false;
        }
        const invalid = templateData.routeFees.some(rf => !rf.route || !rf.unitPrice);
        if (invalid || templateData.routeFees.length === 0) {
            alert('담당구역과 수수료 단가를 모두 빠짐없이 입력해주세요.');
            return false;
        }
        return true;
    };

    const buildPreviewContract = () => {
        const targetContact = contacts?.find(c => c.email === templateData.targetEmail);
        const today = new Date().toISOString().split('T')[0];
        return {
            name: targetContact?.name || templateData.targetEmail.split('@')[0],
            title: templateData.templateType === 'standard_consignment' ? '물류표준 위수탁계약서' : '배송단가 부속합의서',
            reqAdminName: user.name,
            status: '서명대기',
            date: templateData.docDate || today,
            templateType: templateData.templateType,
            variables: {
                targetDate: templateData.targetDate,
                routeFees: templateData.routeFees,
                carNumber: templateData.carNumber || '',
                licenseNumber: templateData.licenseNumber || ''
            },
            signatureField: null
        };
    };

    const handlePreviewTemplate = () => {
        if (!validateTemplateData()) return;
        setPreviewContract(buildPreviewContract());
    };

    const handleSendTemplate = async () => {
        if (!validateTemplateData()) return;

        const targetContact = contacts?.find(c => c.email === templateData.targetEmail);
        const today = new Date().toISOString().split('T')[0];
        const newDocId = 'contract_' + Date.now().toString();

        try {
            const newRecord = {
                name: targetContact?.name || templateData.targetEmail.split('@')[0],
                title: templateData.templateType === 'standard_consignment' ? '물류표준 위수탁계약서' : '배송단가 부속합의서',
                ownerEmail: user.email,
                targetEmail: templateData.targetEmail,
                reqAdminName: user.name,
                status: '서명대기',
                date: templateData.docDate || today,
                templateType: templateData.templateType,
                variables: {
                    targetDate: templateData.targetDate,
                    routeFees: templateData.routeFees,
                    carNumber: templateData.carNumber || '',
                    licenseNumber: templateData.licenseNumber || ''
                },
                signatureField: null
            };
            await db.collection('contracts').doc(newDocId).set(newRecord);
            setShowTemplateModal(false);
            setPreviewContract(null);
            // Reset template inputs
            setTemplateData({
                templateType: 'standard_consignment',
                targetEmail: '',
                targetDate: '',
                routeFees: [{ route: '', unitPrice: '' }],
                docDate: new Date().toISOString().split('T')[0],
                carNumber: '',
                licenseNumber: ''
            });
            alert('기사님께 스마트 서명 요청이 발송되었습니다.');
        } catch (e) { alert('빌드 실패: ' + e.message); }
    };

    const handleDriverSign = async (dataUrl) => {
        try {
            await db.collection('contracts').doc(signingContract.id).update({
                signatureField: { dataUrl: dataUrl, x: 0, y: 0 },
                status: '서명완료',
                signedDate: new Date().toISOString().split('T')[0]
            });
            setSigningContract(null);
            alert('서명이 성공적으로 접수되어 최종 PDF 계약서가 자동 생성되었습니다.');
        } catch (e) { alert('서명 실패: ' + e.message); }
    };

    const handleDownloadClick = (contract) => {
        if (!isAdmin && contract.ownerEmail !== user.email && contract.targetEmail !== user.email) return alert('보안 접근 거부');
        setIsGeneratingPdf(true);
        setActivePdfContract(contract);
    };

    const printRef = useRef(null);

    React.useEffect(() => {
        if (activePdfContract && isGeneratingPdf && printRef.current) {
            const generate = async () => {
                const element = printRef.current;
                try {
                    const dataUrl = await toJpeg(element, {
                        quality: 0.95,
                        backgroundColor: '#ffffff',
                        style: {
                            opacity: '1',
                            visibility: 'visible',
                            transform: 'none'
                        }
                    });
                    
                    const pdfWidth = 210; // A4 width in mm
                    const pdfHeight = (element.offsetHeight * pdfWidth) / element.offsetWidth;
                    const pdf = new jsPDF('p', 'mm', [pdfWidth, pdfHeight]);
                    pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfWidth, pdfHeight);

                    pdf.save(`코끼리물류_${activePdfContract.title}_${activePdfContract.name}.pdf`);
                } catch (error) {
                    console.error(error);
                    alert("PDF 생성 중 실패가 발생했습니다: " + error.message);
                } finally {
                    setIsGeneratingPdf(false);
                    setActivePdfContract(null);
                }
            };
            setTimeout(generate, 300);
        }
    }, [activePdfContract, isGeneratingPdf]);


    if (showBuilder) return <DocumentBuilder user={user} onClose={() => setShowBuilder(false)} onSaveContract={handleSaveBuilder} />;
    if (signingContract) return <SignaturePadModal signingContract={signingContract} onClose={() => setSigningContract(null)} onSave={handleDriverSign} />;

    const availableDrivers = (contacts || []).filter(c => c.email && c.email !== ADMIN_EMAIL);

    return (
        <main className="md:ml-[260px] ml-0 px-4 md:px-10 py-6 md:py-12 flex-1 animate-fade-in relative bg-[#F4F7FB] min-h-[100vh]">
            <header className="mb-10 w-full flex flex-col md:flex-row md:justify-between md:items-end gap-4 border-b pb-6 border-gray-200">
                <div className="min-w-0">
                    <h2 className="text-[22px] md:text-[28px] font-extrabold mb-2 text-[#1E293B]">계약관리 (문서 작성 / 조회)</h2>
                    <p className="text-gray-500 text-[15px] font-medium">관리자는 스마트 서명 요청을 보낼 수 있고, 기사님은 원격에서 전자서명을 진행할 수 있습니다.</p>
                </div>
                {isAdmin && (
                    <div className="flex flex-wrap gap-3">
                        <button onClick={() => setShowBuilder(true)} className="flex items-center gap-1.5 whitespace-nowrap bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-5 py-2.5 rounded-xl font-bold shadow-sm transition-colors text-[14px]">
                            <Icons.Plus /> 스캔 양식 문서 생성
                        </button>
                        <button onClick={() => setShowTemplateModal(true)} className="flex items-center gap-1.5 whitespace-nowrap bg-[#2E68ED] hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-[0_4px_12px_rgb(46,104,237,0.3)] transition-colors text-[14px]">
                            <Icons.FileText /> 빠른 계약서(템플릿) 전송
                        </button>
                        <button onClick={() => { setTemplateData({ ...templateData, templateType: 'standard_supplementary' }); setShowTemplateModal(true); }} className="flex items-center gap-1.5 whitespace-nowrap bg-[#2E68ED] hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-[0_4px_12px_rgb(46,104,237,0.3)] transition-colors text-[14px]">
                            <Icons.FileText /> 부속합의서 즉시 등록
                        </button>
                    </div>
                )}
            </header>

            <div className="scroll-container bg-white rounded-[20px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-gray-100">
                <table className="min-w-[650px] w-full divide-y divide-gray-200">
                    <thead className="bg-[#f8fafc]">
                        <tr>
                            <th className="px-6 py-4 text-left text-[14px] font-bold text-gray-500">기사 성함 (제목)</th>
                            <th className="px-6 py-4 text-left text-[14px] font-bold text-gray-500">양식 유형</th>
                            <th className="px-6 py-4 text-left text-[14px] font-bold text-gray-500">생성 / 서명일</th>
                            <th className="px-6 py-4 text-left text-[14px] font-bold text-gray-500">진행 상태</th>
                            <th className="px-6 py-4 text-right text-[14px] font-bold text-gray-500">문서 보기 및 액션</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100/80">
                        {visibleContracts.length === 0 ? <tr><td colSpan={5} className="py-16 text-center text-gray-400 font-bold">생성된 계약 문서가 없습니다.</td></tr> : visibleContracts.map(c => (
                            <tr key={c.id} className="hover:bg-blue-50/20 transition-colors">
                                <td className="px-6 py-5 font-bold text-[15px] text-gray-900">{c.name} <span className="text-gray-400 font-normal ml-1">({c.title})</span></td>
                                <td className="px-6 py-5 text-[14px] font-medium text-gray-600">{c.templateType === 'standard_supplementary' ? '단가 부속합의서' : (c.templateType === 'custom' ? '맞춤 스캔양식' : '위수탁 표준양식')}</td>
                                <td className="px-6 py-5 text-[14px] font-medium text-gray-500">{c.signedDate || c.date}</td>
                                <td className="px-6 py-5">
                                    {c.status === '서명대기' ? (
                                        <span className="px-2.5 py-1.5 text-[13px] font-extrabold rounded-lg bg-red-100 text-red-600 border border-red-200 shadow-sm animate-pulse flex inline-flex items-center gap-1.5"><Icons.AlertTriangle /> 서명 대기</span>
                                    ) : (
                                        <span className="px-2.5 py-1.5 text-[13px] font-extrabold rounded-lg bg-green-100 text-green-700 border border-green-200 flex inline-flex items-center gap-1.5"><Icons.CheckCircle /> 서명 완료</span>
                                    )}
                                </td>
                                <td className="px-6 py-5 flex items-center justify-end gap-3">
                                    {c.status === '서명대기' && c.targetEmail === user.email && (
                                        <button onClick={() => setSigningContract(c)} className="inline-flex gap-1.5 items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[14px] font-extrabold rounded-xl shadow-md transition-colors">
                                            <Icons.Edit2 /> 1분 서명하기
                                        </button>
                                    )}
                                    {(c.status === '서명완료' || isAdmin || c.templateType === 'custom') && (
                                        <button onClick={() => handleDownloadClick(c)} disabled={activePdfContract?.id === c.id && isGeneratingPdf} className="inline-flex gap-1.5 items-center px-4 py-2 bg-gray-50 border border-gray-200 hover:border-gray-300 hover:bg-gray-100 text-gray-700 text-[14px] font-bold rounded-xl shadow-sm transition-colors disabled:opacity-50">
                                            <Icons.Download /> {isGeneratingPdf && activePdfContract?.id === c.id ? '로딩..' : (c.templateType === 'standard_supplementary' ? '부속합의서 다운로드' : '계약서 다운로드')}
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showTemplateModal && (
                <div className="fixed inset-0 z-50 bg-[#0F172A]/40 backdrop-blur-sm flex justify-center items-center py-10 px-4">
                    <div className="bg-white rounded-[24px] w-full max-w-[460px] overflow-hidden shadow-2xl animate-fade-in relative flex flex-col">
                        <div className="px-7 py-6 border-b border-gray-100 flex justify-between items-center bg-[#f8fafc]">
                            <h3 className="text-[20px] font-extrabold text-[#0F172A] flex items-center gap-2"><Icons.FileText /> 스마트 계약서 발송</h3>
                            <button onClick={() => setShowTemplateModal(false)} className="text-gray-400 hover:text-black font-extrabold text-[26px] leading-none transition-colors">&times;</button>
                        </div>
                        <div className="p-7 space-y-5">
                            <div className="flex flex-col gap-2">
                                <label className="text-[14px] font-bold text-gray-700">양식 선택 <span className="text-red-500">*</span></label>
                                <select value={templateData.templateType} onChange={e => setTemplateData({ ...templateData, templateType: e.target.value })} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[15px] font-bold focus:outline-none focus:border-blue-500 transition-colors">
                                    <option value="standard_consignment">물류운송 위수탁계약서 (표준)</option>
                                    <option value="standard_supplementary">배송단가 부속합의서</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[14px] font-bold text-gray-700">계약서 작성일자 <span className="text-red-500">*</span></label>
                                <input type="date" value={templateData.docDate} onChange={e => setTemplateData({ ...templateData, docDate: e.target.value })} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[15px] font-bold focus:outline-none focus:border-blue-500" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[14px] font-bold text-gray-700">서명 대상자 (기사님) 선택 <span className="text-red-500">*</span></label>
                                <select value={templateData.targetEmail} onChange={e => setTemplateData({ ...templateData, targetEmail: e.target.value })} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[15px] font-medium focus:outline-none focus:border-blue-500 transition-colors">
                                    <option value="">-- 비상연락망에서 기사 선택 --</option>
                                    {availableDrivers.map(d => (
                                        <option key={d.id} value={d.email}>{d.name} 기사님 ({d.tag || '미지정'})</option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-400 font-bold">* 이메일 연동이 완료된 기사님만 노출됩니다.</p>
                            </div>
                            {templateData.templateType === 'standard_consignment' && (
                                <>
                                    <div className="flex flex-col gap-2 border-t pt-5 mt-2">
                                        <label className="text-[14px] font-bold text-gray-700">계약 개시일자 <span className="text-red-500">*</span></label>
                                        <input type="date" value={templateData.targetDate} onChange={e => setTemplateData({ ...templateData, targetDate: e.target.value })} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[15px] font-bold focus:outline-none focus:border-blue-500" />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[14px] font-bold text-gray-700">자동차 등록번호</label>
                                        <input type="text" placeholder="예: 12가 3456" value={templateData.carNumber || ''} onChange={e => setTemplateData({ ...templateData, carNumber: e.target.value })} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[15px] font-bold focus:outline-none focus:border-blue-500" />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[14px] font-bold text-gray-700">종사자격증 번호</label>
                                        <input type="text" placeholder="예: 12-34-567890" value={templateData.licenseNumber || ''} onChange={e => setTemplateData({ ...templateData, licenseNumber: e.target.value })} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-[15px] font-bold focus:outline-none focus:border-blue-500" />
                                    </div>
                                </>
                            )}

                            {/* 담당구역 & 단가 동적 추가 영역 (공통) */}
                            <div className="flex flex-col gap-4 border-t pt-5 mt-2">
                                <div className="flex flex-wrap justify-between items-center gap-2">
                                    <label className="text-[14px] font-bold text-gray-700">담당구역 및 위탁 수수료 단가 목록 <span className="text-red-500">*</span></label>
                                    <button type="button" onClick={handleAddRouteFee} className="shrink-0 whitespace-nowrap text-xs bg-[#2E68ED] hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg shadow-sm">
                                        + 구역 추가
                                    </button>
                                </div>
                                
                                <div className="space-y-4 max-h-[200px] overflow-y-auto pr-1">
                                    {templateData.routeFees.map((rf, idx) => (
                                        <div key={idx} className="flex gap-2 items-end bg-gray-50 p-3 rounded-xl border border-gray-100 relative group">
                                            <div className="flex-1 flex flex-col gap-1.5">
                                                <span className="text-[12px] font-bold text-gray-500">구역 {idx + 1}</span>
                                                <input type="text" placeholder="예: 남양주4 A-01" value={rf.route} onChange={e => handleRouteFeeChange(idx, 'route', e.target.value)} className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-[13.5px] font-medium focus:outline-none focus:border-blue-500" />
                                            </div>
                                            <div className="flex-1 flex flex-col gap-1.5">
                                                <span className="text-[12px] font-bold text-gray-500">수수료 단가</span>
                                                <div className="relative">
                                                    <input type="number" placeholder="예: 800" value={rf.unitPrice} onChange={e => handleRouteFeeChange(idx, 'unitPrice', e.target.value)} className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 pr-7 text-[13.5px] font-extrabold text-[#2E68ED] text-right focus:outline-none focus:border-blue-500" />
                                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-[12px]">원</span>
                                                </div>
                                            </div>
                                            {templateData.routeFees.length > 1 && (
                                                <button type="button" onClick={() => handleRemoveRouteFee(idx)} className="shrink-0 bg-red-50 hover:bg-red-100 text-red-500 border border-red-200 p-2.5 rounded-lg text-xs font-bold shadow-sm transition-colors mb-0.5">
                                                    삭제
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="p-7 pt-2 flex gap-3 bg-[#f8fafc]">
                            <button onClick={() => setShowTemplateModal(false)} className="flex-[1] py-3.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-extrabold text-[15px] rounded-xl transition-colors shadow-sm">취소</button>
                            <button onClick={handlePreviewTemplate} className="flex-[2] py-3.5 bg-[#2E68ED] hover:bg-blue-700 text-white font-extrabold text-[15px] rounded-xl shadow-[0_4px_12px_rgb(46,104,237,0.3)] transition-colors flex items-center justify-center gap-1.5">
                                <Icons.Edit2 /> 계약서 미리보기
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {previewContract && (
                <div className="fixed inset-0 z-[60] bg-[#0F172A]/60 backdrop-blur-sm flex justify-center items-center py-8 px-4">
                    <div className="bg-white rounded-[24px] w-full max-w-[900px] max-h-[92vh] overflow-hidden shadow-2xl animate-fade-in flex flex-col">
                        <div className="px-7 py-5 border-b border-gray-100 flex justify-between items-center bg-[#f8fafc] shrink-0">
                            <div>
                                <h3 className="text-[18px] font-extrabold text-[#0F172A] flex items-center gap-2"><Icons.FileText /> 계약서 미리보기</h3>
                                <p className="text-[13px] text-gray-500 font-medium mt-1">내용을 확인하고, 필요하면 수정 후 다시 미리보기 해주세요. 이 화면에서는 아직 발송되지 않습니다.</p>
                            </div>
                            <button onClick={() => setPreviewContract(null)} className="text-gray-400 hover:text-black font-extrabold text-[26px] leading-none transition-colors shrink-0 ml-4">&times;</button>
                        </div>
                        <div className="flex-1 overflow-y-auto bg-gray-100 py-8 px-4">
                            <PdfTemplate contract={previewContract} preview />
                        </div>
                        <div className="p-6 flex gap-3 bg-[#f8fafc] border-t border-gray-100 shrink-0">
                            <button onClick={() => setPreviewContract(null)} className="flex-[1] py-3.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-extrabold text-[15px] rounded-xl transition-colors shadow-sm break-keep">
                                돌아가서 수정
                            </button>
                            <button onClick={handleSendTemplate} className="flex-[2] py-3.5 bg-[#2E68ED] hover:bg-blue-700 text-white font-extrabold text-[15px] rounded-xl shadow-[0_4px_12px_rgb(46,104,237,0.3)] transition-colors break-keep">
                                이 내용으로 서명 요청 발송하기
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {activePdfContract && (
                <PdfTemplate contract={activePdfContract} templateRef={printRef} />
            )}
        </main>
    );
};

export { DocumentBuilder, ContractManagement };

