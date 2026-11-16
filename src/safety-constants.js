export const formatPhoneNumber = (value) => {
    if (!value) return '';
    const raw = value.replace(/[^0-9]/g, '');
    if (raw.length <= 3) return raw;
    if (raw.length <= 7) return `${raw.slice(0, 3)}-${raw.slice(3)}`;
    if (raw.length <= 11) return `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7)}`;
    return `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 11)}`;
};


// --- Definitions & Constants ---
export const SAFETY_CHECKLIST_ITEMS = [
    '차량 타이어 마모 및 공기압 상태 점검',
    '운전석 및 조수석 안전벨트 결박 작동 상태 확인',
    '화물 적재함 고정바 결속 및 보호망 파손 여부 점검',
    '안전모, 반사조끼 등 필수 개인 보호구 착용',
    '전조등, 후미등, 비상깜빡이 점등 이상 유무'
];

export const HEAVY_OBJECT_CHECKS = [
    '운반물의 중량은 장비의 정격하중 이내인가?',
    '중량물은 항상 아래쪽에 적재 하였는가?',
    '운반물 취급방법, 순서 등을 작업자가 숙지하고 있는가?',
    '작업자가 운반물을 들어 올릴 때 편하중이 생기지 않는 위치 및 줄걸이 방법을 알고 있는가?',
    '운반이 용이하도록 통로는 안전하게 확보 되었는가?',
    '작업 시작 전 장비를 점검한 결과 문제가 없는가?',
    '월1회 정기점검을 실시하고, 문제점 발견시 개선하였는가?'
];

export const CARGO_WORK_PLAN_ITEMS = [
    { idx: 1, section: '운전자 자격', q: '운전자의 적정 자격*을 확인한다.\n* 화물운송자격증, (12톤미만) 1종 보통면허\n(12톤이상) 1종 대형면허' },
    { idx: 2, section: '기계 검사', q: '법정* 필수 검사를 받았는지 확인한다.\n* 「자동차관리법」 제43조 등' },
    { idx: 3, section: '작업 전 조치', q: '운행경로 및 작업방법 등을 고려한 작업계획을 수립하고 작업지휘자를 지정한다.' },
    { idx: 4, section: '작업 전 조치', q: '상하차 장소, 운행경로의 지형 및 지반 상태를 확인하고 트럭이 넘어지지 않도록 조치한다.' },
    { idx: 5, section: '작업 전 조치', q: '가설도로는 무너지지 않도록 견고하게 설치하고, 차량이 굴러떨어지지 않도록 도로 폭을 확보한다.' },
    { idx: 6, section: '작업 전 조치', q: '제동장치ㆍ조종장치, 하역장치ㆍ유압장치의 기능 및 바퀴의 이상 유무를 점검한다.' },
    { idx: 7, section: '작업 전 조치', q: '후진 경보장치, 후방카메라 등의 정상 작동 여부를 확인한다.' },
    { idx: 8, section: '운행 및 작업 중 조치', q: '운행경로에 작업자의 출입을 통제하거나 유도자를 배치하여 작업자가 부딪히지 않도록 한다.' },
    { idx: 9, section: '운행 및 작업 중 조치', q: '화물 적재함에는 작업자의 탑승을 금지하고, 부득이 탑승하는 경우 추락방지 조치를 한다.' },
    { idx: 10, section: '운행 및 작업 중 조치', q: '화물 적재 시 불안정하게 높이 쌓아 올리거나 적재중량을 고려하여 과적하지 않는다.' },
    { idx: 11, section: '운행 및 작업 중 조치', q: '화물 적재 시 적재된 화물이 흔들리지 않도록 로프, 철물 등으로 견고하게 고정한다.' },
    { idx: 12, section: '운행 및 작업 중 조치', q: '적재된 화물을 내리는 작업을 할 때는 화물 중간에서 빼내지 않도록 한다.' },
    { idx: 13, section: '운행 및 작업 중 조치', q: '현장 내 제한속도를 표시하고 준수토록 한다.' },
    { idx: 14, section: '운행 및 작업 중 조치', q: '운전자는 안전벨트를 착용한다.' },
    { idx: 15, section: '수리 등 점검 시', q: '주정차 시 브레이크를 체결하고, 시동키를 분리하며, 경사면에는 고임목을 설치한다.' },
    { idx: 16, section: '수리 등 점검 시', q: '수리ㆍ점검 시 안전블록, 안전지주 등을 사용하여 적재함 등의 갑작스러운 하강을 방지한다.' }
];

