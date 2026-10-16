const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);

const CHECK = '<svg class="ink" viewBox="0 0 18 16" aria-hidden="true"><path pathLength="1" d="M2 8.5 L6.6 13 L16 2.5"/></svg>';
function showAdded(){
  $("ch").classList.add("added"); $("st").innerHTML = CHECK + "추가함";
  $("add").hidden = true; $("again").hidden = false;
}
function say(text, bad){ $("state").textContent = text; $("state").classList.toggle("bad", !!bad); }

async function goNext(){
  const kids = await TVApi.my_children();
  location.href = kids.length ? "d2_dashboard.html" : "d2_link.html";
}
$("add").onclick = async () => {
  const b = $("add"); if (b.getAttribute("aria-busy") === "true") return;
  b.setAttribute("aria-busy", "true"); say("");
  try { await TVApi.openChannelAdd(); showAdded(); say("채널을 추가했어요. 다시 확인을 눌러 주세요."); $("again").focus(); }
  catch (e) { say((e && e.userMessage) || "채널 추가 창을 열지 못했어요. 다시 눌러 주세요.", true); }
  finally { b.removeAttribute("aria-busy"); }
};
$("again").onclick = async () => {
  const b = $("again"); if (b.getAttribute("aria-busy") === "true") return;
  b.setAttribute("aria-busy", "true"); say("확인하는 중이에요.");
  try {
    const { relation } = await TVApi.check_channel();
    if (relation === "ADDED") { say("확인됐어요."); await goNext(); return; }
    if (relation === "BLOCKED") say("채널을 차단해 두셨어요. 카카오톡 → 채널 → 링구아어학원 전국본원에서 차단을 풀고 다시 확인해 주세요.", true);
    else say("아직 추가가 확인되지 않았어요. 카카오톡에서 추가를 마친 뒤 다시 확인을 눌러 주세요.", true);
    $("ch").classList.remove("added"); $("st").textContent = "아직 안 함"; $("add").hidden = false; $("again").hidden = true;
  } catch (e) { if (e && e.code === "auth_required") { location.href = "d2_login.html"; return; } say((e && e.userMessage) || "확인하지 못했어요. 잠시 뒤 다시 눌러 주세요.", true); }
  finally { b.removeAttribute("aria-busy"); }
};
$("other").onclick = async () => { await TVApi.signOut(); location.href = "d2_login.html"; };
document.querySelectorAll("[data-ch]").forEach((b) => b.onclick = () => { TVApi.demo.session(b.dataset.ch); location.reload(); });

// 들어올 때 한 번 확인: 이미 친구면 바로 다음으로, 차단이면 안내부터
// 실제 모드: 로그인 안 했으면 로그인 화면으로 · check-channel 이 아직 준비 안 됐으면(비밀값 없음 등) 안내만 하고 통과시키지 않는다
TVApi.ready.then((mode) => {
  if (mode === "real") {
    if (!TVApi.getSession()) { location.replace("d2_login.html"); return; }
    document.querySelectorAll(".proto").forEach((x) => { x.style.display = "none"; });
  } else {
    if (q.has("demo")) { document.documentElement.classList.add("is-shot"); TVApi.demo.session(q.get("demo") === "blocked" ? "BLOCKED" : "NONE"); }
    if (!TVApi.getSession()) TVApi.demo.session("NONE");   // 시안: 바로 열어도 보이게
  }
  return TVApi.check_channel().then(({ relation }) => {
    if (relation === "ADDED" && !q.has("demo")) return goNext();
    if (relation === "BLOCKED") { $("st").textContent = "차단함"; say("채널을 차단해 두셨어요. 카카오톡에서 차단을 풀어야 열려요. 풀었다면 아래 단추로 다시 추가해 주세요.", true); }
  }).catch((e) => {
    if (e && e.code === "auth_required") { location.replace("d2_login.html"); return; }
    say((e && e.code === "channel_unavailable" && e.userMessage) || "채널 상태를 확인하지 못했어요. 채널 추가하기를 눌러 주세요.", true);
  });
});
