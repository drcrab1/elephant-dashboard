const formatPhoneNumber = (value) => {
    if (!value) return '';
    const raw = value.replace(/[^0-9]/g, '');
    if (raw.length <= 3) return raw;
    if (raw.length <= 7) return `${raw.slice(0, 3)}-${raw.slice(3)}`;
    if (raw.length <= 11) return `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7)}`;
    return `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 11)}`;
};
import React, { useState, useEffect } from 'react';
import { db, storage } from './firebase';
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';

// --- Definitions & Constants ---
const SAFETY_CHECKLIST_ITEMS = [
    '차량 타이어 마모 및 공기압 상태 점검',
    '운전석 및 조수석 안전벨트 결박 작동 상태 확인',
    '화물 적재함 고정바 결속 및 보호망 파손 여부 점검',
    '안전모, 반사조끼 등 필수 개인 보호구 착용',
    '전조등, 후미등, 비상깜빡이 점등 이상 유무'
];

const HEAVY_OBJECT_CHECKS = [
    '운반물의 중량은 장비의 정격하중 이내인가?',
    '중량물은 항상 아래쪽에 적재 하였는가?',
    '운반물 취급방법, 순서 등을 작업자가 숙지하고 있는가?',
    '작업자가 운반물을 들어 올릴 때 편하중이 생기지 않는 위치 및 줄걸이 방법을 알고 있는가?',
    '운반이 용이하도록 통로는 안전하게 확보 되었는가?',
    '작업 시작 전 장비를 점검한 결과 문제가 없는가?',
    '월1회 정기점검을 실시하고, 문제점 발견시 개선하였는가?'
];

