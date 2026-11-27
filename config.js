// 지원서를 받을 주소.
// sheetEndpoint: 구글 시트 Apps Script 웹 앱 주소 (https://script.google.com/macros/s/.../exec)
//   → 제출된 지원서가 "SYAN 지원서" 시트에 한 줄씩 쌓이고, 내 메일로 알림이 옵니다.
window.SYAN_CONFIG = {
  sheetEndpoint: 'https://script.google.com/macros/s/AKfycbwyUH2C-fiqDMNOqGHSKzo0aimzC6MDIIVF8nQGVh7zLcdNESUvcL7CZkeJKdexEZ6B/exec',
  formEndpoint: '',
  fallbackEmail: 'contact@sogangsyan.team', // 위 주소가 비어 있을 때 메일 앱으로 받을 주소
};
