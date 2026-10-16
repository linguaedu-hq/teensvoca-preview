// 자동 로그인: 처음 한 번 아이디·비밀번호를 치면 다음부터 바로 들어간다.
// 비밀번호는 페이지에 저장하지 않는다. 실제판은 서버가 주는 로그인 토큰(오래 가는 쿠키)으로, 시안은 아이디만 기억한다.
// 브라우저의 「비밀번호 저장」도 쓰도록 autocomplete 를 달아 두었다.
const S = { get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }, set(k,v){ try { localStorage.setItem(k,v); } catch(e){} }, del(k){ try { localStorage.removeItem(k); } catch(e){} } };
const $ = id => document.getElementById(id);
let timer = null;
const saved = S.get("tv-auto");
if (saved) {
  $("card").classList.add("is-auto"); $("auto-id").textContent = saved;
  timer = setTimeout(() => location.replace("d2_dashboard.html"), 1100);
}
function openStudent(open){ $("f").hidden = !open; $("sid").setAttribute("aria-expanded", String(open)); }
$("other").onclick = () => { clearTimeout(timer); S.del("tv-auto"); $("card").classList.remove("is-auto"); openStudent(true); $("id").focus(); };
$("sid").onclick = () => { const open = $("f").hidden; openStudent(open); if (open) $("id").focus(); };
// 카카오 로그인 → 채널 친구가 아니면 채널 화면 → 연결된 아이가 없으면 연결 화면 → 대시보드 (docs/LINKING.md 흐름)
// 로그인 뒤: check-channel 이 오류(비밀값 없음 · 카카오 조회 실패)면 통과시키지 않고 채널 화면에서 안내한다.
async function afterKakao(){
  let relation;
  try { ({ relation } = await TVApi.check_channel()); }
  catch (e) { location.href = "d2_channel.html"; return; }
  if (relation !== "ADDED") { location.href = "d2_channel.html"; return; }
  const kids = await TVApi.my_children();
  location.href = kids.length ? "d2_dashboard.html" : "d2_link.html";
}
const NOT_READY_MS = 1400;   // 「준비 중」 안내를 읽을 시간
$("kakao").onclick = async () => {
  const b = $("kakao"), lbl = b.querySelector(".lbl");
  if (b.getAttribute("aria-busy") === "true") return;
  b.setAttribute("aria-busy", "true"); lbl.textContent = "카카오로 이동 중"; $("k-msg").textContent = "";
  try {
    await TVApi.signInWithKakao();             // 실제: 카카오로 넘어가고 돌아오면 아래 ready 갈래에서 이어 감
  } catch (e) {
    if (e && e.code === "kakao_not_ready") {
      $("k-msg").textContent = e.userMessage; lbl.textContent = "시안 모드로 여는 중";
      await new Promise((r) => setTimeout(r, NOT_READY_MS));
      try { await TVApi.signInDemo(); await afterKakao(); return; } catch (e2) { /* 아래 공통 안내 */ }
    }
    b.removeAttribute("aria-busy"); lbl.textContent = "카카오 로그인";
    $("k-msg").textContent = (e && e.code !== "kakao_not_ready" && e.userMessage) || "카카오 로그인을 마치지 못했어요. 다시 눌러 주세요.";
  }
};
// 카카오에서 돌아왔을 때(실제 세션이 생김) — 학생 자동 로그인보다 먼저 이어 간다
TVApi.ready.then((mode) => {
  if (TVApi.authError()) $("k-msg").textContent = "카카오 로그인을 마치지 못했어요. 다시 눌러 주세요.";
  if (mode !== "real" || !TVApi.getSession()) return;
  clearTimeout(timer); $("card").classList.remove("is-auto");
  const b = $("kakao"); b.setAttribute("aria-busy", "true"); b.querySelector(".lbl").textContent = "로그인 확인 중";
  afterKakao().catch((e) => {
    b.removeAttribute("aria-busy"); b.querySelector(".lbl").textContent = "카카오 로그인";
    $("k-msg").textContent = (e && e.userMessage) || "카카오 로그인을 마치지 못했어요. 다시 눌러 주세요.";
  });
});
function check(input, msgId, text){
  const bad = !input.value.trim(); input.setAttribute("aria-invalid", String(bad)); $(msgId).textContent = bad ? text : ""; return !bad;
}
$("f").onsubmit = e => {
  e.preventDefault();
  const okId = check($("id"), "id-msg", "아이디를 적어 주세요."), okPw = check($("pw"), "pw-msg", "비밀번호를 적어 주세요.");
  if (!okId) { $("id").focus(); return; } if (!okPw) { $("pw").focus(); return; }
  // 시안용 시험 계정(대표 10-14 지정): 실제판은 서버(Supabase Auth)가 확인한다
  if ($("id").value.trim() !== "0000" || $("pw").value !== "0000") {
    $("pw").setAttribute("aria-invalid", "true"); $("pw-msg").textContent = "아이디 또는 비밀번호가 맞지 않아요."; $("pw").value = ""; $("pw").focus(); return;
  }
  if ($("keep").checked) S.set("tv-auto", $("id").value.trim()); else S.del("tv-auto");
  location.href = "d2_dashboard.html";
};
["id","pw"].forEach(k => $(k).addEventListener("input", () => { if ($(k).getAttribute("aria-invalid") === "true") check($(k), k + "-msg", ""); }));

