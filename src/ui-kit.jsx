import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { subscribeFeedback, getFeedbackState, closeDialog, dismissToast } from './ui-feedback';

// 앱 전체에서 같이 쓰는 화면 부품: 알림 메시지·확인 창(UiHost), 로딩 표시, 빈 화면 안내

const TOAST_STYLE = {
    success: { box: 'bg-ink text-white', icon: '✓', iconBox: 'bg-emerald-500 text-white' },
    error: { box: 'bg-red-600 text-white', icon: '!', iconBox: 'bg-white text-red-600' },
    warn: { box: 'bg-amber-500 text-white', icon: '!', iconBox: 'bg-white text-amber-600' },
    info: { box: 'bg-ink text-white', icon: 'i', iconBox: 'bg-white/20 text-white' },
};

const DIALOG_TITLE = { success: '완료', error: '문제가 생겼습니다', warn: '확인해 주세요', info: '안내' };

const FeedbackDialog = ({ dialog }) => {
    const okRef = useRef(null);
    const isConfirm = dialog.kind === 'confirm';

    useEffect(() => {
        if (okRef.current) okRef.current.focus();
        const onKey = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); closeDialog(false); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [dialog.id]);

    return (
        <div className="fixed inset-0 z-[1000] bg-ink/50 flex items-end sm:items-center justify-center p-4" onClick={() => closeDialog(false)}>
            <div
                role={isConfirm ? 'alertdialog' : 'dialog'}
                aria-modal="true"
                className="ui-pop bg-white w-full max-w-[400px] rounded-[22px] shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-6 pt-6 pb-5">
                    <p className="text-[17px] font-extrabold text-ink mb-2">
                        {isConfirm ? (dialog.danger ? '정말 진행할까요?' : '확인') : DIALOG_TITLE[dialog.type] || '안내'}
                    </p>
                    <p className="text-[14.5px] leading-relaxed text-gray-600 font-medium whitespace-pre-line break-words max-h-[50vh] overflow-y-auto">{dialog.message}</p>
                </div>
                <div className="px-4 pb-4 flex gap-2">
                    {isConfirm && (
                        <button type="button" onClick={() => closeDialog(false)} className="flex-1 py-3.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-[15px] transition-colors">
                            {dialog.cancelLabel}
                        </button>
                    )}
                    <button
                        ref={okRef}
                        type="button"
                        onClick={() => closeDialog(true)}
                        className={`flex-1 py-3.5 rounded-xl text-white font-extrabold text-[15px] transition-colors ${isConfirm && dialog.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand hover:bg-blue-700'}`}
                    >
                        {isConfirm ? dialog.confirmLabel : '확인'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// 알림 메시지와 확인 창을 실제로 그리는 곳. main.jsx에서 앱 옆에 한 번만 둡니다.
export const UiHost = () => {
    const state = useSyncExternalStore(subscribeFeedback, getFeedbackState);

    // 키보드 Esc로 팝업 닫기: 맨 위에 떠 있는 팝업(ui-overlay)의 닫기(×) 버튼을 눌러 줍니다.
    // (확인 창이 떠 있을 때는 확인 창이 직접 처리합니다)
    useEffect(() => {
        const onKey = (e) => {
            if (e.key !== 'Escape' || getFeedbackState().dialog) return;
            const overlays = document.querySelectorAll('.ui-overlay');
            const top = overlays[overlays.length - 1];
            const closeButton = top && top.querySelector('.ui-close');
            if (closeButton) { e.preventDefault(); closeButton.click(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    return (
        <>
            {/* 화면 위쪽에 띄웁니다 — 아래쪽에 있는 저장·제출 버튼과 하단 탭을 가리지 않도록 */}
            <div className="fixed left-0 md:left-[260px] right-0 top-[72px] md:top-6 z-[1001] flex flex-col items-center gap-2 px-4 pointer-events-none" role="status" aria-live="polite">
                {state.toasts.map((t) => {
                    const s = TOAST_STYLE[t.type] || TOAST_STYLE.info;
                    return (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => dismissToast(t.id)}
                            className={`ui-toast pointer-events-auto max-w-[min(92vw,460px)] flex items-center gap-2.5 pl-3 pr-4 py-3 rounded-2xl shadow-[0_8px_30px_rgba(15,23,42,0.25)] text-left ${s.box}`}
                        >
                            <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[13px] font-extrabold ${s.iconBox}`}>{s.icon}</span>
                            <span className="text-[14.5px] font-bold leading-snug">{t.text}</span>
                        </button>
                    );
                })}
            </div>
            {state.dialog && <FeedbackDialog dialog={state.dialog} />}
        </>
    );
};

export const Spinner = ({ className = '' }) => (
    <span className={`inline-block w-5 h-5 rounded-full border-[2.5px] border-gray-200 border-t-brand animate-spin ${className}`} aria-hidden="true" />
);

// 화면을 불러오는 동안 보여주는 표시
export const PageLoading = ({ label = '불러오는 중...' }) => (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 py-24 text-gray-400 font-bold text-[14px] md:ml-[260px]">
        <Spinner />
        {label}
    </div>
);

// 보여줄 내용이 없을 때의 안내
export const EmptyState = ({ icon = '📭', title, desc, action }) => (
    <div className="bg-white rounded-2xl border border-gray-100 px-6 py-12 text-center">
        <div className="text-[32px] mb-2" aria-hidden="true">{icon}</div>
        <p className="text-[15px] font-extrabold text-gray-700">{title}</p>
        {desc && <p className="text-[13.5px] text-gray-400 font-medium mt-1">{desc}</p>}
        {action && <div className="mt-4">{action}</div>}
    </div>
);