export const MUSCULO_HAZARDS = [
    { id: 'm1', label: '단순 반복 작업', icon: '🔄', desc: '같은 동작 반복 (상차/하차/분류)' },
    { id: 'm2', label: '무리한 자세', icon: '🧍', desc: '허리 구부림/비틂, 쪼그려 앉음' },
    { id: 'm3', label: '과도한 하중', icon: '🏋️', desc: '25kg 이상 무거운 화물 취급' },
    { id: 'm4', label: '불량한 그립', icon: '🖐️', desc: '미끄럽거나 잡기 힘든 박스 취급' }
];

export const RISK_ASSESSMENT_ITEMS = [
    { target: '화물 적재', hazard: '부적절한 자세, 반복작업으로 인한 근골격계질환 위험이 있는가? \n※ 상품무게, 작업량', currentRisk: '보통', decision: '보완', measure: '제품 무게 및 무게중심 확인\n작업전 스트레칭 실시', targetDate: '2026-07-01', owner: '권오민' },
    { target: '화물 적재', hazard: 'RT 또는 이동대차 이동 간 발이나 손 등의 신체부위 부딪히는 위험이 있는가?', currentRisk: '낮음', decision: '보완', measure: 'RT/이동대차 운반 수칙 안전교육\n슬리퍼·크록스 착용금지\n이동경로 확인', targetDate: '2026-07-01', owner: '권오민' },
    { target: '차량 운전', hazard: '차량 진입 시 사람/차량 또는 시설물과의 충돌위험이 있는가? \n※ 차량 적재함 높이, 폭', currentRisk: '높음', decision: '보완', measure: '서행운전 및 속도 준수\n주차시 후면주차\n무단시 변속레버 "P"확인', targetDate: '2026-07-01', owner: '권오민' },
    { target: '차량 운전', hazard: '차량 탑의 측면 또는 후면 도어에 손 등 신체부위 끼임이 발생할 위험이 있는가?', currentRisk: '보통', decision: '보완', measure: '도어 개폐시 손 끼임 주의 확인\n작업시 장갑 착용', targetDate: '2026-07-01', owner: '권오민' },
    { target: '차량 운전', hazard: '차량 적재 불량으로 인한 낙하 위험이 있는가?', currentRisk: '낮음', decision: '보완', measure: '적재함 정리정돈\n적재 하중고려하여 적재', targetDate: '2026-07-01', owner: '권오민' },
    { target: '차량 운전', hazard: '배송지로 차량 운행시 교통사고등의 위험이 있는가? \n※ 주/야간, 기상상황 등', currentRisk: '높음', decision: '보완', measure: '전방/측방/후방 주시 철저\n운행전 차량점검\n방어운전 실시', targetDate: '2026-07-01', owner: '권오민' },
    { target: '차량운전', hazard: '차량 이탈 및 재시동시 차량의 갑작스런 이동에 의한 충돌 위험이 있는가?', currentRisk: '보통', decision: '보완', measure: '차량 하차 및 시동 전 반드시 변속레버 "P" 확인\n경사로 주차를 지양하고 부득이 주차시 고임목 등 설치', targetDate: '2026-07-01', owner: '권오민' },
    { target: '차량운전', hazard: '화물의 고정작업 등 적재함 내 작업시 불균형이나 충격으로 하부로 추락할 위험이 있는가?', currentRisk: '보통', decision: '보완', measure: '적재함 작업시 차량 정차상태 확인 후 실시\n2인1조 작업시 적재함 내 인원이 탄 상태로 차량이동 금지', targetDate: '2026-07-01', owner: '권오민' },
    { target: '차량운전', hazard: '차량 운행 중 휴대폰 등 기타 미디어 사용으로 인한 차량 사고 위험이 있는가?', currentRisk: '높음', decision: '보완', measure: '차량 운행시 휴대폰 및 미디기기 절대 사용금지\n차량 정차 후 재출발시 반드시 차량 주변 상태 확인', targetDate: '2026-07-01', owner: '권오민' },
    { target: '배송', hazard: '화물을 들고 이동시 미끄러짐 및 계단을 오르내던 중 넘어짐 위험이 있는가?', currentRisk: '보통', decision: '보완', measure: '배송백 및 카트등 사용으로 시야 확보\n슬리퍼·크록스 착용금지\n제품을 과도하게 들지 않기', targetDate: '2026-07-01', owner: '권오민' },
    { target: '배송', hazard: '배송시 애완 동물에게 물릴 위험이 있는가?', currentRisk: '낮음', decision: '보완', measure: '동물이 있을경우 우회 이동\n긴바지 등 착용\n동물주인에게 관리 요청', targetDate: '2026-07-01', owner: '권오민' },
    { target: '비상 대응', hazard: '교통사고/응급상황 발생 위험이 있는가?', currentRisk: '낮음', decision: '보완', measure: '응급조치 교육\n119 신구\n보험사 등 비상연락체계 확인', targetDate: '2026-07-01', owner: '권오민' },
    { target: '혹서기', hazard: '혹서기 배송시 건강장해 위험이 있는가?', currentRisk: '낮음', decision: '보완', measure: '혹서기 개인물품 지급(쿨토시, 쿨스카프, 물안경)\n취식물 지급(물, 이온음료, 포도당)\n휴게시간 부여', targetDate: '2026-07-01', owner: '권오민' },
    { target: '혹한기', hazard: '혹한기 배송시 건강장해 위험이 있는가?', currentRisk: '낮음', decision: '보완', measure: '혹한기 개인물품 지급(핫팩,방한조끼,귀도리 등)\n취식물 지급(따뜻한 물 등)\n휴게시간 부여', targetDate: '2026-07-01', owner: '권오민' },
    { target: '화물 적재', hazard: '테이블리프트 하강 중 접근금지 도색구역 침범 및 임의 도어 해체로 인한 끼임·협착 위험이 있는가?', currentRisk: '높음', decision: '보완', measure: '끼임 및 협착 위험에 대해 안전교육\n작업장소로 설정된 구간 내 접근 금지\n테이블리프트 등 장비 임의 조작 금지', targetDate: '2026-07-01', owner: '권오민' },
    { target: '화물 적재', hazard: 'RT 취급 간 지형지물 또는 수분에 의해 미끄러져 넘어질 위험이 있는가?', currentRisk: '보통', decision: '보완', measure: '미끄러지지 않는 작업화 착용\n미끄럼구간 이동시 뛰거나 넘어지지 않도록 주의', targetDate: '2026-07-01', owner: '권오민' },
    { target: '화물 적재', hazard: '박스 내용물 중 중량물(아령 등)이 담긴 경우 박스가 파손되면서 낙하하여 부상이 발생할 위험이 있는가?', currentRisk: '보통', decision: '보완', measure: '적재시 박스 상태 확인\n중량물은 하단에 적재\n배송시 카트 활용', targetDate: '2026-07-01', owner: '권오민' },
    { target: '화물 적재', hazard: '사업장 내 본인 차량에서의 흡연으로 인한 화재 위험이 있는가?', currentRisk: '보통', decision: '보완', measure: '지정된 장소에서만 흡연하도록 교육', targetDate: '2026-07-01', owner: '권오민' },
    { target: '화물 적재', hazard: '화물을 상/하차하기 위해 차량 적재함에 올라가던 중 넘어질 위험이 있는가?', currentRisk: '보통', decision: '보완', measure: '적재함 내 논슬립 테이프 등으로 미끄럼 방지조치', targetDate: '2026-07-01', owner: '권오민' },
    { target: '화물 적재', hazard: '가림막 해제 간 고리 불량, 장력 등에 의해 신체에 맞을 위험이 있는가?', currentRisk: '낮음', decision: '보완', measure: '가림막 고리 해체시 고리를 끝까지 파지하도록 교육', targetDate: '2026-07-01', owner: '권오민' },
    { target: '화물 적재', hazard: 'RT에 화물이 떨어져 작업자의 신체 부위에 낙하하여 맞을 위험이 있는가?', currentRisk: '보통', decision: '보완', measure: '낙하 위험 화물이 있는지 수시로 확인하도록 교육', targetDate: '2026-07-01', owner: '권오민' },
    { target: '차량 운전', hazard: '업무 전 과음으로 인한 음주운전 발생 위험이 있는가?', currentRisk: '높음', decision: '보완', measure: '음주 운전 예방 교육 실시', targetDate: '2026-07-01', owner: '권오민' },
    { target: '차량 운전', hazard: '운전석 하차 시 발목 접질림 사고가 발생할 위험이 있는가?', currentRisk: '낮음', decision: '보완', measure: '하차 전 바닥 상태 확인 후 하차하도록 교육', targetDate: '2026-07-01', owner: '권오민' },
    { target: '차량 운전', hazard: '악천후(강우, 강설, 태풍 등) 예보에 따른 대인/대물사고 발생 위험이 있는가?', currentRisk: '보통', decision: '보완', measure: '강설 등 악천후 예보시 체인 등 확인 및 준비\n출차 전 악천후시 행동요령 사전 교육', targetDate: '2026-07-01', owner: '권오민' },
    { target: '차량 운전', hazard: '주행 중 인화성 물질에 의한 화재 발생 위험이 있는가?', currentRisk: '보통', decision: '보완', measure: '주행 중 흡연 금지\n차량 내부 인화성 물질 관리 교육', targetDate: '2026-07-01', owner: '권오민' },
    { target: '차량 운전', hazard: '차량 주행시 타이어 마모로 바퀴가 미끄러져 구조물 또는 작업자와의 충돌 위험이 있는가?', currentRisk: '보통', decision: '보완', measure: '타이어 및 공기압 점검 교육', targetDate: '2026-07-01', owner: '권오민' },
    { target: '차량 운전', hazard: '사업장 내 지정되지 않은 구간(근로자통행로) 불법 주정차로 근로자와 충돌할 위험이 있는가?', currentRisk: '보통', decision: '보완', measure: '사업장 내 입출차 통행로 이용 교육\n보행자 통로 임의주정차 금지 교육', targetDate: '2026-07-01', owner: '권오민' },
    { target: '배송', hazard: '배송완료 사진 촬영 및 전송 중 시설물 충돌 및 넘어짐 위험이 있는가?', currentRisk: '낮음', decision: '보완', measure: '충분한 공간 확보 후 사진촬영 교육\n촬영 전 주변 위험요인 확인 교육', targetDate: '2026-07-01', owner: '권오민' },
    { target: '배송', hazard: '야간 도보 배송시 바닥의 단차, 장애물 등을 확인하지 못하여 전도사고가 발생할 위험이 있는가?', currentRisk: '보통', decision: '보완', measure: '넘어짐사고 예방 안전교육\n랜턴 등 사용으로 조도 확보 독려', targetDate: '2026-07-01', owner: '권오민' },
    { target: '배송', hazard: '다수 및 고중량 물품 배송시 요통 등 근골격계 질환·질병이 발생할 위험이 있는가?', currentRisk: '보통', decision: '보완', measure: '작업 전·중·후 스트레칭 안내\n고중량 물품 배송시 핸드카트 사용 교육', targetDate: '2026-07-01', owner: '권오민' },
    { target: '배송', hazard: '배송 중 우천으로 인한 바닥의 물기, 빙판으로 보행시 전도사고가 발생할 위험이 있는가?', currentRisk: '보통', decision: '보완', measure: 'TBM시 기상이슈에 따른 동종사고사례 교육\n미끄러움을 예측하고 뛰지 않도록 교육', targetDate: '2026-07-01', owner: '권오민' },
    { target: '배송', hazard: '배송지 도착 후 차량 하차시 바닥의 단차 또는 장애물에 발을 헛디뎌 전도사고가 발생할 위험이 있는가?', currentRisk: '보통', decision: '보완', measure: '차량 문 손잡이를 잡고 천천히 하차하도록 교육\n하차시 바닥 단차·장애물 확인 안내', targetDate: '2026-07-01', owner: '권오민' },
    { target: '배송', hazard: '운행 중 타차량과의 충돌 위험이 있는가?', currentRisk: '보통', decision: '보완', measure: '방어운전 및 전방주시 철저 교육\n보조 사이드미러 설치 권고', targetDate: '2026-07-01', owner: '권오민' },
    { target: '배송', hazard: '보행 시 요철부 등에 넘어지거나 걸리는 위험이 있는가?', currentRisk: '낮음', decision: '보완', measure: '배송백 및 카트 등 사용으로 시야 확보 교육\n이동간 휴대폰 촬영·입력 금지 교육', targetDate: '2026-07-01', owner: '권오민' },
    { target: '배송', hazard: '차량 누전에 따른 화재가 발생할 위험이 있는가?', currentRisk: '보통', decision: '보완', measure: '차량 정비는 전문 외부업체를 통해 진행\n차량 출발 전 운전자 점검 교육', targetDate: '2026-07-01', owner: '권오민' },
    { target: '배송', hazard: '주차 시 "D" 또는 "R"에 위치한 상태에서 하차할 위험이 있는가?', currentRisk: '보통', decision: '보완', measure: '주차시 주차 상태 확인 교육\n경사로 주차시 기어변속기 "1단/P" 및 사이드브레이크 체결 후 시동 OFF 교육', targetDate: '2026-07-01', owner: '권오민' },
    { target: '배송', hazard: '슬라이딩 도어에 손가락이 끼일 위험이 있는가?', currentRisk: '낮음', decision: '보완', measure: '문 닫을 시 면밀히 확인하도록 안내', targetDate: '2026-07-01', owner: '권오민' },
    { target: '배송', hazard: '엘리베이터 이용 중 협착·전도 위험이 있는가?', currentRisk: '낮음', decision: '보완', measure: '문열림·닫힘 버튼 확인 후 이동 교육\n엘리베이터 턱 확인 후 이동 안내', targetDate: '2026-07-01', owner: '권오민' },
    { target: '기타', hazard: '부적합한 신발(슬리퍼, 크록스 등) 착용 후 작업을 진행할 위험이 있는가?', currentRisk: '보통', decision: '보완', measure: '슬리퍼, 크록스 착용 금지 안내\n안전화 착용 권고', targetDate: '2026-07-01', owner: '권오민' },
    { target: '기타', hazard: '출차구간 내 근로자가 임의로 보행하여 사고가 발생할 위험이 있는가?', currentRisk: '보통', decision: '보완', measure: '사업장 내 이동 시 반드시 보행자 통로를 통해 이동하도록 교육', targetDate: '2026-07-01', owner: '권오민' }
];

