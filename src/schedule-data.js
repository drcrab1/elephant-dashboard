import { db } from './firebase';

// 배차표(구글 시트)를 읽어 오는 공용 도구 — 스케줄 화면과 홈 화면이 같이 씁니다.

// 노선 이름 기본값 (관리자가 스케줄 화면의 '노선 이름 관리'에서 바꾸면 settings/schedule.routeColumns에 저장됩니다)
export const DEFAULT_ROUTE_COLUMNS = ['503AB', '503CD', '402CD', '001CD', '901CD', '452ABCD', '454ABD', '452D+454B', '303CD'];

// 배차표의 날짜 표기("11월16일")
export const csvDateLabel = (d) => `${d.getMonth() + 1}월${d.getDate()}일`;

// 시트 CSV → [{ csvDate: '11월16일', route: '503AB', driver: '홍길동' }, ...]
export const parseScheduleCsv = (csv, routeColumns) => {
    const result = [];
    csv.split('\n').forEach((r) => {
        const cols = r.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
        if (cols.length < 12) return;
        if (cols[0].replace(/\s+/g, '') === '출근일') return; // 헤더 무시
        const rawDate = cols[0].replace(/\s+/g, ''); // "1월1일"
        routeColumns.forEach((route, i) => {
            const driverName = cols[3 + i]; // D열(인덱스 3)부터 시작
            if (driverName && driverName !== '') result.push({ csvDate: rawDate, route, driver: driverName });
        });
    });
    return result;
};

// 배차 칸의 이름("홍길동", "홍길동,김철수")이 이 사람을 가리키는지 — 서버 알림(이름 매칭)과 같은 기준
export const cellHasDriver = (cell, name) => {
    if (!cell || !name) return false;
    const target = name.trim();
    return cell.split(/[,/+&]/).map((s) => s.trim()).filter(Boolean)
        .some((token) => token === target || (token.length >= 2 && (target.includes(token) || token.includes(target))));
};

let cache = null; // { at, promise }

// 배차표 불러오기 (5분 동안은 다시 받지 않고 재사용)
export const loadSchedule = ({ force = false } = {}) => {
    if (!force && cache && Date.now() - cache.at < 5 * 60 * 1000) return cache.promise;
    const promise = (async () => {
        const doc = await db.collection('settings').doc('schedule').get();
        const data = doc.exists ? doc.data() : {};
        const routeColumns = Array.isArray(data.routeColumns) && data.routeColumns.length > 0 ? data.routeColumns : DEFAULT_ROUTE_COLUMNS;
        if (!data.csvUrl) return { linked: false, routeColumns, rows: [] };
        const res = await fetch(data.csvUrl);
        const csv = await res.text();
        return { linked: true, routeColumns, rows: parseScheduleCsv(csv, routeColumns) };
    })();
    cache = { at: Date.now(), promise };
    promise.catch(() => { if (cache && cache.promise === promise) cache = null; });
    return promise;
};
