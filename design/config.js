// 화면 설정 — 여기 있는 값은 모두 공개용(브라우저에 그대로 보임)이다.
// service_role 키 · 카카오 Admin 키 · Client Secret 은 절대 여기에 넣지 않는다(Supabase Secrets 에만).
window.TVConfig = Object.freeze({
  SUPABASE_URL: "https://nydticzchjixvfsmvvtb.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_tjtC_uj8Imw1DfT39jNXtg_3p_2kRYa",   // publishable(anon) — RLS · RPC 권한이 지킴

  // 'auto' = 카카오 로그인 세션이 있으면 실제 Supabase, 없으면 「시안 모드」(이 기기 가짜 데이터)
  // 'demo' = 늘 시안 · 'real' = 늘 실제(세션이 없으면 로그인 화면으로)
  MODE: "auto",

  // 카카오톡 채널 프로필 ID(「_」로 시작 · 공개 값). 비어 있으면 「채널 추가하기」가 준비 중 안내를 띄운다. — 대표 결정 대기
  KAKAO_CHANNEL_PUBLIC_ID: "",

  // 본원 전화 — 대표 결정 대기(지금은 자리 값)
  BRANCH_PHONE: "051-000-0000",
});
