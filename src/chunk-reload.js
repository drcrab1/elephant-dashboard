// 새 버전이 배포되면 이전 화면 조각 파일이 사라져 메뉴를 열 때 오류가 날 수 있습니다.
// 이 경우 한 번 자동으로 새로고침합니다. (1분 안에 반복되면 하지 않음)
const RELOAD_KEY = 'chunk-reload-at';

export const isChunkError = (e) => /dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError/i.test((e && (e.message || String(e))) || '');

export const reloadOnce = () => {
    try {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
        if (Date.now() - last < 60000) return false;
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    } catch { return false; /* 저장소를 못 쓰는 환경이면 자동 새로고침 없이 안내 화면 */ }
    window.location.reload();
    return true;
};

export const installChunkReload = () => {
    window.addEventListener('vite:preloadError', (ev) => { if (reloadOnce()) ev.preventDefault(); });
};
