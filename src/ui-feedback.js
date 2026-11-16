// 화면 알림(잠깐 떴다 사라지는 메시지)과 확인 창을 한 곳에서 관리합니다.
// 브라우저 기본 alert/confirm 대신 notify() / confirmDialog()를 씁니다.
// 실제 화면 그리기는 ui-kit.jsx의 <UiHost />가 맡습니다.

let listeners = new Set();
let state = { toasts: [], dialog: null };
let dialogQueue = [];
let seq = 0;

const emit = () => listeners.forEach((fn) => fn(state));
const setState = (next) => { state = next; emit(); };

export const subscribeFeedback = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
};
export const getFeedbackState = () => state;

// 메시지 문구로 종류(성공/주의/오류/안내)를 짐작합니다.
const classify = (text) => {
    if (/실패|오류|에러|error|할 수 없|불가|거부/i.test(text)) return 'error';
    if (/(주세요|하세요|없습니다|아닙니다|입니다)[.!\s]*$/.test(text) || /입력|선택해|먼저|이미 /.test(text)) return 'warn';
    if (/완료|저장|발송|등록|삭제|복사|되었습니다|했습니다|성공|적용/.test(text)) return 'success';
    return 'info';
};

const showNextDialog = () => {
    if (state.dialog || dialogQueue.length === 0) return;
    setState({ ...state, dialog: dialogQueue.shift() });
};

const openDialog = (dialog) => {
    dialogQueue.push({ id: ++seq, ...dialog });
    showNextDialog();
};

// 확인 창을 닫습니다. (result: 확인=true, 취소=false)
export const closeDialog = (result) => {
    const current = state.dialog;
    if (!current) return;
    setState({ ...state, dialog: null });
    if (current.resolve) current.resolve(!!result);
    showNextDialog();
};

export const dismissToast = (id) => {
    if (!state.toasts.some((t) => t.id === id)) return;
    setState({ ...state, toasts: state.toasts.filter((t) => t.id !== id) });
};

// 알림 메시지. 짧은 글은 잠깐 떴다 사라지고, 길거나 여러 줄인 글은 확인 버튼이 있는 창으로 보여줍니다.
export const notify = (message, opts = {}) => {
    const text = message == null ? '' : String(message);
    if (!text) return;
    if (listeners.size === 0) { window.alert(text); return; }
    const type = opts.type || classify(text);
    if (opts.sticky || text.length > 70 || text.includes('\n')) {
        openDialog({ kind: 'alert', message: text, type });
        return;
    }
    const id = ++seq;
    setState({ ...state, toasts: [...state.toasts.slice(-2), { id, text, type }] });
    setTimeout(() => dismissToast(id), opts.duration || (type === 'error' ? 5200 : 3200));
};

// 확인/취소 창. await confirmDialog('삭제할까요?') → true/false
export const confirmDialog = (message, opts = {}) => {
    const text = message == null ? '' : String(message);
    if (listeners.size === 0) return Promise.resolve(window.confirm(text));
    // 되돌리기 어려운 일(삭제·탈퇴·퇴사 처리 등)을 묻는 창은 빨간 버튼으로 보여줍니다. 질문 첫 줄만 보고 판단합니다.
    const head = text.split('\n')[0];
    const danger = opts.danger != null ? opts.danger : /삭제하시|삭제할까|삭제합니|탈퇴|퇴사 처리|해제할까|초기화|덮어/.test(head);
    return new Promise((resolve) => {
        openDialog({
            kind: 'confirm',
            message: text,
            danger,
            confirmLabel: opts.confirmLabel || (danger && /삭제/.test(head) ? '삭제' : '확인'),
            cancelLabel: opts.cancelLabel || '취소',
            resolve,
        });
    });
};
