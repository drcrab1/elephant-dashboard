# 코끼리물류 관리앱 — 작업 안내 (Claude용)

React 19 + Vite + Tailwind, Firebase(Auth/Firestore/Storage/Functions/FCM). 사이트: https://elephant-logistics.web.app
사용자(대표)는 한국어로 소통합니다. 답변은 한국어, 쉬운 말로, 결과·위험·남은 일을 정직하게 알려주세요.

## 작업 방식 (대표 허용 사항)
- `git commit`과 `git push origin main`은 묻지 않고 진행해도 됩니다. 푸시하면 GitHub Actions가 호스팅을 자동 배포합니다.
- 보안 설정 변경(윈도우 계정·BitLocker·방화벽 등)은 하지 않습니다. 읽기 전용 점검과 안내만 합니다.
- 업무용 개인정보 폴더(업무 계정의 문서 폴더 등)는 **열거나 읽지 않습니다.** 파일 내용이 외부로 전송되므로, 파일명도 꼭 필요할 때만 봅니다.
- 구글 로그인은 대신할 수 없습니다. 로그인이 필요한 화면은 임시 harness(가짜 Firestore)로 검증하고, harness 파일(`harness.html`, `src/harness.jsx`)은 **커밋하지 말고 반드시 삭제**합니다.

## 배포 순서
1. `npm run build` 성공 확인 → 커밋 → `git push origin main` (호스팅 자동 배포)
2. 서버 함수: `npx firebase deploy --only functions:이름` (Node 22, firebase-functions 7, firebase-admin 13 — admin 14는 이 코드와 안 맞음)
3. 규칙: `npx firebase deploy --only firestore:rules`
4. 화면(쿼리) 변경이 필요한 규칙 변경은 **호스팅을 먼저, 규칙은 나중에** 배포합니다.

## 구조 (src/)
- `App.jsx` 라우팅·로그인 게이트(퇴사/서약서 서명 전 차단)·접속기록·자동 로그아웃
- `contracts.jsx` 계약관리(전자서명·동의서 별지 발송), `ui-components.jsx` 계약서 문구/PDF(`CONTRACT_ARTICLES` v1, `CONTRACT_ARTICLES_V2`)
- `consent-forms.js` 개인정보 동의서 3종, `privacy-*.jsx` 개인정보 관리(점검·서약·교육·접속기록·사고·파기·실태점검 대응)
- `vehicles.jsx` 서류/차량관리, `safety.jsx` 안전보건, `members.jsx` 회원관리, `notifications.jsx` 알림/공지
- `functions/index.js` 알림 함수, `setAccountDisabled`(퇴사 계정 차단), `logAccess`(접속기록 서버 기록)
- `firestore.rules` 보안 규칙

## tools/ (앱과 별개인 단독 HTML 도구)
- `tools/코끼리물류_정산서변환기_v7.html`: 쿠팡 정산서 → 기사별 개인 정산시트 변환기(빌드 없이 브라우저에서 실행, 개인정보는 저장하지 않음). 단가 변경(전체/기사별 날짜 분리), 보험료 매칭, 설정 JSON 내보내기·불러오기 포함. 2026-10 대화 기록에서 복구해 일부(보험료 탭 화면, 탭 바, 설정 내보내기/불러오기)는 다시 작성했습니다.
- 배차 변환기는 앱 안(`src/dispatch-converter.jsx`)에 통합되어 있습니다.

## 꼭 지킬 규칙
- **Firestore 규칙**: 한 문서에 match가 여러 개 겹치면 하나라도 허용하면 허용(OR)입니다. 포괄 규칙(`match /{collection}/{docId}`)을 다시 만들지 마세요. 새 컬렉션은 반드시 명시 규칙을 추가하고, 규칙에 없으면 거부됩니다.
- 기사(일반 사용자) 쿼리는 규칙과 같은 조건(`where('email','==',user.email)` 등)으로 해야 읽기가 허용됩니다.
- **날짜 소급 금지**: 개인정보 관련 기록의 날짜는 서버 시각(`serverTimestamp`)만 사용하고 날짜 입력칸을 만들지 않습니다. 기록은 규칙으로 수정·삭제 불가입니다.
- **계약서 문구는 버전 관리**: 서명 완료된 기존 계약서는 `templateVersion` 없음 → v1 문구 유지. 새 문구는 v2에만 적용합니다.
- 주민등록번호는 앱에서 수집·저장하지 않습니다(동의서는 동의만 받음). 서류 사진 업로드 시 가림 확인을 받습니다.
- 접속기록(`accessLogs`)은 서버 함수만 쓰고 3년 이상 보관, 자동 삭제하지 않습니다.
- 개인정보 처리방침·동의서 문구는 법률 자문이 아닌 초안입니다. 사실이 아닌 내용을 쓰지 않습니다.

## 알려진 미해결/주의
- `xlsx`(SheetJS) 취약점은 npm에 수정판이 없습니다(공식 사이트판 교체는 대표 결정 필요).
- Cloud Storage 규칙은 이 저장소에 없고 콘솔에서 관리됩니다(미점검).
- 개인정보 관리 문서의 `[확인 필요]` 항목은 대표가 채워야 합니다.