// 연필이 문구를 적고 웃는 얼굴을 그리는 장면(같은 기기에서 하루 한 번, 약 2.5초). 자동 로그인 중·동작 줄이기에서는 하지 않고 글을 바로 보인다.
// 연필은 transform·opacity 만 움직이고(회전 기준 = 연필 끝), 글은 clip-path 로 연필 끝을 따라 드러난다.
const tag = document.querySelector(".tag"), pencil = document.querySelector(".pencil");
const PEN = { delay: 120, fly: 380, pxPerMs: 0.3, lift: 110, toFace: 100, face: 260, hop: 40, dot: 40, toMouth: 50, mouth: 150, back: 360, settle: 120 };
const showTag = () => { tag.classList.remove("wpre"); tag.getAnimations({ subtree: true }).forEach(a => a.cancel()); };
const failTag = () => { showTag(); stampIn(0); };
// 도장은 문구를 다 쓴 뒤에(연출 순서: 문구 -> 도장). 지연 동안 둥근 선끝 점이 안 보이게 fill 은 forwards
function stampIn(delay){
  const path = document.querySelector(".stamp path"), span = document.querySelector(".stamp span");
  path.animate([{ opacity: 1, strokeDashoffset: 1 }, { opacity: 1, strokeDashoffset: 0 }], { delay, duration: 600, easing: "cubic-bezier(.65,0,.35,1)", fill: "forwards" });
  span.animate([{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], { delay: delay + 550, duration: 300, easing: "cubic-bezier(.23,1,.32,1)", fill: "forwards" });
}
// 하루 한 번(대표 10-14): 기기 현지 날짜를 tv-pencil-day 에 적어 두고, 같은 날 다시 열면 장면 없이 바로 보인다. 저장이 막히면 매번 보인다.
// 다시 보려면 콘솔에서: localStorage.removeItem("tv-pencil-day") 후 새로고침
const today = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`)(new Date());
const firstToday = S.get("tv-pencil-day") !== today;
if (!saved && firstToday && !matchMedia("(prefers-reduced-motion: reduce)").matches && pencil.animate) {
  S.set("tv-pencil-day", today);
  tag.classList.add("wpre"); $("card").classList.add("wait");
  Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise(r => setTimeout(r, 1500))])
    .then(() => requestAnimationFrame(() => { try { writeTag(); } catch (e) { failTag(); } }));
} else $("card").classList.add("still");
function tagLines(){
  const node = tag.querySelector(".tx").firstChild, keep = tag.style.transform;
  tag.style.transform = "none";                                   // 회전 전 좌표로 잰다
  const tb = tag.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(node);
  const lines = [];
  [...range.getClientRects()].filter(r => r.width > 1).forEach(r => {
    const l = lines.find(x => Math.abs(x.top - r.top) < 6);
    if (l) { l.left = Math.min(l.left, r.left); l.right = Math.max(l.right, r.right); l.bottom = Math.max(l.bottom, r.bottom); }
    else lines.push({ top: r.top, bottom: r.bottom, left: r.left, right: r.right });
  });
  const e = tag.querySelector(".emo svg").getBoundingClientRect();
  tag.style.transform = keep;
  const loc = (x, y) => ({ x: x - tb.left, y: y - tb.top });
  return { w: tag.offsetWidth, h: tag.offsetHeight, tb, smile: { x: e.left - tb.left, y: e.top - tb.top, s: e.width / 24 },
    lines: lines.sort((a, b) => a.top - b.top).map(l => ({ x0: l.left - tb.left, x1: l.right - tb.left, top: l.top - tb.top, bottom: l.bottom - tb.top, base: l.top - tb.top + (l.bottom - l.top) * 0.8 })) };
}
function writeTag(){
  const g = tagLines(); if (!g.lines.length) return failTag();
  const th = -2 * Math.PI / 180, cx = g.tb.left + g.w / 2, cy = g.tb.top + g.h / 2;
  const toView = (x, y) => { const dx = x - g.w / 2, dy = y - g.h / 2; return [cx + dx * Math.cos(th) - dy * Math.sin(th), cy + dx * Math.sin(th) + dy * Math.cos(th)]; };   // 글 회전(-2deg)까지 따라간다
  const tip = pencil.querySelector(".tip").getBoundingClientRect(), rest = [tip.left + tip.width / 2, tip.top + tip.height / 2];
  const card = $("card").getBoundingClientRect(), L = (parseFloat(getComputedStyle(pencil).width) || 124) * 0.97, S = 0.85;   // SVG 에는 offsetWidth 가 없다
  // 기울기는 연필 끝 위치마다: 왼쪽에서는 몸통을 오른쪽으로 눕혀 아직 안 쓴(숨은) 글 자리에 두고,
  // 오른쪽으로 갈수록 손목처럼 세워 카드 오른쪽을 넘지 않게 한다. 몸통은 늘 연필 끝의 오른쪽 -> 이미 쓴 글을 가리지 않는다.
  const angleAt = x => { const c = Math.min(0.975, Math.max(0.1, (card.right - 14 - x) / (L * S))); return Math.atan2(-Math.sqrt(1 - c * c), -c) * 180 / Math.PI; };
  const restA = -22, f = [], clip = [], pen = "cubic-bezier(.65,0,.35,1)";
  const key = (t, p, a, s, o, easing) => f.push({ t, x: p[0] - rest[0], y: p[1] - rest[1], a, s, o, easing });
  let t = 0; key(t, rest, restA, 1, 1, "linear"); t += PEN.delay; key(t, rest, restA, 1, 1, pen);
  t += PEN.fly;
  const pad = 6, poly = (r1, r2) => { const l1 = g.lines[0], l2 = g.lines[1], b1 = l2 ? (l1.bottom + l2.top) / 2 : g.h + 8;
    return `polygon(-${pad}px -8px, ${r1}px -8px, ${r1}px ${b1}px, ${r2}px ${b1}px, ${r2}px ${g.h + 8}px, -${pad}px ${g.h + 8}px)`; };
  const r = [ -pad, -pad ];
  g.lines.forEach((l, i) => {
    if (i > 0) t += PEN.lift;
    { const q = toView(l.x0, l.base); key(t, q, angleAt(q[0]), S, 1, "linear"); }
    r[i] = l.x0 - 2; clip.push({ t, p: poly(r[0], r[1]) });
    const steps = Math.max(2, Math.round((l.x1 - l.x0) / 14)), dur = (l.x1 - l.x0) / PEN.pxPerMs;
    for (let k = 1; k <= steps; k++) { const x = l.x0 + (l.x1 - l.x0) * k / steps, bob = k % 2 ? -1.6 : 0.8;
      const q = toView(x, l.base + (k === steps ? 0 : bob)); key(t + dur * k / steps, q, angleAt(q[0]), S, 1, k === steps ? pen : "linear"); }
    t += dur; r[i] = l.x1 + 4; clip.push({ t, p: poly(r[0], r[1]) });
  });
  // 웃는 얼굴: 연필 끝이 획 경로를 따라 동그라미 -> 눈 -> 눈 -> 입 순서로 그린다
  const sm = g.smile, P = (x, y) => toView(sm.x + x * sm.s, sm.y + y * sm.s), draws = [];
  const trace = (el, dur, lead) => {
    t += lead; const len = el.getTotalLength(), n = Math.max(2, Math.round(len / 3));
    for (let k = 0; k <= n; k++) { const pt = el.getPointAtLength(len * k / n), q = P(pt.x, pt.y); key(t + dur * k / n, q, angleAt(q[0]), S, 1, k === n ? pen : "linear"); }
    draws.push({ el, at: t, dur }); t += dur;
  };
  const strokes = [...tag.querySelectorAll(".emo path")];
  trace(strokes[0], PEN.face, PEN.toFace); trace(strokes[1], PEN.dot, PEN.hop); trace(strokes[2], PEN.dot, PEN.hop); trace(strokes[3], PEN.mouth, PEN.toMouth);
  t += PEN.back; key(t, [rest[0], rest[1] - 5], restA, 1, 1, "cubic-bezier(.23,1,.32,1)");
  t += PEN.settle; key(t, rest, restA, 1, 1, "linear");
  const T = t;
  stampIn(T + 60);
  pencil.animate(f.map(k => ({ transform: `translate(${k.x.toFixed(1)}px, ${k.y.toFixed(1)}px) rotate(${k.a.toFixed(1)}deg) scale(${k.s})`, opacity: k.o, offset: k.t / T, easing: k.easing })),
    { duration: T, fill: "none" });
  const full = poly(g.w + 12, g.w + 12);
  tag.animate([{ clipPath: poly(-pad, -pad), offset: 0 }, ...clip.map(k => ({ clipPath: k.p, offset: k.t / T })), { clipPath: full, offset: Math.min(1, (clip[clip.length - 1].t + 1) / T) }, { clipPath: full, offset: 1 }],
    { duration: T, fill: "forwards" });
  let last;
  draws.forEach(({ el, at, dur }) => { last = el.animate([{ opacity: 1, strokeDasharray: "1", strokeDashoffset: 1 }, { opacity: 1, strokeDasharray: "1", strokeDashoffset: 0 }],
    { delay: at, duration: dur, easing: "linear", fill: "forwards" }); });   // 지연 동안은 .wpre 로 숨김(둥근 선끝 점 방지)
  last.finished.then(showTag).catch(showTag);
}