// --- Recurring Safety Task Checklist (매일/매주/매월/매년) ---
export const SAFETY_RECURRING_TASKS = [
    { id: 'tbm', freq: 'daily', title: '작업 전 TBM(안전미팅)', desc: '배차 전 당일 위험요인 공유 및 안전수칙 재확인', perUser: true },
    { id: 'daily_vehicle_check', freq: 'daily', title: '일일 차량·장비 점검', desc: '타이어, 브레이크, 적재함 도어, 후방카메라 등 운행 전 점검', perUser: true },
    { id: 'weekly_tire', freq: 'weekly', title: '타이어·공기압 점검', desc: '차량별 타이어 마모 상태 및 공기압 확인', perUser: true },
    { id: 'monthly_edu', freq: 'monthly', title: '월간 안전교육 실시', desc: '전 직원 대상 안전수칙 및 사고사례 교육', perUser: true },
    { id: 'vehicle_inspection', freq: 'daily', title: '일일 자동차 안전점검표', desc: '번호판·등화장치·타이어·안전벨트 등 11개 항목 점검 (법정 서식)', perUser: true },
    { id: 'monthly_fire', freq: 'monthly', title: '소화기 등 소방시설 점검', desc: '소화기 압력게이지, 비상구, 유도등 등 점검' },
    { id: 'yearly_risk', freq: 'yearly', title: '위험성평가 정기평가', desc: '사업장 전체 위험성평가 연 1회 실시 (산업안전보건법)' },
    { id: 'yearly_edu', freq: 'yearly', title: '정기 안전보건교육 이수', desc: '근로자 정기교육 및 관리감독자 교육 이수' },
    { id: 'yearly_health', freq: 'yearly', title: '근로자 건강검진', desc: '일반건강검진 대상자 실시 여부 확인', perUser: true },
    { id: 'yearly_musculo', freq: 'yearly', title: '근골격계 유해요인조사', desc: '근골격계부담작업 보유 시 연 1회 조사' }
];

