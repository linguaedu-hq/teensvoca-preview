const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search), DEMO = q.get("demo");
// 실제 모드: 로그인 안 했으면 로그인 화면으로 · 시안: 바로 열어도 보이게
TVApi.ready.then((mode) => {
  if (mode === "real") {
    if (!TVApi.getSession()) location.replace("d2_login.html");
    document.querySelectorAll(".proto").forEach((x) => { x.style.display = "none"; });
  } else if (!TVApi.getSession()) TVApi.demo.session("ADDED");
});
// 본원 전화(config.js · 대표 결정 대기)
document.querySelectorAll('a.tel').forEach((a) => { a.href = "tel:" + TVApi.normPhone(TVApi.phone); const n = a.querySelector(".num"); if (n) n.textContent = TVApi.phone; });

// 전화번호는 치는 대로 010-0000-0000 꼴로
$("ph").addEventListener("input", (e) => {
  const d = TVApi.normPhone(e.target.value).slice(0, 11);
  e.target.value = d.length < 4 ? d : d.length < 8 ? `${d.slice(0, 3)}-${d.slice(3)}` : `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}`;
});
const RULES = {
  gn: (v) => (v.trim() ? "" : "보호자 이름을 적어 주세요."),
  ph: (v) => { const d = TVApi.normPhone(v); return !d ? "휴대전화 번호를 적어 주세요." : /^01\d{8,9}$/.test(d) ? "" : "010 으로 시작하는 휴대전화 번호 10~11자리를 적어 주세요."; },
  cn: (v) => (v.trim() ? "" : "자녀 이름을 적어 주세요."),
};
function check(k){ const m = RULES[k]($(k).value); $(k).setAttribute("aria-invalid", String(!!m)); $(k + "-m").textContent = m; return !m; }
Object.keys(RULES).forEach((k) => $(k).addEventListener("input", () => { if ($(k).getAttribute("aria-invalid") === "true") check(k); }));
$("ok").addEventListener("change", () => { if ($("ok").checked) $("ok-m").textContent = ""; });

