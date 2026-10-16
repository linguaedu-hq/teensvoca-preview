// 학부모 연결 · 확인 관리 — 화면이 부르는 데이터 호출을 이 파일 한 곳에 모은다.
// 함수 이름 = docs/LINKING.md 의 RPC 이름, 돌려주는 꼴도 그대로.
// 두 갈래(config.js MODE):
//   실제 — supabase-js v2(공식 CDN, 판 고정)로 Supabase RPC · Edge Function check-channel 을 부른다. publishable(anon) 키만.
//   시안 — 이 기기 localStorage 가짜 데이터(실명 · 실제 번호 없음: 학생NN · 학부모NN · 010-0000-00NN).
// 'auto' 면 카카오 로그인 세션이 있을 때만 실제. 화면은 TVApi.ready(→ "real" | "demo")를 기다린 뒤 시작한다.
// 실제 갈래의 오류는 TVApi.TVError(code · userMessage)로 던진다 — 화면은 e.userMessage 를 그대로 보여 주면 된다.
window.TVApi = (function () {
  const DB_KEY = "tv-fake-db-v1";
  const SESSION_KEY = "tv-kakao-session";
  const DAILY_LIMIT = 10;                       // 같은 사람 하루 10번 넘으면 rate_limited (LINKING.md)
  const LATENCY_MS = 380;                       // 가짜 서버 지연 — 불러오는 중 모습을 보이려고

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장이 막힌 브라우저: 이 화면 동안만 */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* 무시해도 되는 정리 */ } },
  };
  const wait = (v, ms = LATENCY_MS) => new Promise((r) => setTimeout(() => r(v), ms));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const pad2 = (n) => String(n).padStart(2, "0");

  // 맞추는 규칙(LINKING.md): 전화는 숫자만 · 이름은 공백을 모두 없앰
  const normPhone = (s) => String(s || "").replace(/\D/g, "");
  const normName = (s) => String(s || "").replace(/\s+/g, "");
  const showPhone = (s) => { const d = normPhone(s); return d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : d; };
  const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
  const uid = (p) => `${p}-${Math.random().toString(36).slice(2, 10)}`;

  // ── 가짜 명단 · 연결 · 요청 ─────────────────────────────────────────────
  const SCHOOLS = ["가나초", "다라초", "마바초"];          // 지어낸 학교 이름 · 중학생은 「사아중」
  const GRADES = ["초3", "초4", "초5", "초6", "중1"];
  const CLASSES = ["LIV1-4", "LIV2P-1", "202-11", "Apex2-12", "PYALE-1"];
  const SIBLING_OF = { 4: 3, 19: 18 };          // 학생04 = 학생03 동생, 학생19 = 학생18 동생(같은 학부모 · 같은 전화)

  function rosterRow(i) {
    const g = SIBLING_OF[i] || i;
    return {
      id: `r-${pad2(i)}`, aca_student_no: `A26${String(i).padStart(3, "0")}`, student_name: `학생${pad2(i)}`,
      school: GRADES[i % GRADES.length].startsWith("중") ? "사아중" : SCHOOLS[i % SCHOOLS.length], grade: GRADES[i % GRADES.length], class_name: CLASSES[i % CLASSES.length],
      guardian_name: `학부모${pad2(g)}`, guardian_phone: `0100000${String(g).padStart(4, "0")}`, active: true,
      updated_at: new Date(Date.now() - 3 * 864e5).toISOString(),
    };
  }
  function seed() {
    const now = Date.now(), min = 6e4;
    const roster = Array.from({ length: 24 }, (_, k) => rosterRow(k + 1));
    const guardians = {
      "g-01": { user_id: "g-01", display_name: "카카오01", kakao_id: "k-1001" },
      "g-02": { user_id: "g-02", display_name: "카카오02", kakao_id: "k-1002" },
      "g-05": { user_id: "g-05", display_name: "카카오05", kakao_id: "k-1005" },
      "g-18": { user_id: "g-18", display_name: "카카오18", kakao_id: "k-1018" },
      "g-p1": { user_id: "g-p1", display_name: "카카오07", kakao_id: "k-1107" },
      "g-p2": { user_id: "g-p2", display_name: "카카오15", kakao_id: "k-1115" },
      "g-p3": { user_id: "g-p3", display_name: "카카오09", kakao_id: "k-1209" },
      "g-p4": { user_id: "g-p4", display_name: "카카오30", kakao_id: "k-1130" },
    };
    const links = [
      { guardian_user_id: "g-01", roster_id: "r-01", linked_by: "auto", linked_at: new Date(now - 2 * 864e5).toISOString() },
      { guardian_user_id: "g-02", roster_id: "r-02", linked_by: "auto", linked_at: new Date(now - 2 * 864e5 + 40 * min).toISOString() },
      { guardian_user_id: "g-05", roster_id: "r-05", linked_by: "admin", linked_at: new Date(now - 864e5).toISOString() },
      { guardian_user_id: "g-18", roster_id: "r-18", linked_by: "auto", linked_at: new Date(now - 5 * 36e5).toISOString() },
      { guardian_user_id: "g-18", roster_id: "r-19", linked_by: "auto", linked_at: new Date(now - 5 * 36e5).toISOString() },
    ];
    // 확인 대기 네 가지 모습: 전화가 다름 · 자녀 이름 오타 · 다른 보호자(아버지 등) · 명단에 없음
    const req = (id, user, gn, ph, cn, agoMin) => ({ id, guardian_user_id: user, guardian_name: gn, phone: ph, child_name: cn,
      status: "pending", note: "", created_at: new Date(now - agoMin * min).toISOString(), decided_by: null, decided_at: null });
    const requests = [
      req("q-1041", "g-p1", "학부모07", "01000000107", "학생07", 12),
      req("q-1040", "g-p2", "학부모15", "01000000015", "학생51", 48),
      req("q-1039", "g-p3", "학부모09 아버지", "01000000209", "학생09", 135),
      req("q-1037", "g-p4", "학부모30", "01000000030", "학생30", 26 * 60),
    ];
    return { roster, guardians, links, requests, attempts: {}, lastImport: { at: new Date(now - 3 * 864e5).toISOString(), rows: 24, inserted: 24, updated: 0, deactivated: 0 } };
  }
  const db = () => store.get(DB_KEY) || (store.set(DB_KEY, seed()), store.get(DB_KEY)) || seed();
  const save = (d) => store.set(DB_KEY, d);
  const brief = (r) => ({ roster_id: r.id, student_name: r.student_name, school: r.school, grade: r.grade });

  // ── 시안: 로그인 · 채널(실제 갈래는 아래 real) ─────────────────────────
  function signInWithKakao() {
    const s = { user_id: "g-me", display_name: "카카오 보호자", kakao_id: "k-2001", channel: "NONE" };
    store.set(SESSION_KEY, s);
    return wait(s, 520);
  }
  function getSession() { return store.get(SESSION_KEY); }
  function signOut() { store.del(SESSION_KEY); return wait(true, 120); }

  // 실제판: sb.functions.invoke("check-channel") → { relation: "ADDED" | "NONE" | "BLOCKED" }
  function check_channel() {
    const s = getSession();
    return wait({ relation: s ? s.channel : "NONE" });
  }
  // 실제판: 카카오 채널 추가 창(Kakao.Channel.followChannel 또는 채널 친구 추가 주소)을 연다. 결과는 check_channel 로만 믿는다.
  function openChannelAdd() {
    const s = getSession(); if (!s) return wait(false);
    s.channel = "ADDED"; store.set(SESSION_KEY, s);
    return wait(true, 650);
  }

  // ── 학부모 RPC ───────────────────────────────────────────────────────────
  function link_by_contact(p_guardian_name, p_phone, p_child_name) {
    const d = db(), me = getSession() || { user_id: "g-me", display_name: "카카오 보호자" };
    const k = `${me.user_id}|${dayKey()}`;
    d.attempts[k] = (d.attempts[k] || 0) + 1;
    if (d.attempts[k] > DAILY_LIMIT) { save(d); return wait({ status: "rate_limited" }); }
    const gn = normName(p_guardian_name), ph = normPhone(p_phone), cn = normName(p_child_name);
    const mine = new Set(d.links.filter((l) => l.guardian_user_id === me.user_id).map((l) => l.roster_id));
    const sameGuardian = d.roster.filter((r) => r.active && normName(r.guardian_name) === gn && r.guardian_phone === ph);
    const hits = sameGuardian.filter((r) => normName(r.student_name) === cn);
    if (hits.length === 1) {
      const hit = hits[0];
      if (!mine.has(hit.id)) d.links.push({ guardian_user_id: me.user_id, roster_id: hit.id, linked_by: "auto", linked_at: new Date().toISOString() });
      d.guardians[me.user_id] = { user_id: me.user_id, display_name: me.display_name, kakao_id: me.kakao_id };
      save(d);
      const siblings = sameGuardian.filter((r) => r.id !== hit.id && !mine.has(r.id)).map(brief);
      return wait({ status: "linked", students: [brief(hit)], siblings });
    }
    const dup = d.requests.find((q) => q.status === "pending" && q.guardian_user_id === me.user_id &&
      normName(q.guardian_name) === gn && q.phone === ph && normName(q.child_name) === cn);
    if (dup) { save(d); return wait({ status: "pending", request_id: dup.id }); }
    const q = { id: uid("q"), guardian_user_id: me.user_id, guardian_name: String(p_guardian_name).trim(), phone: ph, child_name: String(p_child_name).trim(),
      status: "pending", note: "", created_at: new Date().toISOString(), decided_by: null, decided_at: null };
    d.requests.unshift(q);
    d.guardians[me.user_id] = { user_id: me.user_id, display_name: me.display_name, kakao_id: me.kakao_id };
    save(d);
    return wait({ status: "pending", request_id: q.id });
  }
  // 형제 추가 연결 — 같은 학부모 이름 + 전화로 맞는 학생만 연결된다(서버가 다시 확인). 돌려줌 = 연결된 학생 목록(my_children 과 같은 꼴)
  function link_siblings(p_roster_ids) {
    const d = db(), me = getSession() || { user_id: "g-me" };
    const anchor = d.links.find((l) => l.guardian_user_id === me.user_id);
    const a = anchor && d.roster.find((r) => r.id === anchor.roster_id);
    if (a) (p_roster_ids || []).forEach((id) => {
      const r = d.roster.find((x) => x.id === id);
      const ok = r && r.active && normName(r.guardian_name) === normName(a.guardian_name) && r.guardian_phone === a.guardian_phone;
      if (ok && !d.links.some((l) => l.guardian_user_id === me.user_id && l.roster_id === id))
        d.links.push({ guardian_user_id: me.user_id, roster_id: id, linked_by: "auto", linked_at: new Date().toISOString() });
    });
    save(d);
    return my_children();
  }
  function my_children() {
    const d = db(), me = getSession() || { user_id: "g-me" };
    const ids = d.links.filter((l) => l.guardian_user_id === me.user_id).map((l) => l.roster_id);
    return wait(d.roster.filter((r) => ids.includes(r.id)).map(brief));
  }

  // ── 관리자 RPC ───────────────────────────────────────────────────────────
  function admin_pending_requests() {
    const d = db();
    return wait(clone(d.requests.filter((q) => q.status === "pending").sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((q) => Object.assign({ guardian_display_name: (d.guardians[q.guardian_user_id] || {}).display_name || "" }, q))));
  }
  function admin_resolve_request(p_request_id, p_roster_ids, p_approve, p_note) {
    const d = db(), q = d.requests.find((x) => x.id === p_request_id);
    if (!q || q.status !== "pending") return wait({ ok: false, error: "already_decided" });
    q.status = p_approve ? "approved" : "rejected"; q.note = p_note || ""; q.decided_by = "admin-01"; q.decided_at = new Date().toISOString();
    if (p_approve) (p_roster_ids || []).forEach((rid) => {
      if (!d.links.some((l) => l.guardian_user_id === q.guardian_user_id && l.roster_id === rid))
        d.links.push({ guardian_user_id: q.guardian_user_id, roster_id: rid, linked_by: "admin", linked_at: q.decided_at });
    });
    save(d);
    return wait({ ok: true, status: q.status, linked: p_approve ? (p_roster_ids || []).length : 0 });
  }
  function admin_unlink(p_guardian_user_id, p_roster_id) {
    const d = db(), n = d.links.length;
    d.links = d.links.filter((l) => !(l.guardian_user_id === p_guardian_user_id && l.roster_id === p_roster_id));
    save(d);
    return wait({ ok: d.links.length < n });
  }
  // 학생 이름 · 학부모 이름 · 전화(숫자 일부) · 아카 번호로 찾는다. 빈 검색 = 빈 목록(전체 명단을 한꺼번에 내리지 않는다)
  function admin_search_roster(p_q) {
    const d = db(), q = normName(p_q), qd = normPhone(p_q);
    if (!q) return wait([]);
    const hit = (r) => normName(r.student_name).includes(q) || normName(r.guardian_name).includes(q) || r.aca_student_no.includes(q.toUpperCase()) || (qd.length >= 4 && r.guardian_phone.includes(qd));
    const linked_count = (r) => d.links.filter((l) => l.roster_id === r.id).length;
    return wait(clone(d.roster.filter(hit).sort((a, b) => (b.active - a.active) || a.student_name.localeCompare(b.student_name)).slice(0, 50)
      .map((r) => Object.assign({}, r, { linked_count: linked_count(r) }))), 220);
  }
  function admin_import_roster(p_rows) {
    const d = db(), seen = new Set(); let inserted = 0, updated = 0, kept = 0;
    const now = new Date().toISOString();
    (p_rows || []).forEach((row) => {
      const no = String(row.aca_student_no || "").trim(); if (!no) return;
      seen.add(no);
      if (row.keep) { kept++; return; }           // 파일에서 확인 필요인 줄: 지금 값 그대로 두고 빠짐으로도 돌리지 않음
      const next = { aca_student_no: no, student_name: String(row.student_name || "").trim(), school: row.school || "", grade: row.grade || "", class_name: row.class_name || "",
        guardian_name: String(row.guardian_name || "").trim(), guardian_phone: normPhone(row.guardian_phone), active: true };
      const cur = d.roster.find((r) => r.aca_student_no === no);
      if (!cur) { d.roster.push(Object.assign({ id: uid("r"), updated_at: now }, next)); inserted++; return; }
      const changed = Object.keys(next).some((k) => String(cur[k]) !== String(next[k]));
      if (changed) { Object.assign(cur, next, { updated_at: now }); updated++; }
    });
    let deactivated = 0;
    d.roster.forEach((r) => { if (r.active && !seen.has(r.aca_student_no)) { r.active = false; r.updated_at = now; deactivated++; } });
    d.lastImport = { at: now, rows: (p_rows || []).filter((r) => !r.keep).length, inserted, updated, deactivated };
    save(d);
    return wait({ total: (p_rows || []).length - kept, inserted, updated, deactivated, kept }, 700);
  }

  // ── 관리자 표 읽기(RPC 아님 · 관리자 RLS 로 표를 바로 읽는 자리) ────────────
  // 실제판: sb.from("guardian_links").select("guardian_user_id, roster_id, linked_by, linked_at, guardians(display_name), roster(...)")
  function admin_linked_list(p_q) {
    const d = db(), q = normName(p_q), qd = normPhone(p_q);
    const rows = d.links.map((l) => {
      const r = d.roster.find((x) => x.id === l.roster_id) || {};
      const g = d.guardians[l.guardian_user_id] || {};
      return { guardian_user_id: l.guardian_user_id, roster_id: l.roster_id, linked_by: l.linked_by, linked_at: l.linked_at,
        kakao_name: g.display_name || "", guardian_name: r.guardian_name || "", guardian_phone: r.guardian_phone || "",
        student_name: r.student_name || "", school: r.school || "", grade: r.grade || "", class_name: r.class_name || "", active: r.active !== false };
    }).filter((x) => !q || normName(x.student_name).includes(q) || normName(x.guardian_name).includes(q) || normName(x.kakao_name).includes(q) || (qd.length >= 4 && x.guardian_phone.includes(qd)));
    return wait(rows.sort((a, b) => b.linked_at.localeCompare(a.linked_at)), 220);
  }
  // 실제판: roster 의 count(active) · admin 이 남긴 마지막 올린 기록(roster_imports 표 또는 max(updated_at))
  function admin_roster_status() {
    const d = db();
    return wait({ active: d.roster.filter((r) => r.active).length, total: d.roster.length, last: clone(d.lastImport) }, 160);
  }

  // ── 시안 전용(시안 모드에서만 씀) ─────────────────────────────────────────────
  const demo = {
    reset() { store.del(DB_KEY); store.del(SESSION_KEY); },
    session(channel) { store.set(SESSION_KEY, { user_id: "g-me", display_name: "카카오 보호자", kakao_id: "k-2001", channel: channel || "NONE" }); },
    exhaust() { const d = db(); d.attempts[`g-me|${dayKey()}`] = DAILY_LIMIT; save(d); },
    // 아카 내보내기 꼴을 흉내 낸 명단(학생05 반 바뀜 · 학생08 전화 바뀜 · 학생23·24 빠짐 · 학생25·26 새로)
    sampleFile() {
      const rows = Array.from({ length: 22 }, (_, k) => rosterRow(k + 1));
      rows[4].class_name = "LIV2P-1"; rows[7].guardian_phone = "01000000108";
      rows.push(rosterRow(25), rosterRow(26));
      const head = ["원생번호", "원생명", "학교", "학년", "반", "보호자명", "보호자연락처"];
      const body = rows.map((r) => [r.aca_student_no, r.student_name, r.school, r.grade, r.class_name, r.guardian_name, showPhone(r.guardian_phone)]);
      body[12][6] = "010-0000-01";                  // 자리가 모자란 번호(확인 필요 줄 보이기)
      return [head, ...body].map((l) => l.join(",")).join("\n");
    },
  };

  // ── 실제(Supabase) ───────────────────────────────────────────────────────
  const C = window.TVConfig || {};
  const sb = (window.supabase && C.SUPABASE_URL && C.SUPABASE_PUBLISHABLE_KEY)
    ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_PUBLISHABLE_KEY, {
        auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;                                       // CDN 이 막혔거나 설정이 없으면 시안으로만 돈다

  class TVError extends Error {
    constructor(code, userMessage, cause) { super(code); this.code = code; this.userMessage = userMessage; this.cause = cause; }
  }
  const MSG = {
    auth_required: "로그인이 풀렸어요. 처음 화면에서 다시 로그인해 주세요.",
    kakao_required: "카카오로 로그인한 계정만 쓸 수 있어요.",
    kakao_not_ready: "카카오 로그인 준비 중이에요 — 시안 모드로 볼게요.",
    kakao_failed: "카카오 로그인을 마치지 못했어요. 다시 눌러 주세요.",
    forbidden: "관리자만 볼 수 있는 화면이에요.",
    mfa_required: "관리 화면은 인증 앱 확인(2단계)을 마쳐야 열려요.",
    mfa_code_wrong: "인증 코드가 맞지 않아요. 앱에 보이는 6자리를 다시 넣어 주세요.",
    mfa_failed: "인증 앱 등록을 시작하지 못했어요. 잠시 뒤 다시 해 주세요.",
    channel_unavailable: "채널 확인 준비 중이에요. 잠시 뒤 다시 확인해 주세요.",
    channel_id_missing: "채널 추가 준비 중이에요. 카카오톡에서 「링구아어학원 전국본원」 채널을 찾아 추가해 주세요.",
    invalid_input: "보낸 내용에 맞지 않는 값이 있어요. 다시 확인해 주세요.",
    network: "인터넷 연결을 확인하고 다시 해 주세요.",
    server: "잠시 문제가 생겼어요. 잠시 뒤 다시 해 주세요.",
  };
  const fail = (code, cause) => new TVError(code, MSG[code] || MSG.server, cause);

  // PostgREST · GoTrue 오류 → 화면용 코드(서버 메시지 원문은 화면에 내지 않는다)
  function fromPg(error) {
    const m = String((error && error.message) || "").toLowerCase(), c = error && error.code;
    if (m.includes("mfa required")) return fail("mfa_required", error);
    if (m.includes("kakao login required")) return fail("kakao_required", error);
    if (m === "forbidden") return fail("forbidden", error);
    if (c === "28000" || m.includes("not authenticated") || m.includes("permission denied for function") || m.includes("jwt")) return fail("auth_required", error);
    if (c === "22023" || c === "22P02") return fail("invalid_input", error);
    if (m.includes("failed to fetch") || m.includes("networkerror")) return fail("network", error);
    return fail("server", error);
  }
  async function rpc(name, args) {
    let res;
    try { res = await sb.rpc(name, args || {}); } catch (e) { throw fail("network", e); }
    if (res.error) throw fromPg(res.error);
    return res.data;
  }

  let realSession = null;                        // { user_id, display_name, access_token }
  function toSession(s) {
    if (!s || !s.user) return null;
    const md = s.user.user_metadata || {};
    return { user_id: s.user.id, display_name: md.name || md.nickname || md.full_name || md.preferred_username || "카카오 보호자", access_token: s.access_token };
  }
  const forcedDemo = (() => { try { return new URLSearchParams(location.search).has("demo"); } catch (e) { return false; } })();

  // 모드 정하기: demo | real | auto(세션이 있으면 real). 카카오에서 돌아온 ?code= 는 supabase-js 가 여기서 세션으로 바꾼다.
  const ready = (async () => {
    if (!sb || forcedDemo || C.MODE === "demo") return "demo";
    try {
      const { data } = await sb.auth.getSession();
      realSession = toSession(data && data.session);
    } catch (e) { realSession = null; }
    if (realSession) {
      sb.auth.onAuthStateChange((_ev, s) => { realSession = toSession(s); });
      return "real";
    }
    return C.MODE === "real" ? "real" : "demo";
  })();
  let MODE_NOW = "demo";
  ready.then((m) => { MODE_NOW = m; });
  const isReal = () => MODE_NOW === "real";

  // 카카오가 Supabase 에서 켜져 있는지(공개 설정 · publishable 키로 읽음). 못 읽으면 꺼진 것으로 본다.
  async function kakaoEnabled() {
    try {
      const r = await fetch(`${C.SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: C.SUPABASE_PUBLISHABLE_KEY } });
      if (!r.ok) return false;
      const j = await r.json();
      return !!(j && j.external && j.external.kakao);
    } catch (e) { return false; }
  }

  const real = {
    getSession: () => realSession,
    async signInWithKakao() {
      if (!sb || !(await kakaoEnabled())) throw fail("kakao_not_ready");
      const redirectTo = new URL("d2_login.html", location.href).href.split(/[?#]/)[0];   // 배포 = location.origin + /design/d2_login.html
      const { error } = await sb.auth.signInWithOAuth({ provider: "kakao", options: { redirectTo, scopes: "profile_nickname" } });
      if (error) throw fail(/provider is not enabled|unsupported provider/i.test(error.message) ? "kakao_not_ready" : "kakao_failed", error);
      return new Promise(() => {});              // 브라우저가 카카오로 넘어간다
    },
    async signOut() {
      try { await sb.auth.signOut(); } catch (e) { /* 이미 풀린 세션 — 이 기기 세션만 지우면 됨 */ }
      realSession = null; store.del(SESSION_KEY);
      return true;
    },
    // Edge Function check-channel(POST · 로그인 JWT). 비밀값이 아직 없거나 카카오 조회가 실패하면 channel_unavailable — 통과시키지 않는다.
    async check_channel() {
      const { data } = await sb.auth.getSession();
      const token = data && data.session && data.session.access_token;
      if (!token) throw fail("auth_required");
      let r;
      try {
        r = await fetch(`${C.SUPABASE_URL}/functions/v1/check-channel`, {
          method: "POST", headers: { Authorization: `Bearer ${token}`, apikey: C.SUPABASE_PUBLISHABLE_KEY },
        });
      } catch (e) { throw fail("channel_unavailable", e); }
      if (r.status === 401) throw fail("auth_required");
      if (r.status === 400) throw fail("kakao_required");
      if (!r.ok) throw fail("channel_unavailable");
      const j = await r.json().catch(() => null);
      if (!j || !j.relation) throw fail("channel_unavailable");
      return { relation: j.relation, checked_at: j.checked_at, cached: !!j.cached };
    },
    // 카카오 채널 친구 추가 창을 연다. 결과는 check_channel 로만 믿는다.
    async openChannelAdd() {
      const id = String(C.KAKAO_CHANNEL_PUBLIC_ID || "");
      if (!/^_[A-Za-z0-9]+$/.test(id)) throw fail("channel_id_missing");
      const w = window.open(`https://pf.kakao.com/${id}/friend`, "_blank", "noopener");
      if (!w) location.href = `https://pf.kakao.com/${id}/friend`;
      return true;
    },
    link_by_contact: (p_guardian_name, p_phone, p_child_name) => rpc("link_by_contact", { p_guardian_name, p_phone: normPhone(p_phone), p_child_name }),
    link_siblings: (p_roster_ids) => rpc("link_siblings", { p_roster_ids }),
    my_children: () => rpc("my_children"),
    admin_pending_requests: (p_limit = 100, p_offset = 0) => rpc("admin_pending_requests", { p_limit, p_offset }),
    admin_resolve_request: (p_request_id, p_roster_ids, p_approve, p_note) => rpc("admin_resolve_request", { p_request_id, p_roster_ids: p_roster_ids || [], p_approve: !!p_approve, p_note: p_note || null }),
    admin_unlink: (p_guardian_user_id, p_roster_id, p_block = false, p_reason = null) => rpc("admin_unlink", { p_guardian_user_id, p_roster_id, p_block, p_reason }),
    admin_search_roster: (p_q) => rpc("admin_search_roster", { p_q: p_q || "" }),
    admin_import_roster: (p_rows, p_dry_run = false, p_force = false) => rpc("admin_import_roster", { p_rows, p_dry_run, p_force }),
    admin_linked_list: (p_q, p_only_recheck = false) => rpc("admin_linked_list", { p_q: p_q || null, p_only_recheck }),
    admin_roster_status: () => rpc("admin_roster_status"),
  };

  // 관리자 2단계 인증(TOTP) — 관리자 RPC 는 aal2 세션만 받는다
  const mfa = {
    async level() {
      const { data, error } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) throw fromPg(error);
      const f = await sb.auth.mfa.listFactors();
      if (f.error) throw fromPg(f.error);
      const verified = (f.data.totp || []).find((x) => x.status === "verified") || null;
      return { current: data.currentLevel, next: data.nextLevel, factorId: verified ? verified.id : null };
    },
    async enroll() {
      const f = await sb.auth.mfa.listFactors();
      if (f.error) throw fail("mfa_failed", f.error);
      // 끝내지 못한(확인 안 된) 앞 등록은 치우고 새로 — 같은 이름 충돌 방지
      for (const x of (f.data.all || []).filter((x) => x.factor_type === "totp" && x.status !== "verified")) {
        await sb.auth.mfa.unenroll({ factorId: x.id });
      }
      const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "TeensVoca 확인 관리" });
      if (error || !data) throw fail("mfa_failed", error);
      return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
    },
    async verify(factorId, code) {
      const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code: String(code || "").replace(/\D/g, "") });
      if (error) throw fail("mfa_code_wrong", error);
      const { data } = await sb.auth.getSession(); realSession = toSession(data && data.session);
      return true;
    },
  };

  // ── 화면이 부르는 함수(이름 그대로) — 모드에 따라 실제 / 시안 ───────────────
  const fake = { getSession, signInWithKakao, signOut, check_channel, openChannelAdd, link_by_contact, link_siblings, my_children,
    admin_pending_requests, admin_resolve_request, admin_unlink, admin_search_roster, admin_import_roster, admin_linked_list, admin_roster_status };
  const route = (name) => async (...args) => { const m = await ready; return (m === "real" ? real : fake)[name](...args); };
  const api = {};
  Object.keys(fake).forEach((k) => { if (k !== "getSession") api[k] = route(k); });
  api.getSession = () => (isReal() ? real.getSession() : getSession());   // ready 뒤에 부른다
  // 카카오 단추: 모드와 상관없이 실제 카카오를 먼저 시도 → 준비 안 됐으면 kakao_not_ready(화면이 시안으로 넘김)
  api.signInWithKakao = () => real.signInWithKakao();
  api.signInDemo = () => signInWithKakao();
  api.signOut = async () => { await ready; if (sb) await real.signOut(); return signOut(); };

  return Object.assign(api, { normPhone, normName, showPhone, ready, isReal, mfa, TVError, demo, DAILY_LIMIT,
    phone: C.BRANCH_PHONE || "051-862-0556" });
})();