export const PERIOD_LABEL = { daily: '오늘', weekly: '이번 주', monthly: '이번 달', yearly: '올해' };

export const FREQ_META = {
    daily: { label: '매일', color: 'bg-blue-50 text-blue-600 border-blue-100' },
    weekly: { label: '매주', color: 'bg-purple-50 text-purple-600 border-purple-100' },
    monthly: { label: '매월', color: 'bg-amber-50 text-amber-600 border-amber-100' },
    yearly: { label: '매년', color: 'bg-rose-50 text-rose-600 border-rose-100' }
};

export const getPeriodKey = (freq, d = new Date()) => {
    if (freq === 'daily') return d.toISOString().split('T')[0];
    if (freq === 'weekly') {
        const day = (d.getDay() + 6) % 7; // 월=0 ... 일=6
        const monday = new Date(d);
        monday.setDate(d.getDate() - day);
        return monday.toISOString().split('T')[0];
    }
    if (freq === 'monthly') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return `${d.getFullYear()}`;
};

export const getDaysLeftInPeriod = (freq, d = new Date()) => {
    if (freq === 'daily') return 0;
    if (freq === 'weekly') {
        const day = (d.getDay() + 6) % 7;
        return 6 - day;
    }
    if (freq === 'monthly') {
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        return lastDay - d.getDate();
    }
    const lastDay = new Date(d.getFullYear(), 11, 31);
    return Math.round((lastDay - d) / (1000 * 60 * 60 * 24));
};

export const URGENT_THRESHOLD = { daily: 0, weekly: 1, monthly: 3, yearly: 30 };

export const getTodaysTbmTopic = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now - start) / 86400000);
    const idx = dayOfYear % RISK_ASSESSMENT_ITEMS.length;
    return RISK_ASSESSMENT_ITEMS[idx];
};

// 제출 문서 종류(formType) → 화면에 보여줄 이름
export const getTypeKorean = (type) => {
    switch(type) {
        case 'heavy_object': return '화물자동차 작업계획서';
        case 'musculo': return '근골격 체크';
        case 'musculo_checklist': return '근골격부담작업 체크리스트';
        case 'hazard_survey': return '유해요인 조사표';
        case 'emergency_plan': return '비상사태 대응 계획서';
        case 'action_history': return '안전보건 조치 이력 관리';
        case 'agreement': return '대응계획/동의';
        case 'risk_assessment': return '위험성 평가';
        case 'safety_education': return '최초교육수료';
        case 'accident_report': return '사고 보고서';
        default: return '일일 안전점검';
    }
};