function show(id){
  ["v-form", "v-linked", "v-pending", "v-limited"].forEach((v) => { $(v).hidden = v !== id; });
  $(id).classList.remove("enter"); void $(id).offsetWidth; $(id).classList.add("enter");
  const h = $(id).querySelector("h1"); if (h) h.focus({ preventScroll: false });
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const tagHTML = (k) => `<span class="lab" aria-hidden="true">이름</span><span><b>${esc(k.student_name)}</b><small>${esc(k.school)} · ${esc(k.grade)}</small></span>`;

function renderLinked(res){
  $("kids").innerHTML = res.students.map((k) => `<li class="tag on">${tagHTML(k)}</li>`).join("");
  const sibs = res.siblings || [];
  $("sib-box").hidden = !sibs.length; $("to-dash").hidden = !!sibs.length;
  $("sibs").innerHTML = sibs.map((k) => `<label class="tag on"><span class="lab" aria-hidden="true">이름</span><span><b>${esc(k.student_name)}</b><small>${esc(k.school)} · ${esc(k.grade)}</small></span><input type="checkbox" value="${esc(k.roster_id)}" checked aria-label="${esc(k.student_name)} 함께 연결"></label>`).join("");
  $("sibs").querySelectorAll("input").forEach((i) => i.addEventListener("change", () => {
    i.closest(".tag").classList.toggle("on", i.checked);
    const n = $("sibs").querySelectorAll("input:checked").length;
    $("sib-go").textContent = n ? `골라서 함께 연결 (${n}명)` : "고른 아이가 없어요";
    $("sib-go").disabled = !n;
  }));
  if (sibs.length) $("sib-go").textContent = `골라서 함께 연결 (${sibs.length}명)`;
  show("v-linked");
}
function renderPending(res, v){
  const d = new Date();
  $("seal-d").textContent = `${d.getMonth() + 1}.${d.getDate()}`;
  $("s-gn").textContent = v.gn.trim(); $("s-ph").textContent = TVApi.showPhone(v.ph); $("s-cn").textContent = v.cn.trim();
  $("s-id").textContent = String(res.request_id).replace(/^q-/, "").slice(0, 8).toUpperCase();   // 실제 = uuid 앞 8자리
  show("v-pending");
}

$("f").onsubmit = async (e) => {
  e.preventDefault();
  const bad = Object.keys(RULES).filter((k) => !check(k));
  if (bad.length) { $(bad[0]).focus(); return; }
  if (!$("ok").checked) { $("ok-m").textContent = "동의해 주셔야 연결할 수 있어요."; $("ok").focus(); return; }
  const b = $("go"); if (b.getAttribute("aria-busy") === "true") return;
  b.setAttribute("aria-busy", "true"); $("f-m").textContent = "";
  const v = { gn: $("gn").value, ph: $("ph").value, cn: $("cn").value };
  try {
    const res = await TVApi.link_by_contact(v.gn, v.ph, v.cn);
    if (res.status === "linked") renderLinked(res);
    else if (res.status === "pending") renderPending(res, v);
    else if (res.status === "rate_limited") show("v-limited");
    else if (res.status === "channel_required") { location.href = "d2_channel.html"; return; }   // 채널 친구 아님 · 확인이 30분보다 오래됨 → 채널 화면이 check-channel 을 다시 부름
    else if (res.status === "invalid") {          // 서버가 값 꼴을 다시 본 결과(field = guardian_name · phone · child_name)
      const k = { guardian_name: "gn", phone: "ph", child_name: "cn" }[res.field] || "gn";
      $(k).setAttribute("aria-invalid", "true"); $(k + "-m").textContent = RULES[k]($(k).value) || "다시 확인해 주세요."; $(k).focus();
    }
    else throw new Error("unknown status");
  } catch (err) {
    if (err && err.code === "auth_required") { location.href = "d2_login.html"; return; }
    $("f-m").textContent = (err && err.userMessage) || "연결하지 못했어요. 잠시 뒤 다시 눌러 주세요.";
  }
  finally { b.removeAttribute("aria-busy"); }
};
$("sib-go").onclick = async () => {
  const ids = [...$("sibs").querySelectorAll("input:checked")].map((i) => i.value);
  const b = $("sib-go"); if (!ids.length || b.getAttribute("aria-busy") === "true") return;
  b.setAttribute("aria-busy", "true"); $("sib-m").textContent = "";
  try {
    const kids = await TVApi.link_siblings(ids);
    $("kids").innerHTML = kids.map((k) => `<li class="tag on">${tagHTML(k)}</li>`).join("");
    $("sib-box").hidden = true; $("to-dash").hidden = false; $("to-dash").focus();
  } catch (err) { $("sib-m").textContent = (err && err.userMessage) || "함께 연결하지 못했어요. 다시 눌러 주세요."; }
  finally { b.removeAttribute("aria-busy"); }
};
$("sib-skip").onclick = () => { $("sib-box").hidden = true; $("to-dash").hidden = false; $("to-dash").focus(); };
$("redo").onclick = () => show("v-form");
$("p-reset").onclick = () => { TVApi.demo.reset(); location.href = "d2_link.html"; };

// 시안 그림용: ?demo=linked | pending | limited — 칸을 채워 바로 보낸다
if (DEMO) {
  document.documentElement.classList.add("is-shot");
  TVApi.demo.reset(); TVApi.demo.session("ADDED");
  const fill = { linked: ["학부모03", "010-0000-0003", "학생03"], pending: ["학부모03", "010-0000-0099", "학생03"], limited: ["학부모03", "010-0000-0003", "학생03"] }[DEMO];
  if (DEMO === "limited") TVApi.demo.exhaust();
  if (fill) { [$("gn").value, $("ph").value, $("cn").value] = fill; $("ok").checked = true; $("f").requestSubmit(); }
}
