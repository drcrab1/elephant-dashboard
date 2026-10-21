# 코끼리물류 관리앱

React + Vite + Firebase. 배포 주소: https://elephant-logistics.web.app

## 새 컴퓨터에서 시작하기
1. **프로그램 설치**: Git, Node.js (LTS), (선택) Claude Code
2. **코드 받기**
   ```bash
   git clone https://github.com/drcrab1/elephant-dashboard.git
   cd elephant-dashboard
   npm install
   ```
   Firebase 웹 설정은 비밀이 아니라서 `.env`에 들어 있습니다(별도 설정 불필요).
3. **실행**: `npm run dev` → http://localhost:5173
4. **푸시**: GitHub 로그인이 필요합니다(`git push origin main`). 푸시하면 호스팅이 자동 배포됩니다.
5. **함수·규칙 배포가 필요할 때만**: `npx firebase login`(대표 구글 계정) 후
   ```bash
   npx firebase deploy --only functions
   npx firebase deploy --only firestore:rules
   ```
6. 작업 전에는 항상 `git pull`로 최신 코드를 받으세요.

## 두 컴퓨터를 같이 쓸 때
- 코드는 **깃으로만 동기화**합니다(작업 끝나면 커밋·푸시, 시작할 때 풀).
- 개인정보가 담긴 파일(계약서·동의서 스캔, 정산내역 등)은 **저장소에 올리지 않습니다.** 앱 안(보관함/계약관리) 또는 암호화된 업무 폴더에서만 다룹니다.
- 프로젝트 규칙과 주의사항은 `CLAUDE.md`에 있습니다(Claude가 자동으로 읽습니다).
