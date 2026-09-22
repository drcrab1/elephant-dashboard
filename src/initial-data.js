// --- 최초 시딩(seed)용 초기 데이터 모음 ---
// 각 관리 화면(contracts.jsx, safety.jsx 등)에서 정의하던 INITIAL_* 상수를
// 별도 파일로 분리했습니다. App.jsx가 이 파일만 정적으로 import하면 되므로,
// 각 관리 화면 컴포넌트(용량이 큰 SafetyManagement 등)는 실제로 그 메뉴에
// 진입할 때만 로드(lazy load)할 수 있습니다.

const SEED_SAFETY_CHECKLIST_ITEMS = [
    '차량 타이어 마모 및 공기압 상태 점검',
    '운전석 및 조수석 안전벨트 결박 작동 상태 확인',
    '화물 적재함 고정바 결속 및 보호망 파손 여부 점검',
    '안전모, 반사조끼 등 필수 개인 보호구 착용',
    '전조등, 후미등, 비상깜빡이 점등 이상 유무'
];

export const INITIAL_CONTRACTS = [];

export const INITIAL_CONTACTS = [
    { id: '1', name: '대표', role: '대표이사', tag: '전체', phone: '010-0000-0000', type: 'internal' },
    { id: '2', name: '관리자', role: '운영관리', tag: '전체', phone: '010-0000-0000', type: 'internal' },
    { id: '3', name: '구리2캠프 담당', role: '캠프매니저', tag: '구리2', phone: '010-0000-0000', type: 'internal' },
    { id: '4', name: '남양주4캠프 담당', role: '캠프매니저', tag: '남양주4', phone: '010-0000-0000', type: 'internal' },
    { id: '5', name: '송파4캠프 담당', role: '캠프매니저', tag: '송파4', phone: '010-0000-0000', type: 'internal' },
    { id: '6', name: '권오민', role: '코끼리', tag: '전체', phone: '010-2514-4826', type: 'internal' },
];

export const INITIAL_VEHICLE_DOCS = [];

export const INITIAL_WORK_RECORDS = [
    { id: 'wr_1', date: '2026-03-31', name: '홍길동', email: 'employeeA@gmail.com', route: '남양주4', quantity: 150 },
    { id: 'wr_2', date: '2026-04-01', name: '홍길동', email: 'employeeA@gmail.com', route: '구리2', quantity: 140 },
];

export const INITIAL_SAFETY_RECORDS = [
    { id: 'safe_1', date: '2026-04-01', name: '홍길동', email: 'employeeA@gmail.com', status: '모두 정상', items: SEED_SAFETY_CHECKLIST_ITEMS.map(task => ({ task, isChecked: true, memo: '이상 없음', photo: null })) }
];

export const INITIAL_ROUTES = [
    { id: 'route_1', name: '구리2A (토평/수택)', camp: '구리2캠프', tips: '토평 상가구역 진입 시 후문 주차장이 여유롭습니다.', mapUrl: null, createdBy: '관리자', updatedAt: new Date().toISOString() },
    { id: 'route_2', name: '남양주4B (다산신도시)', camp: '남양주4캠프', tips: '다산 아파트 101동~105동 지하주차장 높이 2.7m 제한 유의.', mapUrl: null, createdBy: '관리자', updatedAt: new Date().toISOString() },
    { id: 'route_3', name: '송파4C (문정/가락)', camp: '송파4캠프', tips: '문정 훼미리아파트 지하 엘리베이터 짝수층/홀수층 운행 확인.', mapUrl: null, createdBy: '관리자', updatedAt: new Date().toISOString() }
];