const CARGO_WORK_PLAN_ITEMS = [
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

const MUSCULO_HAZARDS = [
    { id: 'm1', label: '단순 반복 작업', icon: '🔄', desc: '같은 동작 반복 (상차/하차/분류)' },
    { id: 'm2', label: '무리한 자세', icon: '🧍', desc: '허리 구부림/비틂, 쪼그려 앉음' },
    { id: 'm3', label: '과도한 하중', icon: '🏋️', desc: '25kg 이상 무거운 화물 취급' },
    { id: 'm4', label: '불량한 그립', icon: '🖐️', desc: '미끄럽거나 잡기 힘든 박스 취급' }
];

const RISK_ASSESSMENT_ITEMS = [
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
const SAFETY_RECURRING_TASKS = [
    { id: 'tbm', freq: 'daily', title: '작업 전 TBM(안전미팅)', desc: '배차 전 당일 위험요인 공유 및 안전수칙 재확인', perUser: true },
    { id: 'daily_vehicle_check', freq: 'daily', title: '일일 차량·장비 점검', desc: '타이어, 브레이크, 적재함 도어, 후방카메라 등 운행 전 점검', perUser: true },
    { id: 'weekly_tire', freq: 'weekly', title: '타이어·공기압 점검', desc: '차량별 타이어 마모 상태 및 공기압 확인', perUser: true },
    { id: 'monthly_edu', freq: 'monthly', title: '월간 안전교육 실시', desc: '전 직원 대상 안전수칙 및 사고사례 교육', perUser: true },
    { id: 'vehicle_inspection', freq: 'daily', title: '일일 자동차 안전점검표', desc: '번호판·등화장치·타이어·안전벨트 등 11개 항목 점검 (법정 서식)', perUser: true },
    { id: 'monthly_fire', freq: 'monthly', title: '소화기 등 소방시설 점검', desc: '소화기 압력게이지, 비상구, 유도등 등 점검' },
    { id: 'yearly_risk', freq: 'yearly', title: '위험성평가 정기평가', desc: '사업장 전체 위험성평가 연 1회 실시 (산업안전보건법)' },
    { id: 'yearly_edu', freq: 'yearly', title: '정기 안전보건교육 이수', desc: '근로자 정기교육 및 관리감독자 교육 이수' },
    { id: 'yearly_health', freq: 'yearly', title: '근로자 건강검진', desc: '일반건강검진 대상자 실시 여부 확인' },
    { id: 'yearly_musculo', freq: 'yearly', title: '근골격계 유해요인조사', desc: '근골격계부담작업 보유 시 연 1회 조사' }
];

const PERIOD_LABEL = { daily: '오늘', weekly: '이번 주', monthly: '이번 달', yearly: '올해' };

const FREQ_META = {
    daily: { label: '매일', color: 'bg-blue-50 text-blue-600 border-blue-100' },
    weekly: { label: '매주', color: 'bg-purple-50 text-purple-600 border-purple-100' },
    monthly: { label: '매월', color: 'bg-amber-50 text-amber-600 border-amber-100' },
    yearly: { label: '매년', color: 'bg-rose-50 text-rose-600 border-rose-100' }
};

const getPeriodKey = (freq, d = new Date()) => {
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

const getDaysLeftInPeriod = (freq, d = new Date()) => {
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

const URGENT_THRESHOLD = { daily: 0, weekly: 1, monthly: 3, yearly: 30 };

const getTodaysTbmTopic = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now - start) / 86400000);
    const idx = dayOfYear % RISK_ASSESSMENT_ITEMS.length;
    return RISK_ASSESSMENT_ITEMS[idx];
};

const PerUserTaskRow = ({ task, user, allLogs, onLogged }) => {
    const freq = task.freq;
    const now = new Date();
    const currentPeriod = getPeriodKey(freq, now);
    const tbmTopic = task.id === 'tbm' ? getTodaysTbmTopic() : null;
    const [note, setNote] = useState(() => tbmTopic ? `${tbmTopic.target}: ${tbmTopic.hazard.split('\n')[0]}` : '');
    const [saving, setSaving] = useState(false);

    const myLog = allLogs.find(l => l.taskId === task.id && l.periodKey === currentPeriod && l.email === user.email);
    const otherNames = allLogs.filter(l => l.taskId === task.id && l.periodKey === currentPeriod && l.email !== user.email).map(l => l.name);
    const daysLeft = getDaysLeftInPeriod(freq, now);
    const isUrgent = !myLog && daysLeft <= URGENT_THRESHOLD[freq];
    const periodLabel = PERIOD_LABEL[freq];

    const handleCheck = async () => {
        setSaving(true);
        const todayStr = new Date().toISOString().split('T')[0];
        const docId = `${currentPeriod}_${task.id}_${user.email}`;
        const entry = { taskId: task.id, freq, periodKey: currentPeriod, date: todayStr, email: user.email, name: user.name, note: note.trim(), timestamp: new Date().toISOString() };
        try {
            await db.collection('safetyChecklistLogs').doc(docId).set(entry);
            onLogged(entry);
        } catch (e) {
            console.error(e);
            alert('저장 실패: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={`rounded-xl p-3 border ${myLog ? 'bg-green-50/60 border-green-100' : isUrgent ? 'bg-red-50/70 border-red-200' : 'bg-white border-gray-100'}`}>
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <p className={`text-[13.5px] font-bold leading-tight ${myLog ? 'text-green-700' : isUrgent ? 'text-red-600' : 'text-gray-800'}`}>{task.title}</p>
                    <p className="text-[11.5px] text-gray-400 font-medium mt-1 leading-snug">{task.desc}</p>
                    {tbmTopic && (
                        <div className="mt-2 p-2 rounded-lg bg-blue-50 border border-blue-100">
                            <p className="text-[10px] font-extrabold text-blue-600">오늘의 안전 주제 · {tbmTopic.target}</p>
                            <p className="text-[11.5px] text-gray-700 font-medium mt-0.5 leading-snug whitespace-pre-line">{tbmTopic.hazard}</p>
                        </div>
                    )}
                    {myLog ? (
                        <div className="mt-1.5">
                            <p className="text-[10.5px] text-gray-500 font-bold">내가 {periodLabel} {myLog.date} {myLog.timestamp.slice(11, 16)}에 완료</p>
                            {myLog.note && <p className="text-[11px] text-gray-600 mt-1 bg-white/70 rounded px-2 py-1 border border-green-100">📝 {myLog.note}</p>}
                        </div>
                    ) : (
                        <input
                            type="text"
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder={`${periodLabel} 전달사항 (선택)`}
                            className="mt-2 w-full text-[11.5px] border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400 bg-white"
                        />
                    )}
                    {otherNames.length > 0 && (
                        <p className="text-[10px] text-gray-400 font-bold mt-1.5">{periodLabel} 완료한 다른 사람: {otherNames.join(', ')}</p>
                    )}
                </div>
                <button
                    onClick={handleCheck}
                    disabled={!!myLog || saving}
                    className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold shadow-sm transition-colors ${myLog ? 'bg-green-100 text-green-700 cursor-default' : 'bg-[#2E68ED] text-white hover:bg-blue-700'}`}
                >
                    {myLog ? '✓ 완료' : (saving ? '저장중...' : '완료 체크')}
                </button>
            </div>
        </div>
    );
};

// --- 일일 자동차 안전점검표 (법정 서식) ---
const VEHICLE_INSPECTION_ITEMS = [
    { category: '외관점검', label: '번호판, 전면유리, 후사경 등의 청결상태' },
    { category: '외관점검', label: '후미등, 차폭등 등 등화장치 작동상태' },
    { category: '외관점검', label: '창닦이기 작동상태' },
    { category: '외관점검', label: '적재함(보조지지대 포함), 측면 보호대, 후부반사판, 트레일러 연결장치의 부착상태 및 훼손 여부' },
    { category: '상태점검', label: '타이어 손상 및 마모(1.6mm 이상) 여부' },
    { category: '상태점검', label: '화물, 적재함 지지대(판스프링) 등의 고정상태' },
    { category: '상태점검', label: '바퀴 너트 등 균열 여부' },
    { category: '상태점검', label: '냉각수, 공기압, 엔진오일 등 차량 이상 여부(계기판 확인)' },
    { category: '기타', label: '좌석안전띠 상태' },
    { category: '기타', label: '소화기 비치 여부' },
    { category: '기타', label: '안전삼각대 등 비치 여부' }
];
const RESULT_OPTS = [
    { v: 'O', label: '양호', cls: 'bg-green-600 text-white border-green-600' },
    { v: 'X', label: '불량', cls: 'bg-red-600 text-white border-red-600' },
    { v: '미', label: '미운행', cls: 'bg-gray-500 text-white border-gray-500' }
];

const VehicleInspectionModal = ({ user, defaultVehicleNumber, onClose, onSubmit }) => {
    const [vehicleNumber, setVehicleNumber] = useState(defaultVehicleNumber || '');
    const [results, setResults] = useState(() => VEHICLE_INSPECTION_ITEMS.map(() => 'O'));
    const [actionNote, setActionNote] = useState('');
    const [saving, setSaving] = useState(false);

    const hasDefect = results.some(r => r === 'X');
    const okCount = results.filter(r => r === 'O').length;
    const defectCount = results.filter(r => r === 'X').length;
    const skipCount = results.filter(r => r === '미').length;

    const setResult = (idx, v) => setResults(prev => prev.map((r, i) => i === idx ? v : r));

    const handleSubmit = async () => {
        if (!vehicleNumber.trim()) return alert('차량번호를 입력해주세요.');
        if (hasDefect && !actionNote.trim()) return alert('불량 항목이 있어요. 조치 기록을 입력해주세요.');
        setSaving(true);
        try {
            await onSubmit({ vehicleNumber: vehicleNumber.trim(), results, actionNote: actionNote.trim(), okCount, defectCount, skipCount });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/50 backdrop-blur-sm flex justify-center items-center py-8 px-4">
            <div className="bg-white rounded-[24px] w-full max-w-[520px] max-h-[90vh] overflow-hidden shadow-2xl animate-fade-in flex flex-col">
                <div className="px-6 py-5 border-b border-gray-100 bg-[#f8fafc] flex justify-between items-start shrink-0">
                    <div>
                        <h3 className="text-[18px] font-extrabold text-[#0F172A]">일일 자동차 안전점검표</h3>
                        <p className="text-[12.5px] text-gray-500 font-medium mt-1">기본값은 전부 "양호"예요. 문제 있는 항목만 눌러서 바꿔주세요.</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-black font-extrabold text-2xl leading-none">&times;</button>
                </div>

                <div className="px-6 py-4 border-b border-gray-100 shrink-0">
                    <label className="text-[12.5px] font-bold text-gray-600 mb-1.5 block">차량번호</label>
                    <input type="text" value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} placeholder="예: 12가 3456" className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-[14px] font-bold outline-none focus:border-blue-500 bg-gray-50" />
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5">
                    {VEHICLE_INSPECTION_ITEMS.map((item, idx) => (
                        <div key={idx} className={`rounded-xl border p-3 ${results[idx] === 'X' ? 'bg-red-50/60 border-red-200' : 'bg-[#FAFBFC] border-gray-100'}`}>
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <span className="text-[10px] font-extrabold text-gray-400">{item.category}</span>
                                    <p className="text-[12.5px] font-bold text-gray-800 leading-snug">{item.label}</p>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                    {RESULT_OPTS.map(opt => (
                                        <button
                                            key={opt.v}
                                            onClick={() => setResult(idx, opt.v)}
                                            className={`w-11 h-8 rounded-lg text-[11px] font-extrabold border transition-colors ${results[idx] === opt.v ? opt.cls : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'}`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}

                    {hasDefect && (
                        <div className="mt-2">
                            <label className="text-[12.5px] font-bold text-red-600 mb-1.5 block">불량상태 조치 기록 <span className="text-red-500">*</span></label>
                            <textarea value={actionNote} onChange={e => setActionNote(e.target.value)} placeholder="예: 창닦이기 불량 → 9/22 교체 완료" className="w-full border border-red-200 rounded-xl px-3.5 py-2.5 text-[13px] font-medium outline-none focus:border-red-400 bg-red-50/30 min-h-[70px] resize-y" />
                        </div>
                    )}
                </div>

                <div className="p-5 border-t border-gray-100 bg-[#f8fafc] shrink-0 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl text-sm">취소</button>
                    <button onClick={handleSubmit} disabled={saving} className="flex-[2] py-3 bg-[#2E68ED] hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold rounded-xl text-sm shadow-sm transition-colors">
                        {saving ? '저장 중...' : `점검 완료 제출 (양호 ${okCount} · 불량 ${defectCount} · 미운행 ${skipCount})`}
                    </button>
                </div>
            </div>
        </div>
    );
};

const VehicleInspectionTaskRow = ({ task, user, allLogs, onLogged }) => {
    const currentPeriod = getPeriodKey('daily');
    const [showModal, setShowModal] = useState(false);
    const [showDetail, setShowDetail] = useState(false);

    const myLog = allLogs.find(l => l.taskId === task.id && l.periodKey === currentPeriod && l.email === user.email);
    const otherLogs = allLogs.filter(l => l.taskId === task.id && l.periodKey === currentPeriod && l.email !== user.email);
    const isUrgent = !myLog;

    // 마지막으로 입력했던 차량번호를 기본값으로 (편의성)
    const lastMyLog = allLogs.filter(l => l.taskId === task.id && l.email === user.email && l.vehicleNumber).sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))[0];

    const handleSubmit = async ({ vehicleNumber, results, actionNote, okCount, defectCount, skipCount }) => {
        const todayStr = new Date().toISOString().split('T')[0];
        const docId = `${currentPeriod}_${task.id}_${user.email}`;
        const note = defectCount > 0
            ? `차량 ${vehicleNumber} · 불량 ${defectCount}건: ${actionNote}`
            : `차량 ${vehicleNumber} · 전항목 양호 (${okCount}개${skipCount > 0 ? `, 미운행 ${skipCount}개` : ''})`;
        const entry = {
            taskId: task.id, freq: 'daily', periodKey: currentPeriod, date: todayStr,
            email: user.email, name: user.name, timestamp: new Date().toISOString(),
            note, vehicleNumber,
            items: VEHICLE_INSPECTION_ITEMS.map((item, idx) => ({ label: item.label, result: results[idx] })),
            actionNote, okCount, defectCount, skipCount
        };
        try {
            await db.collection('safetyChecklistLogs').doc(docId).set(entry);
            onLogged(entry);
            setShowModal(false);
        } catch (e) {
            console.error(e);
            alert('저장 실패: ' + e.message);
        }
    };

    return (
        <div className={`rounded-xl p-3 border ${myLog ? 'bg-green-50/60 border-green-100' : isUrgent ? 'bg-red-50/70 border-red-200' : 'bg-white border-gray-100'}`}>
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <p className={`text-[13.5px] font-bold leading-tight ${myLog ? 'text-green-700' : 'text-red-600'}`}>{task.title}</p>
                    <p className="text-[11.5px] text-gray-400 font-medium mt-1 leading-snug">{task.desc}</p>
                    {myLog ? (
                        <div className="mt-1.5">
                            <p className="text-[10.5px] text-gray-500 font-bold">내가 오늘 {myLog.timestamp.slice(11, 16)}에 완료</p>
                            <p className={`text-[11px] mt-1 rounded px-2 py-1 border ${myLog.defectCount > 0 ? 'bg-red-50 text-red-700 border-red-100' : 'bg-white/70 text-gray-600 border-green-100'}`}>📝 {myLog.note}</p>
                            {myLog.items && (
                                <button onClick={() => setShowDetail(v => !v)} className="text-[10.5px] text-blue-600 font-bold mt-1 hover:underline">{showDetail ? '상세 접기' : '11개 항목 상세보기'}</button>
                            )}
                            {showDetail && myLog.items && (
                                <div className="mt-1.5 bg-white rounded-lg border border-gray-100 divide-y divide-gray-50">
                                    {myLog.items.map((it, idx) => (
                                        <div key={idx} className="flex items-center justify-between gap-2 px-2 py-1.5">
                                            <span className="text-[10.5px] text-gray-600 leading-snug">{it.label}</span>
                                            <span className={`shrink-0 text-[10px] font-extrabold px-1.5 py-0.5 rounded ${it.result === 'X' ? 'bg-red-100 text-red-700' : it.result === '미' ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'}`}>{it.result === 'O' ? '양호' : it.result === 'X' ? '불량' : '미운행'}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-[11px] text-red-500 font-bold mt-1.5">오늘 아직 점검 전이에요</p>
                    )}
                    {otherLogs.length > 0 && (
                        <p className="text-[10px] text-gray-400 font-bold mt-1.5">오늘 완료한 다른 사람: {otherLogs.map(l => l.name).join(', ')}</p>
                    )}
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    disabled={!!myLog}
                    className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold shadow-sm transition-colors ${myLog ? 'bg-green-100 text-green-700 cursor-default' : 'bg-[#2E68ED] text-white hover:bg-blue-700'}`}
                >
                    {myLog ? '✓ 완료' : '점검하기'}
                </button>
            </div>
            {showModal && (
                <VehicleInspectionModal
                    user={user}
                    defaultVehicleNumber={lastMyLog?.vehicleNumber}
                    onClose={() => setShowModal(false)}
                    onSubmit={handleSubmit}
                />
            )}
        </div>
    );
};

const SafetyRecurringChecklist = ({ user }) => {
    const isAdmin = user && user.email === 's01025144826@gmail.com';
    const [lastDoneMap, setLastDoneMap] = useState({});
    const [allLogs, setAllLogs] = useState([]);
    const [historyTaskFilter, setHistoryTaskFilter] = useState('all');

    useEffect(() => {
        db.collection('settings').doc('safetyRecurringChecklist').get().then(doc => {
            if (doc.exists) setLastDoneMap(doc.data() || {});
        }).catch(() => {});

        db.collection('safetyChecklistLogs').get().then(snap => {
            setAllLogs(snap.docs.map(d => d.data()));
        }).catch(e => console.error(e));
    }, []);

    const addLog = (entry) => {
        setAllLogs(prev => [...prev.filter(l => !(l.taskId === entry.taskId && l.email === entry.email && l.periodKey === entry.periodKey)), entry]);
    };

    const markDone = async (taskId) => {
        const todayStr = new Date().toISOString().split('T')[0];
        const updated = { ...lastDoneMap, [taskId]: todayStr };
        setLastDoneMap(updated);
        try {
            await db.collection('settings').doc('safetyRecurringChecklist').set({ [taskId]: todayStr }, { merge: true });
        } catch (e) {
            console.error('체크리스트 저장 실패', e);
        }
    };

    const now = new Date();
    const freqOrder = ['daily', 'weekly', 'monthly', 'yearly'];

    return (
        <div className="mb-8 bg-white rounded-[20px] border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-6">
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h3 className="text-[18px] font-extrabold text-[#0F172A]">정기 안전보건 체크리스트</h3>
                    <p className="text-[13px] text-gray-500 font-medium mt-0.5">주기별로 반드시 해야 할 일들을 놓치지 않도록 표시해드려요.</p>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {freqOrder.map(freq => {
                    const tasks = SAFETY_RECURRING_TASKS.filter(t => t.freq === freq);
                    const meta = FREQ_META[freq];
                    return (
                        <div key={freq} className="border border-gray-100 rounded-2xl p-4 bg-[#FAFBFC]">
                            <span className={`inline-block px-2.5 py-1 rounded-lg text-[12px] font-extrabold border ${meta.color} mb-3`}>{meta.label}</span>
                            <div className="space-y-3">
                                {tasks.filter(t => t.perUser).map(task => (
                                    task.id === 'vehicle_inspection'
                                        ? <VehicleInspectionTaskRow key={task.id} task={task} user={user} allLogs={allLogs} onLogged={addLog} />
                                        : <PerUserTaskRow key={task.id} task={task} user={user} allLogs={allLogs} onLogged={addLog} />
                                ))}
                                {tasks.filter(t => !t.perUser).map(task => {
                                    const currentPeriod = getPeriodKey(freq, now);
                                    const lastDone = lastDoneMap[task.id];
                                    const lastDonePeriod = lastDone ? getPeriodKey(freq, new Date(lastDone)) : null;
                                    const isDone = lastDonePeriod === currentPeriod;
                                    const daysLeft = getDaysLeftInPeriod(freq, now);
                                    const isUrgent = !isDone && daysLeft <= URGENT_THRESHOLD[freq];
                                    return (
                                        <div key={task.id} className={`rounded-xl p-3 border ${isDone ? 'bg-green-50/60 border-green-100' : isUrgent ? 'bg-red-50/70 border-red-200' : 'bg-white border-gray-100'}`}>
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className={`text-[13.5px] font-bold leading-tight ${isDone ? 'text-green-700' : isUrgent ? 'text-red-600' : 'text-gray-800'}`}>{task.title}</p>
                                                    <p className="text-[11.5px] text-gray-400 font-medium mt-1 leading-snug">{task.desc}</p>
                                                    <p className="text-[10.5px] text-gray-400 font-bold mt-1.5">{lastDone ? `최근 완료: ${lastDone}` : '완료 기록 없음'}</p>
                                                </div>
                                                <button
                                                    onClick={() => markDone(task.id)}
                                                    disabled={isDone}
                                                    className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold shadow-sm transition-colors ${isDone ? 'bg-green-100 text-green-700 cursor-default' : 'bg-[#2E68ED] text-white hover:bg-blue-700'}`}
                                                >
                                                    {isDone ? '✓ 완료' : '완료 체크'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {isAdmin && (
                <div className="mt-6 pt-6 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <h4 className="text-[15px] font-extrabold text-[#0F172A]">지난 체크 기록 (관리자)</h4>
                        <select value={historyTaskFilter} onChange={e => setHistoryTaskFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-[12.5px] font-bold bg-gray-50 outline-none focus:border-blue-500">
                            <option value="all">전체 항목</option>
                            {SAFETY_RECURRING_TASKS.filter(t => t.perUser).map(t => (
                                <option key={t.id} value={t.id}>{t.title}</option>
                            ))}
                        </select>
                    </div>
                    <div className="border border-gray-100 rounded-2xl overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-[#f8fafc]">
                                <tr>
                                    <th className="px-4 py-2.5 text-[12px] font-bold text-gray-500">날짜/시각</th>
                                    <th className="px-4 py-2.5 text-[12px] font-bold text-gray-500">항목</th>
                                    <th className="px-4 py-2.5 text-[12px] font-bold text-gray-500">이름</th>
                                    <th className="px-4 py-2.5 text-[12px] font-bold text-gray-500">전달사항</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {allLogs.length === 0 ? (
                                    <tr><td colSpan={4} className="py-10 text-center text-gray-400 font-bold text-sm">체크 기록이 없습니다.</td></tr>
                                ) : allLogs
                                    .filter(l => historyTaskFilter === 'all' || l.taskId === historyTaskFilter)
                                    .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
                                    .slice(0, 100)
                                    .map((l, idx) => {
                                        const task = SAFETY_RECURRING_TASKS.find(t => t.id === l.taskId);
                                        return (
                                            <tr key={idx} className="hover:bg-blue-50/20">
                                                <td className="px-4 py-2.5 text-[12.5px] font-bold text-gray-700 whitespace-nowrap">{l.date} {l.timestamp ? l.timestamp.slice(11, 16) : ''}</td>
                                                <td className="px-4 py-2.5 text-[12.5px] font-bold text-gray-600">{task ? task.title : l.taskId}</td>
                                                <td className="px-4 py-2.5"><span className="bg-gray-100 px-2 py-0.5 rounded text-[12px] font-bold text-gray-700">{l.name}</span></td>
                                                <td className="px-4 py-2.5 text-[12.5px] text-gray-500">{l.note || '-'}</td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

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
        if (!finalWorker) return alert('작업자 이름을 입력(또는 선택)해주세요.');
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
        }).catch(err => alert('PDF 저장 실패: ' + err.message));
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
        }).catch(err => alert('PDF 저장 실패: ' + err.message));
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
                <button onClick={handleSubmit} className="flex-[2] py-3 rounded-xl bg-[#2E68ED] text-white font-extrabold hover:bg-blue-700 shadow-md text-xs">작업계획서 저장</button>
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
            if (!name || !age || !deptTask) return alert('필수 입력란(*표시)을 모두 기재해 주세요.');
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
                    <h3 className="text-[22px] font-extrabold text-[#0F172A]">근골격계질환 증상조사표 작성</h3>
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
                    <h4 className="font-extrabold text-[16px] text-[#1E3A8A] bg-blue-50/50 p-3.5 rounded-xl border border-blue-100">Ⅰ. 아래 사항을 직접 기입해 주시기 바랍니다.</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-bold text-[#1E3A8A]">조사/작성일자 *</label>
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
                    <h4 className="font-extrabold text-[16px] text-[#1E3A8A] bg-blue-50/50 p-3.5 rounded-xl border border-blue-100">Ⅱ. 기타 사항</h4>
                    
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
        }).catch(err => alert('PDF 저장 실패: ' + err.message));
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
                <button onClick={() => onSubmit({ formType: 'agreement', date: new Date().toISOString().split('T')[0], status: '열람 및 동의', agreed: true, vehicles, workers, protectiveGear })} className="flex-[2] py-3 rounded-xl bg-[#2E68ED] text-white font-extrabold hover:bg-blue-700 shadow-md text-xs">계획서 확인 및 서명 제출</button>
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
        }).catch(err => alert('PDF 저장 실패: ' + err.message));
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
        }).catch(err => alert('PDF 저장 실패: ' + err.message));
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
        }).catch(err => alert('PDF 저장 실패: ' + err.message));
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
            <h3 className="text-xl font-extrabold mb-4 pb-2 border-b text-[#2E68ED]">유해요인조사표(제4조 관련) 작성</h3>
            
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
                <button onClick={handleSubmit} className="flex-[2] py-3 rounded-xl bg-[#2E68ED] text-white font-extrabold hover:bg-blue-700 shadow-md text-xs">조사표 저장</button>
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
        }).catch(err => alert('PDF 저장 실패: ' + err.message));
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
                <button onClick={handleSubmit} className="flex-[2] py-3 rounded-xl bg-[#2E68ED] text-white font-extrabold hover:bg-blue-700 shadow-md text-xs">체크리스트 저장</button>
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
        if (!fileData) return alert('최초교육수료 증빙 서류(사진 또는 PDF)를 등록해 주세요.');
        setIsUploading(true);
        try {
            const recordId = `safe_${Date.now()}`;
            let finalFileUrl = '';
            
            if (fileData.startsWith('data:')) {
                const storageRef = storage.ref(`safety_education/${recordId}`);
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
            alert('파일 업로드 및 저장 실패: ' + e.message);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="bg-white rounded-3xl shadow-md border border-gray-100 p-8 max-w-xl mx-auto animate-fade-in">
            <h3 className="text-2xl font-extrabold mb-6 pb-4 border-b text-[#0F172A]">최초 교육수료 파일 업로드</h3>
            
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
        if (!location.trim()) return alert('사고 발생 장소를 입력해주세요.');
        if (!description.trim()) return alert('사고 경위를 입력해주세요.');
        setIsUploading(true);
        try {
            const recordId = `safe_${Date.now()}`;
            let finalFileUrl = '';
            if (fileData && fileData.startsWith('data:')) {
                const storageRef = storage.ref(`accident_reports/${recordId}`);
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
            alert('저장 실패: ' + e.message);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="bg-white rounded-3xl shadow-md border border-red-100 p-8 max-w-xl mx-auto animate-fade-in">
            <h3 className="text-2xl font-extrabold mb-2 text-[#0F172A]">🚨 사고 발생 보고</h3>
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


// --- Main Safety Component ---

const SafetyManagement = ({ user, records, setRecords }) => {
    const [activeTab, setActiveTab] = useState('list');
    const [writeFormPath, setWriteFormPath] = useState(null); // 'heavy', 'musculo', 'plan', 'risk'
    const [activeItem, setActiveItem] = useState(null); // Detail viewing

    const isAdmin = user && user.email === 's01025144826@gmail.com';
    const visibleRecords = isAdmin ? records : records.filter(r => r.email === user.email);

    const deleteRecord = async (id) => {
        if (!isAdmin) return;
        if (!window.confirm('정말로 이 기록을 삭제하시겠습니까?')) return;
        try {
            await db.collection('safetyRecords').doc(id).delete();
            if (setRecords) {
                setRecords(prev => prev.filter(r => r.id !== id));
            }
            setActiveItem(null);
            alert('기록이 성공적으로 삭제되었습니다.');
        } catch (e) {
            console.error(e);
            alert('삭제 실패: ' + e.message);
        }
    };

    const submitDocument = async (docData) => {
        try {
            const recordId = `safe_${Date.now()}`;
            const newRecord = {
                ...docData,
                name: user.name,
                email: user.email,
            };

            await db.collection('safetyRecords').doc(recordId).set(newRecord);
            setWriteFormPath(null);
            alert('기록이 안전하게 저장되었습니다.');
        } catch (e) {
            console.error(e);
            alert('제출 실패: ' + e.message);
        }
    };

    const getTypeKorean = (type) => {
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

    // --- RENDER DETAIL MODAL ---
    const renderDetailModal = () => {
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
                alert('PDF 생성 실패: ' + err.message);
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

    if (writeFormPath) {
        return (
            <main className="md:ml-[260px] ml-0 px-4 md:px-10 py-6 md:py-12 flex-1 relative bg-[#F4F7FB] min-h-[100vh] w-full max-w-[100vw] md:max-w-[calc(100vw-260px)] overflow-x-hidden">
                <button onClick={() => setWriteFormPath(null)} className="mb-6 text-gray-500 hover:text-black font-bold flex items-center gap-2">&larr; 목록으로 돌아가기</button>
                {writeFormPath === 'heavy' && <FormHeavyObject user={user} onSubmit={submitDocument} onCancel={() => setWriteFormPath(null)} />}
                {writeFormPath === 'cargo' && <FormCargoVehicle user={user} onSubmit={submitDocument} onCancel={() => setWriteFormPath(null)} />}
                {writeFormPath === 'musculo' && <FormMusculoskeletal user={user} onSubmit={submitDocument} onCancel={() => setWriteFormPath(null)} />}
                {writeFormPath === 'plan' && <FormSafetyPlan user={user} onSubmit={submitDocument} onCancel={() => setWriteFormPath(null)} />}
                {writeFormPath === 'risk' && <FormRiskAssessment user={user} onSubmit={submitDocument} onCancel={() => setWriteFormPath(null)} />}
                {writeFormPath === 'musculo_checklist' && <FormMusculoChecklist user={user} onSubmit={submitDocument} onCancel={() => setWriteFormPath(null)} />}
                {writeFormPath === 'edu' && <FormSafetyEducationUpload user={user} onSubmit={submitDocument} onCancel={() => setWriteFormPath(null)} />}
                {writeFormPath === 'hazard_survey' && <FormHazardSurvey user={user} onSubmit={submitDocument} onCancel={() => setWriteFormPath(null)} />}
                {writeFormPath === 'emergency_plan' && <FormEmergencyPlan user={user} onSubmit={submitDocument} onCancel={() => setWriteFormPath(null)} />}
                {writeFormPath === 'action_history' && <FormActionHistory user={user} onSubmit={submitDocument} onCancel={() => setWriteFormPath(null)} />}
                {writeFormPath === 'accident' && <FormAccidentReport user={user} onSubmit={submitDocument} onCancel={() => setWriteFormPath(null)} />}
            </main>
        );
    }

    return (
        <main className="md:ml-[260px] ml-0 px-4 md:px-10 py-6 md:py-12 flex-1 relative bg-[#F4F7FB] min-h-[100vh]">
            <header className="mb-10 w-full flex flex-col xl:flex-row justify-between xl:items-end border-b pb-6 border-gray-200 gap-6">
                <div>
                    <h2 className="text-[28px] font-extrabold mb-2 text-[#1E293B]">안전보건 및 위험관리</h2>
                    <p className="text-gray-500 text-[15px] font-medium">작업 전 스마트폰으로 빠르게 모바일 안전 점검표를 제출하십시오.</p>
                </div>
                
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => setWriteFormPath('accident')} className="bg-red-600 text-white shadow-md hover:bg-red-700 font-bold px-4 py-2 rounded-xl text-sm">🚨 사고 발생 보고</button>
                    <button onClick={() => setWriteFormPath('edu')} className="bg-[#2E68ED] text-white shadow-md hover:bg-blue-700 font-bold px-4 py-2 rounded-xl text-sm">🎓 최초교육수료 제출</button>
                    {isAdmin && <button onClick={() => setWriteFormPath('heavy')} className="bg-white border border-gray-300 shadow-sm hover:bg-gray-50 font-bold px-4 py-2 rounded-xl text-gray-700 text-sm">🚚 중량물취급 작업계획서</button>}
                    {isAdmin && <button onClick={() => setWriteFormPath('cargo')} className="bg-white border border-gray-300 shadow-sm hover:bg-gray-50 font-bold px-4 py-2 rounded-xl text-gray-700 text-sm">🚚 화물자동차 작업계획서</button>}
                    <button onClick={() => setWriteFormPath('musculo')} className="bg-white border border-gray-300 shadow-sm hover:bg-gray-50 font-bold px-4 py-2 rounded-xl text-gray-700 text-sm">🏋️ 근골격계 체크</button>
                    {isAdmin && <button onClick={() => setWriteFormPath('musculo_checklist')} className="bg-white border border-gray-300 shadow-sm hover:bg-gray-50 font-bold px-4 py-2 rounded-xl text-gray-700 text-sm">🏋️ 근골격부담작업 체크리스트</button>}
                    {isAdmin && <button onClick={() => setWriteFormPath('hazard_survey')} className="bg-white border border-gray-300 shadow-sm hover:bg-gray-50 font-bold px-4 py-2 rounded-xl text-gray-700 text-sm">📋 유해요인 조사표</button>}
                    {isAdmin && <button onClick={() => setWriteFormPath('emergency_plan')} className="bg-white border border-gray-300 shadow-sm hover:bg-gray-50 font-bold px-4 py-2 rounded-xl text-gray-700 text-sm">🚨 비상사태 대응 계획서</button>}
                    {isAdmin && <button onClick={() => setWriteFormPath('action_history')} className="bg-white border border-gray-300 shadow-sm hover:bg-gray-50 font-bold px-4 py-2 rounded-xl text-gray-700 text-sm">📋 조치 이력 관리</button>}
                    <button onClick={() => setWriteFormPath('plan')} className="bg-white border border-gray-300 shadow-sm hover:bg-gray-50 font-bold px-4 py-2 rounded-xl text-gray-700 text-sm">📖 안전보건관리계획서</button>
                    {isAdmin && <button onClick={() => setWriteFormPath('risk')} className="bg-red-100 text-red-700 border border-red-200 hover:bg-red-200 font-bold px-4 py-2 rounded-xl text-sm ml-2">⚠️ 위험성평가(관리자)</button>}
                </div>
            </header>

            <SafetyRecurringChecklist user={user} />

            <div className="scroll-container bg-white rounded-[20px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-gray-100">
                <table className="min-w-[700px] w-full divide-y divide-gray-200 text-left">
                    <thead className="bg-[#f8fafc]">
                        <tr>
                            <th className="px-6 py-4 text-[14px] font-bold text-gray-500">실시/작성일자</th>
                            <th className="px-6 py-4 text-[14px] font-bold text-gray-500">작성자</th>
                            <th className="px-6 py-4 text-[14px] font-bold text-gray-500">문서(양식) 종류</th>
                            <th className="px-6 py-4 text-[14px] font-bold text-gray-500">판정 / 상태</th>
                            <th className="px-6 py-4 text-center text-[14px] font-bold text-gray-500">결과 보기</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100/80">
                        {visibleRecords.length === 0 ? <tr><td colSpan="5" className="py-16 text-center text-gray-400 font-bold">제출된 문서가 없습니다.</td></tr> : visibleRecords.map(r => (
                            <tr key={r.id} className={`transition-colors ${r.formType === 'musculo' && (r.status||'').includes('증상있음') ? 'bg-red-50 hover:bg-red-100/80 border-l-4 border-red-500' : 'hover:bg-blue-50/20'}`}>
                                <td className="px-6 py-4 text-[15px] font-bold text-gray-900">
                                    {r.formType === 'risk_assessment' ? (r.dateRange || r.date) : 
                                     r.formType === 'musculo_checklist' ? (r.surveyDate || r.date) : 
                                     r.formType === 'hazard_survey' ? (r.surveyDate || r.date) : 
                                     r.formType === 'musculo' ? r.date :
                                     r.formType === 'emergency_plan' ? r.date : 
                                     r.formType === 'action_history' ? r.date : 
                                     r.date || '-'}
                                </td>
                                <td className="px-6 py-4"><span className="bg-gray-100 px-3 py-1 rounded-lg text-sm font-bold text-gray-700">{r.name}</span></td>
                                <td className="px-6 py-4 font-bold text-[14px] text-gray-600">{getTypeKorean(r.formType)}</td>
                                <td className="px-6 py-4"><span className={`text-[13px] font-extrabold px-3 py-1.5 rounded-md border ${(r.status||'').includes('이슈') || (r.status||'').includes('불량') || (r.status||'').includes('필요') ? 'bg-red-50 border-red-200 text-red-600' : 'bg-green-50 border-green-200 text-green-700'}`}>{r.status || '미판정'}</span></td>
                                <td className="px-6 py-4 text-center">
                                    {isAdmin ? (
                                        <div className="flex justify-center gap-1.5">
                                            <button onClick={() => setActiveItem(r)} className="bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-600 hover:border-blue-400 hover:text-blue-600 shadow-sm transition-colors">기록 확인</button>
                                            <button onClick={() => deleteRecord(r.id)} className="bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 rounded-lg px-2.5 py-1.5 text-xs font-bold shadow-sm transition-colors">🗑️ 삭제</button>
                                        </div>
                                    ) : (
                                        <span className="text-gray-400 text-xs font-bold">제출 완료</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {renderDetailModal()}
        </main>
    );
};

export {
    SAFETY_CHECKLIST_ITEMS,
    CARGO_WORK_PLAN_ITEMS,
    MUSCULO_HAZARDS,
    RISK_ASSESSMENT_ITEMS,
    FormHeavyObject,
    FormMusculoskeletal,
    FormSafetyPlan,
    FormRiskAssessment, FormCargoVehicle, FormMusculoChecklist, FormHazardSurvey, FormEmergencyPlan, FormActionHistory,
    SafetyManagement
};