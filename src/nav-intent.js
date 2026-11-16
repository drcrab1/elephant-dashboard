// 다른 화면에서 "저 화면의 이 기능으로 바로 가기"를 부탁할 때 남기는 1회용 쪽지입니다.
// 예: 홈의 "사고 발생 보고" 버튼 → 안전보건 화면이 열리면서 사고 보고 양식을 바로 띄움
let intent = null;

export const setNavIntent = (page, data) => { intent = { page, data }; };
export const peekNavIntent = (page) => (intent && intent.page === page ? intent.data : null);
export const clearNavIntent = (page) => { if (intent && intent.page === page) intent = null; };
