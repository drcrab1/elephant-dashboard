import React, { useState, useEffect, useMemo } from 'react';
import { db, ADMIN_EMAIL } from './firebase';
import { toDate, fmtDate, exportXlsx, CHECKLISTS, dueInfo, SYSTEM_DESCRIPTION } from './privacy-shared';
import { kindOf } from './privacy-records';

const card = 'bg-white rounded-2xl border border-gray-100 shadow-sm';
const btn = 'px-3.5 py-2 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50';
const btnGhost = `${btn} bg-gray-100 text-gray-700 hover:bg-gray-200`;

const STATE = {
    ok: { label: '충족', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    warn: { label: '조치 필요', cls: 'bg-red-50 text-red-600 border-red-200' },
    manual: { label: '직접 확인', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    na: { label: '해당 없음 가능', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const within = (rec, months) => !!rec && dueInfo(rec.createdAt, months).state === 'ok';

// 조사표 문항별로 현재 앱 데이터를 보고 "지금 어떻게 답할 수 있는지"를 보여줍니다.
// 답변은 반드시 실제 사실에 맞게 선택하세요. 이 화면은 증빙(기록)이 있는지 확인해 주는 도구입니다.
export const ComplianceTab = ({ user, members, metas, checks, pledges, trainings, trainingLogs, contracts, goTo }) => {
    const [filter, setFilter] = useState('all');
    const [latestLog, setLatestLog] = useState(undefined);
    const [incidents, setIncidents] = useState([]);
    const [incEvents, setIncEvents] = useState({});
    const [destructions, setDestructions] = useState([]);
    const [copied, setCopied] = useState(false);
    const [nowMs] = useState(() => Date.now());

    useEffect(() => {
        db.collection('accessLogs').orderBy('createdAt', 'desc').limit(1).get().then((s) => setLatestLog(s.empty ? null : s.docs[0].data())).catch(() => setLatestLog(null));
        const u1 = db.collection('privacyIncidents').onSnapshot((s) => setIncidents(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
        const u2 = db.collection('destructionLogs').onSnapshot((s) => setDestructions(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
        return () => { u1(); u2(); };
    }, []);
    useEffect(() => {
        let cancelled = false;
        Promise.all(incidents.map((i) => db.collection('privacyIncidents').doc(i.id).collection('events').get().then((s) => [i.id, s.docs.map((d) => d.data())])))
            .then((pairs) => { if (!cancelled) setIncEvents(Object.fromEntries(pairs)); }).catch(() => {});
        return () => { cancelled = true; };
    }, [incidents]);

    const rows = useMemo(() => {
        const people = members.filter((m) => m.email !== ADMIN_EMAIL && m.role !== 'admin' && m.isActive !== false);
        const last = (kind) => checks.find((c) => kindOf(c) === kind);
        const planMeta = metas.internalPlan;
        const crisisMeta = metas.crisisManual;
        const officerMeta = metas.officerAppointment;
        const annual = last('annual');
        const annualOk = within(annual, 12);
        const accessReview = last('access_review');
        const logReview = last('log_review');
        const vuln = last('vuln');
        const authRec = last('auth');
        const deviceRecs = checks.filter((c) => kindOf(c) === 'device' && within(c, 12));
        const handlerCount = people.filter((m) => m.isHandler).length;
        const joinUnsigned = people.filter((m) => !m.joinPledgeSignedAt && !pledges.some((p) => p.email === m.email && p.type === 'join'));
        const activeTrainings = trainings.filter((t) => t.active);
        const cutoff = nowMs - 365 * 86400000;
        const trained = (email) => trainingLogs.some((l) => l.email === email && (toDate(l.completedAt)?.getTime() || 0) >= cutoff);
        const trainTargets = [{ email: ADMIN_EMAIL, name: user.name }, ...people];
        const untrained = trainTargets.filter((p) => !trained(p.email));
        const consentSigned = (type) => contracts.filter((c) => c.templateType === type && c.status === '서명완료');
        const collectSigned = consentSigned('consent_collect');
        const notCollect = people.filter((p) => !collectSigned.some((c) => c.targetEmail === p.email));
        const thirdSigned = consentSigned('consent_third');
        const notThird = people.filter((p) => !thirdSigned.some((c) => c.targetEmail === p.email));
        const uniqueDisagree = collectSigned.filter((c) => c.consents && c.consents.collect_unique === 'disagree').length;
        const incNoReport = incidents.filter((i) => !(incEvents[i.id] || []).some((e) => e.type === '쿠팡 보고'));
        const certs = checks.filter((c) => c.kind === 'destruction_cert');

        const deviceRow = (no, q, itemNo, naNote) => {
            const stats = deviceRecs.map((r) => (r.items.find((i) => i.no === itemNo) || {}).status);
            let state = 'warn';
            let note = '기기 점검 기록이 없습니다. [점검 기록 → 기기 점검]에서 실제 확인한 대로 기록하세요.';
            let answer = '점검 후 선택';
            if (stats.length) {
                if (stats.some((s) => s === '미이행' || s === '부분 이행')) { state = 'warn'; note = '미이행·부분 이행 항목이 있습니다. 조치 후 다시 점검하세요.'; answer = '아니요 (조치 후 네)'; }
                else if (stats.some((s) => s === '이행')) { state = 'ok'; note = '최근 1년 내 기기 점검에서 이행으로 기록됨'; answer = '네'; }
                else { state = 'na'; note = naNote; answer = '해당하지 않습니다'; }
            }
            return { no, q, state, answer, note, tab: 'checks', kind: 'device' };
        };

        const fmtLast = (rec, label, months) => (rec ? `${label}: ${fmtDate(rec.createdAt)} (${dueInfo(rec.createdAt, months).label})` : `${label}: 기록 없음`);

        return [
            { group: '관리적 보호조치' },
            { no: 3, q: '내부관리계획(16개 필수사항) 수립 + 연 1회 이상 이행실태 점검', state: planMeta && annualOk ? 'ok' : 'warn', answer: planMeta && annualOk ? '네' : '조치 후 네', note: `내부관리계획서: ${planMeta ? 'v' + planMeta.latestVersion + ' 저장됨' : '미작성'} / ${fmtLast(annual, '연간 점검', 12)}`, tab: planMeta ? 'checks' : 'docs', kind: 'annual' },
            { no: 4, q: '유출사고 대응체계 수립 + 사고 시 쿠팡 보고', state: crisisMeta && incNoReport.length === 0 ? 'ok' : 'warn', answer: crisisMeta && incNoReport.length === 0 ? '네 (최근 1년 사고가 없어도 "네")' : '조치 후 네', note: `위기대응 매뉴얼: ${crisisMeta ? 'v' + crisisMeta.latestVersion : '미작성'} / 사고 대장 ${incidents.length}건${incNoReport.length ? ` (쿠팡 보고 미기록 ${incNoReport.length}건)` : ''}`, tab: crisisMeta ? 'incidents' : 'docs' },
            { no: 5, q: '재해·재난 대비 위기대응 매뉴얼 수립 + 정기 점검', state: crisisMeta && annualOk ? 'ok' : 'warn', answer: crisisMeta && annualOk ? '네' : '조치 후 네', note: `위기대응 매뉴얼 ${crisisMeta ? '저장됨' : '미작성'} / ${fmtLast(annual, '연간 점검(14번 항목 포함)', 12)}. ※ 위탁 업무가 일 평균 2,750건(중소기업 기준) 미만이면 "해당하지 않습니다"`, tab: 'docs' },
            { no: 6, q: '자격요건을 갖춘 자를 개인정보 보호책임자로 지정', state: officerMeta ? 'ok' : 'warn', answer: officerMeta ? '네 (사업주 대표자)' : '조치 후 네', note: `보호책임자 지정서: ${officerMeta ? 'v' + officerMeta.latestVersion + ' 저장됨' : '미작성'}`, tab: 'docs' },
            { no: 8, q: '개인정보취급자 최소 지정 + 명단 최신화·관리', state: handlerCount > 0 && within(accessReview, 6) ? 'ok' : 'warn', answer: handlerCount > 0 && within(accessReview, 6) ? '네' : '조치 후 네', note: `취급자 지정 ${handlerCount}명 / ${fmtLast(accessReview, '권한 적정성 검토', 6)}`, tab: handlerCount > 0 ? 'checks' : 'handlers', kind: 'access_review' },
            { no: 9, q: '취급자 입·퇴사 시 개인정보 보호 서약서 징구', state: joinUnsigned.length === 0 && people.length > 0 ? 'ok' : 'warn', answer: joinUnsigned.length === 0 ? '네' : '서명 완료 후 네', note: `재직 기사 ${people.length}명 중 입사 서약서 미서명 ${joinUnsigned.length}명${joinUnsigned.length ? ' (' + joinUnsigned.slice(0, 5).map((m) => m.name || '이름없음').join(', ') + (joinUnsigned.length > 5 ? ' 외' : '') + ')' : ''}`, tab: 'pledge' },
            { no: 10, q: '보호책임자·취급자 대상 연 1회 이상 교육 + 참여자 목록 관리', state: activeTrainings.length + trainings.length > 0 && untrained.length === 0 ? 'ok' : 'warn', answer: untrained.length === 0 && trainings.length ? '네' : '이수 완료 후 네', note: `교육자료 ${trainings.length}건 / 최근 1년 미이수 ${untrained.length}명 (대표자 본인 포함 ${trainTargets.length}명 대상)${untrained.length ? ': ' + untrained.slice(0, 5).map((p) => p.name || '이름없음').join(', ') : ''}`, tab: 'training' },
            { no: 11, q: '보호구역 출입통제시스템 설치', state: 'manual', answer: '해당하지 않습니다 (사실일 때)', note: '위탁 업무용 물리적 보호구역(사무실·서버실)이 없고 개인 사업자가 별도 공간 없이 근무한다면 "해당하지 않습니다". 별도 업무 공간이 있으면 출입통제 여부를 사실대로 답하세요.', tab: 'checks', kind: 'annual' },
            { no: 12, q: '개인정보 서류·보조저장매체를 잠금장치 있는 장소에 보관', ...(() => { const r = deviceRow(12, '', 10, '개인정보 서류·저장매체를 위탁 업무에 사용하지 않음'); return { state: r.state === 'ok' ? 'ok' : 'manual', answer: r.answer, note: r.note.startsWith('기기 점검 기록이 없') ? '종이 계약서·서류 사본 보관 여부를 확인하세요. 기기 점검표 10번에 기록하면 이곳에 반영됩니다.' : r.note, tab: 'checks', kind: 'device' }; })() },
            { no: 13, q: '출력·복사물 보호조치', ...(() => { const r = deviceRow(13, '', 11, '출력·복사물을 이용한 위탁 업무 없음'); return { state: r.state === 'ok' ? 'ok' : 'manual', answer: r.answer, note: r.note.startsWith('기기 점검 기록이 없') ? '출력물을 최소화하고 파쇄하는지 확인하세요. 기기 점검표 11번에 기록하면 반영됩니다.' : r.note, tab: 'checks', kind: 'device' }; })() },
            { group: '개인정보 생명주기' },
            { no: 14, q: '적법한 근거로 수집하고 필수항목 고지', state: collectSigned.length > 0 && notCollect.length === 0 ? 'ok' : 'warn', answer: notCollect.length === 0 && people.length ? '네' : '동의서 수령 후 네', note: `개인정보 수집·이용 동의서 서명 ${collectSigned.length}명 / 미서명 ${notCollect.length}명 · 제3자 제공 동의서 서명 ${thirdSigned.length}명 / 미서명 ${notThird.length}명 · 개인정보 처리방침 게시됨(/?menu=policy)`, tab: null, link: '계약관리 → 개인정보 동의서 발송' },
            { no: 15, q: '민감·고유식별정보 수집 시 별도 동의 또는 법적 근거', state: collectSigned.length > 0 && notCollect.length === 0 && uniqueDisagree === 0 ? 'ok' : 'warn', answer: '네 (주민번호 등 수집 시) / 수집하지 않으면 "해당하지 않습니다"', note: `수집·이용 동의서에 고유식별정보(주민번호) 동의 항목이 별도 분리되어 있음 · 동의 거부 ${uniqueDisagree}건 · 서류 사진의 주민번호는 가려서 받도록 안내 중`, tab: null, link: '서류관리 → 주민번호 노출 확인' },
            { no: 16, q: '위탁받은 업무 목적으로만 개인정보 이용', state: 'manual', answer: '네', note: '서약서(목적 외 이용 금지)·처리방침·교육으로 관리. 실제로 목적 외 이용이 없는지 대표자가 확인하세요.', tab: 'pledge' },
            { no: 17, q: '재위탁 시 원 위탁사 승인', state: 'manual', answer: '해당하지 않습니다 (재위탁이 없을 때)', note: '위탁 업무를 다른 업체에 다시 맡기지 않았다면 "해당하지 않습니다". ※ 쿠팡 고객(수령인) 정보를 이 앱 등에 입력·저장하지 않는지 확인하세요.', tab: null },
            { no: 18, q: '파기 사유 발생 시 복구 불가능한 방법으로 즉시 파기', state: destructions.length > 0 ? 'ok' : 'manual', answer: destructions.length > 0 ? '네' : '해당하지 않습니다 (파기 사유가 없었을 때)', note: `파기 대장 ${destructions.length}건. 퇴사자 정보 등 파기 사유가 생겼는데 아직 파기하지 않았다면 먼저 파기하고 기록하세요.`, tab: 'incidents' },
            { no: 19, q: '파기확약서 작성·위탁사 전달', state: certs.length > 0 || destructions.length === 0 ? (certs.length > 0 ? 'ok' : 'manual') : 'warn', answer: certs.length > 0 ? '네' : (destructions.length === 0 ? '해당하지 않습니다 (협의된 파기확약 사유가 없을 때)' : '확약서 발행·전달 후 네'), note: `발행한 파기확약서 ${certs.length}건. 쿠팡과 협의한 제출 주기가 있는지 확인하세요.`, tab: 'incidents' },
            { no: 20, q: '법령상 보존 개인정보를 다른 정보와 분리 보관', state: 'manual', answer: '해당하지 않습니다 (분리 보관이 필요한 정보가 없을 때)', note: '법령에 따라 보존해야 하는 정보(예: 계약 종료 후 보존 의무가 있는 서류)가 있다면 분리 보관 방법을 정하세요.', tab: null },
            { group: '업무용 PC (대표자 PC 포함)' },
            { no: 21, q: '쿠팡이 제공한 업무용 PC', state: 'manual', answer: '아니요 (쿠팡 제공 PC가 없다면)', note: '쿠팡에서 받은 PC가 없으면 "아니요". 22~30번은 "개인정보취급자의 업무용 PC"로, 대표자 본인 PC도 개인정보(계약서 등)를 다룬다면 해당됩니다.', tab: null },
            deviceRow(22, '업무용 PC 인증수단(비밀번호 등) 적용', 1, '업무용 PC를 사용하지 않음(모바일기기만 사용)'),
            deviceRow(23, '업무용 PC 화면보호기 설정', 2, '업무용 PC를 사용하지 않음'),
            deviceRow(24, '공유폴더 사용 금지(또는 보호조치)', 3, '업무용 PC를 사용하지 않음 / 공유폴더를 사용하지 않음'),
            deviceRow(25, '백신 최신·실시간 검사', 4, '업무용 PC를 사용하지 않음'),
            deviceRow(26, 'OS 보안패치 자동 업데이트', 5, '업무용 PC를 사용하지 않음'),
            deviceRow(27, '비인가 프로그램·사이트 접속 통제', 6, '업무용 PC를 사용하지 않음'),
            deviceRow(28, '보조저장매체 보안 절차', 7, '업무용 PC를 사용하지 않음'),
            deviceRow(29, '개인정보 파일 암호화 보관', 8, '개인정보 파일을 PC·저장매체에 보관하지 않음'),
            deviceRow(30, '전송 시 암호화', 9, '업무용 PC·모바일로 개인정보 파일을 송수신하지 않음'),
            { group: '개인정보처리시스템 (우리 관리 앱)' },
            { no: 31, q: '쿠팡 제공 시스템 외 자체 시스템 사용', state: 'manual', answer: '네 (관리 앱을 자체 운영)', note: '자체 시스템을 쓰면 아래 32번 설명을 입력하고 33~51번에 답해야 합니다.', tab: null },
            { no: 32, q: '해당 시스템 설명', state: 'manual', answer: '아래 설명문 사용', note: '설명문 초안을 복사해 사실과 맞는지 확인한 뒤 붙여 넣으세요.', tab: null, copy: true },
            { no: 33, q: '접근권한(관리자·일반사용자)을 최소 범위로 차등 부여', state: 'ok', answer: '네', note: '관리자(대표자 1인)/기사 2단계 구분 + 데이터 접근 규칙으로 기사는 본인 계약서·서류·업무내역·안전보건 기록·회원정보만 열람 가능 (비상연락망은 비상연락 목적상 이름·연락처 공유)', tab: null },
            { no: 34, q: '1인 1계정 발급', state: 'ok', answer: '네', note: '구글 계정 인증(사람마다 본인 계정). 공용 계정 없음', tab: null },
            { no: 35, q: '업무 변경 시 지체 없이 접근권한 변경·말소', state: 'ok', answer: '네', note: '퇴사 처리 즉시 계정 비활성화(앱 차단 + 구글 계정 차단), 취급자 지정 해제일 자동 기록', tab: 'handlers' },
            { no: 36, q: '권한 부여·변경·말소 내역 기록, 3년 이상 보관', state: 'ok', answer: '네', note: '권한 변경 시 서버가 접속기록에 자동 기록하며 3년 이상 보관(자동 삭제 없음). 접속기록 탭에서 "권한 변경"으로 조회', tab: 'accesslog' },
            { no: 37, q: '접근권한 적정성 검토를 주기적으로 수행', state: within(accessReview, 6) ? 'ok' : 'warn', answer: within(accessReview, 6) ? '네' : '검토 기록 후 네', note: fmtLast(accessReview, '권한 적정성 검토', 6), tab: 'checks', kind: 'access_review' },
            { no: 38, q: '접속기록 1년(또는 2년) 이상 보관', state: latestLog ? 'ok' : (latestLog === undefined ? 'manual' : 'warn'), answer: latestLog ? '네' : '기록 확인 후 네', note: latestLog ? `접속기록 수집 중 (최근 기록 ${fmtDate(latestLog.createdAt)}). 3년 이상 보관, 자동 삭제 없음. ※ 수집을 시작한 날 이후 기록만 존재하므로 "1년 이상 보관" 요건은 시작일부터 충족해 가는 구조입니다.` : '아직 접속기록이 없습니다. 앱에 접속하면 기록이 시작됩니다.', tab: 'accesslog' },
            { no: 39, q: '접속기록·다운로드 현황을 내부관리계획 기준으로 점검', state: within(logReview, 1) ? 'ok' : 'warn', answer: within(logReview, 1) ? '네' : '점검 기록 후 네', note: fmtLast(logReview, '접속기록 월간 점검', 1), tab: 'checks', kind: 'log_review' },
            { no: 40, q: '접속기록을 위·변조·도난·분실되지 않도록 안전 보관', state: 'ok', answer: '네', note: '서버가 기록하고 클라이언트의 수정·삭제를 규칙으로 차단, 대표자만 조회', tab: 'accesslog' },
            { no: 41, q: '접속 시 안전한 인증수단 적용', state: authRec && within(authRec, 12) && (authRec.items.find((i) => i.no === 1) || {}).status === '이행' ? 'ok' : 'warn', answer: '네 (관리자 2단계 인증 확인 후)', note: `구글 계정 인증 + 관리자 2단계 인증. ${fmtLast(authRec, '계정 보안 점검', 12)}`, tab: 'checks', kind: 'auth' },
            { no: 42, q: '일정 횟수 이상 인증 실패 시 접근 제한(계정 잠금)', state: 'manual', answer: '구글 인증 정책에 의존 — 사실대로 선택', note: '로그인(인증)은 구글이 처리하며 반복 실패 시 구글이 제한합니다. 앱이 자체 구현한 기능은 아닙니다. 심사 기준이 "자체 적용"을 요구하면 "아니요"가 사실입니다.', tab: null },
            { no: 43, q: '일정 시간 미사용 시 자동 접속 차단', state: 'ok', answer: '네', note: '관리자 20분·기사 30분 미사용 시 자동 로그아웃', tab: null },
            { no: 44, q: 'IP·Port·MAC 등으로 비인가 접근 제한', state: 'warn', answer: '아니요 (사실)', note: '현재 IP 대역·MAC 제한은 적용하지 않습니다(기사가 이동통신망으로 접속). 대체 조치: 계정 인증·접근 규칙·접속기록(IP 포함) 점검. 사실대로 "아니요"로 답하고 대체 조치를 설명하세요.', tab: 'accesslog' },
            { no: 45, q: '외부 접속 시 안전한 접근통제(VPN·인증서·OTP 등)', state: authRec && within(authRec, 12) && (authRec.items.find((i) => i.no === 1) || {}).status === '이행' ? 'ok' : 'warn', answer: '네 (관리자 2단계 인증 확인 후)', note: '구글 계정 2단계 인증(OTP/기기 알림)으로 외부 접속을 통제합니다. 계정 보안 점검 기록 필요', tab: 'checks', kind: 'auth' },
            { no: 46, q: '다운로드·파기·권한설정 취급자 PC의 외부 인터넷망 차단(망분리)', state: 'na', answer: '해당하지 않습니다', note: '망분리 대상이 아닌 경우(보통 일정 규모 이상 사업자만 의무). 쿠팡 질문의 "해당하지 않습니다" 설명(망분리 외 대상)을 확인하세요.', tab: null },
            { no: 47, q: '인증정보(비밀번호·생체정보) 저장·송수신 시 암호화', state: 'na', answer: '해당하지 않습니다', note: '앱이 비밀번호·생체정보를 저장하지 않고 구글 인증을 이용합니다(암호화 대상 인증정보를 처리하지 않음).', tab: null },
            { no: 48, q: '중요 개인정보 저장 시 암호화', state: 'ok', answer: '네 또는 해당하지 않습니다 (사실에 맞게)', note: '주민번호·계좌번호·운전면허번호는 앱에 저장하지 않으므로 "해당하지 않습니다"가 가능합니다. 저장 데이터는 Google Cloud 기본 암호화(AES-256)가 적용됩니다. 서류 사진에 주민번호가 있으면 안 되므로 [서류관리 → 주민번호 노출 확인]을 완료하세요.', tab: null, link: '서류관리 → 주민번호 노출 확인' },
            { no: 49, q: '인터넷 구간 송·수신 시 암호화', state: 'ok', answer: '네', note: '모든 통신이 HTTPS(TLS)로 암호화됩니다.', tab: null },
            { no: 50, q: '출력 시(인쇄·화면표시·파일생성) 표시 항목 최소화', state: 'ok', answer: '네', note: '엑셀 내보내기는 연락처·이메일을 가려서 내보내는 것이 기본이며(원본 내보내기는 확인 절차와 접속기록 남김), 접속기록 화면의 계정도 가려서 표시합니다.', tab: null },
            { no: 51, q: '취약점 점검을 주기적으로 수행하고 개선조치 이행', state: within(vuln, 12) ? 'ok' : 'warn', answer: within(vuln, 12) ? '네' : '점검·조치 기록 후 네', note: fmtLast(vuln, '취약점 점검', 12), tab: 'checks', kind: 'vuln' },
        ];
    }, [members, metas, checks, pledges, trainings, trainingLogs, contracts, incidents, incEvents, destructions, latestLog, user.name, nowMs]);

    const items = rows.filter((r) => r.no);
    const counts = items.reduce((a, r) => { a[r.state] = (a[r.state] || 0) + 1; return a; }, {});
    const shown = rows.filter((r) => r.group || filter === 'all' || r.state === filter);

    const exportAll = () => exportXlsx(items.map((r) => ({ 문항: r.no, 내용: r.q, 현재상태: STATE[r.state].label, 권장답변: r.answer, 근거현황: r.note })), '실태점검대응', `수탁사실태점검_대응현황_${fmtDate(new Date()).replace(/\./g, '')}.xlsx`);
    const copy = async () => { try { await navigator.clipboard.writeText(SYSTEM_DESCRIPTION); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { window.prompt('복사해서 사용하세요', SYSTEM_DESCRIPTION); } };

    return (
        <div className="space-y-4">
            <div className={`${card} p-4 bg-amber-50/50 border-amber-200 text-[13px] text-amber-900 font-medium leading-relaxed`}>
                이 화면은 <b>2026 수탁사 개인정보 처리 실태 점검</b> 설문 문항별로, 앱에 남아 있는 기록을 근거로 <b>지금 어떻게 답할 수 있는지</b> 보여줍니다. 답변은 반드시 <b>실제 사실</b>에 맞게 선택하세요. "조치 필요"는 기록·조치를 먼저 한 뒤 답해야 한다는 뜻이고, "직접 확인"은 앱 밖(서류 보관, PC 설정 등) 사실을 대표자가 확인해야 하는 문항입니다.
                <div className="mt-1 text-[12px]">※ 화면에 보내주신 문항은 3~6, 8~51번입니다. 1·2·7번은 확인하지 못해 이 목록에 없습니다.</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {[['all', `전체 ${items.length}`], ['ok', `충족 ${counts.ok || 0}`], ['warn', `조치 필요 ${counts.warn || 0}`], ['manual', `직접 확인 ${counts.manual || 0}`], ['na', `해당 없음 가능 ${counts.na || 0}`]].map(([k, l]) => (
                    <button key={k} onClick={() => setFilter(k)} className={`px-3.5 py-1.5 rounded-full border text-[13px] font-bold ${filter === k ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-white text-gray-600 border-gray-200'}`}>{l}</button>
                ))}
                <button className={`${btnGhost} ml-auto`} onClick={exportAll}>📥 현황 엑셀</button>
            </div>
            <div className="space-y-2">
                {shown.map((r, idx) => r.group ? (
                    <h4 key={'g' + idx} className="pt-3 font-extrabold text-[15px] text-gray-800">{r.group}</h4>
                ) : (
                    <div key={r.no} className={`${card} p-4`}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                                <p className="font-extrabold text-[14.5px]">{r.no}. {r.q}</p>
                                <p className="text-[12.5px] text-gray-500 font-medium mt-1 leading-relaxed">{r.note}</p>
                                <p className="text-[12.5px] mt-1.5"><span className="font-extrabold text-gray-700">권장 답변:</span> <span className="font-bold text-blue-700">{r.answer}</span></p>
                                {r.copy && (
                                    <div className="mt-2">
                                        <textarea readOnly value={SYSTEM_DESCRIPTION} rows={8} className="w-full border border-gray-200 rounded-xl p-3 text-[12.5px] bg-gray-50" />
                                        <button className={`${btnGhost} mt-1.5`} onClick={copy}>{copied ? '복사됨 ✓' : '설명문 복사'}</button>
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                                <span className={`px-2.5 py-1 rounded-lg border text-[12px] font-extrabold ${STATE[r.state].cls}`}>{STATE[r.state].label}</span>
                                {r.tab && <button className="text-[12.5px] font-bold text-blue-600" onClick={() => goTo(r.tab, r.kind)}>바로가기 →</button>}
                                {!r.tab && r.link && <span className="text-[11.5px] font-bold text-gray-400">{r.link}</span>}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <p className="text-[12px] text-gray-400 font-medium">
                {CHECKLISTS.annual.label} 외 기기·계정·취약점 점검 등은 [점검 기록] 탭에서 실제 확인한 내용으로 기록하세요. 기록이 없으면 앱은 "충족"으로 표시하지 않습니다.
            </p>
        </div>
    );
};
