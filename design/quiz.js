const P = TVP, $ = id => document.getElementById(id), esc = P.esc;
const ARROW = `<svg viewBox="0 0 24 16" aria-hidden="true"><path d="M2 8.4c6.6-.6 13-.2 19.4-.4"/><path d="M15.4 2.4 21.6 8l-6.2 5.8"/></svg>`;
// 문제 꼴 : 고르기(쉬움) → 빠진 글자 → 듣고 쓰기(어려움). 소리를 못 내는 기기면 듣고 쓰기 대신 빠진 글자.
const KINDS = ["pick", "gap", "hear"];
let round = 0, qs = [], at = 0, done = [], state = "ask", gapFill = [], fromClick = false, fresh = -1;

function build(){
  const pool = P.quizPool(10);
  qs = pool.map((x, i) => {
    let kind = KINDS[(i + round) % 3];
    if (kind === "hear" && !P.tts.available()) kind = "gap";
    if (kind === "gap" && x.w.replace(/ /g, "").length < 4) kind = "pick";
    const q = { ...x, kind };
    if (kind === "pick") {
      const wrongs = P.misspell(x.w, 2, x.miss ? [x.miss] : []);
      const opts = [x.w, ...wrongs], r = P.rnd(P.hash(x.w) + round * 7);
      for (let k = opts.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [opts[k], opts[j]] = [opts[j], opts[k]]; }
      q.opts = opts;
    }
    if (kind === "gap") q.g = P.gaps(x.w, x.miss);
    return q;
  });
  at = 0; done = []; state = "ask";
}

function renderStrip(){
  $("strip").innerHTML = qs.map((q, i) => { const d = done[i];
    return `<li class="${i === at && state !== "end" ? "now" : ""}${d ? " did marked" + (d.ok ? "" : " x") + (i === fresh ? "" : " still") : ""}"${i === at && state !== "end" ? ' aria-current="step"' : ""}>${i + 1}${d ? P.markSvg(d.ok, i * 7 + 3) : ""}<span class="vh">${d ? (d.ok ? "맞음" : "틀림") : ""}</span></li>`; }).join("");
}
const ASK = { pick: ["바르게 쓴 단어를 골라요", "소리를 듣고 골라도 좋아요"], gap: ["빠진 글자를 채워요", "아래 글자를 눌러 빈칸에 넣어요"], hear: ["소리를 듣고 써요", "몇 번이든 다시 들어도 돼요"] };

function renderQ(){
  const q = qs[at], el = $("q"), [ask, hint] = ASK[q.kind];
  $("sub").innerHTML = `틀린 단어부터 <b>${qs.length}문제</b> · 지금 ${at + 1}번`;
  let body = "";
  if (q.kind === "pick") body = `<ul class="opts">${q.opts.map((o, k) => `<li><button type="button" class="opt" data-k="${k}"><span class="t">${esc(o)}</span></button></li>`).join("")}</ul>`;
  if (q.kind === "gap") {
    gapFill = q.g.pos.map(() => null);
    const L = [...q.w];
    body = `<div class="slots" id="slots">${L.map((ch, i) => { const g = q.g.pos.indexOf(i);
        return g >= 0 ? `<button type="button" class="gap" data-g="${g}" aria-label="빈칸 ${g + 1}"></button>` : ch === " " ? '<span class="ch">&nbsp;</span>' : `<span class="ch">${esc(ch)}</span>`; }).join("")}</div>
      <div class="tiles" id="tiles">${q.g.tiles.map((t, k) => `<button type="button" class="tile" data-k="${k}" aria-label="${t} 넣기">${esc(t)}</button>`).join("")}</div>`;
  }
  if (q.kind === "hear") body = `<div class="listen">${P.spk(q.w, "문제 단어", "big")}<button type="button" class="slow spk-slow">천천히 듣기</button></div>
      <label class="vh" for="ans">들은 단어 쓰기</label><input class="write" id="ans" type="text" placeholder="여기에 써요" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="done">
      <p class="len">${q.w.replace(/ /g, "").length}글자${q.w.includes(" ") ? " · 두 낱말" : ""}</p>`;
  const say = q.kind === "pick" ? `<div class="listen">${P.spk(q.w, "문제 단어")}</div>` : "";
  el.className = "paper enter";
  el.innerHTML = `<span class="qno" id="qno">${at + 1}</span><h2 class="ask" id="q-ask">${ask}</h2><p class="ask-s">${hint}</p>${say}${body}<div id="res"></div>`;
  wire(q);
  renderDock();
  renderStrip();
  if (q.kind === "hear") {
    const inp = $("ans");
    if (matchMedia("(pointer:fine)").matches) inp.focus({ preventScroll: true });
    if (fromClick) P.tts.speak(q.w, { btn: el.querySelector(".spk") });   // 불러 주는 것처럼 : 누른 뒤에만 소리(자동 재생 막힘 피함)
  }
  fromClick = false;
}
function wire(q){
  const el = $("q");
  if (q.kind === "pick") el.querySelectorAll(".opt").forEach(b => b.onclick = () => check(q.opts[+b.dataset.k], +b.dataset.k));
  if (q.kind === "gap") {
    el.querySelectorAll(".tile").forEach(t => t.onclick = () => { const g = gapFill.indexOf(null); if (g < 0 || state !== "ask") return;
      gapFill[g] = +t.dataset.k; t.disabled = true; paintGaps(q); });
    el.querySelectorAll(".gap").forEach(b => b.onclick = () => { const g = +b.dataset.g; if (gapFill[g] == null || state !== "ask") return;
      el.querySelector(`.tile[data-k="${gapFill[g]}"]`).disabled = false; gapFill[g] = null; paintGaps(q); });
    paintGaps(q);
  }
  if (q.kind === "hear") {
    const inp = $("ans");
    inp.oninput = () => { const b = $("go"); if (b) b.disabled = !P.norm(inp.value); };
    inp.onkeydown = e => { if (e.key === "Enter" && P.norm(inp.value)) { e.preventDefault(); check(inp.value); } };
    el.querySelector(".spk-slow").onclick = () => P.tts.speak(q.w, { slow: true, btn: el.querySelector(".spk") });
  }
}
function paintGaps(q){
  const el = $("q"), nxt = gapFill.indexOf(null);
  el.querySelectorAll(".gap").forEach(b => { const g = +b.dataset.g, k = gapFill[g];
    b.textContent = k == null ? "" : q.g.tiles[k]; b.classList.toggle("next", g === nxt);
    b.setAttribute("aria-label", k == null ? `빈칸 ${g + 1}` : `빈칸 ${g + 1} ${q.g.tiles[k]}, 눌러서 빼기`); });
  const go = $("go"); if (go) go.disabled = nxt >= 0;
}
function gapWord(q){ const L = [...q.w]; q.g.pos.forEach((p, g) => { L[p] = gapFill[g] == null ? "_" : q.g.tiles[gapFill[g]]; }); return L.join(""); }

function renderDock(){
  const d = $("dock"), q = qs[at];
  if (state === "ask") {
    const need = q.kind !== "pick";
    d.innerHTML = `<button type="button" class="act alt" id="skip">모르겠어요</button>${need ? `<button type="button" class="act" id="go" disabled>확인</button>` : ""}`;
    $("skip").onclick = () => check("");
    if (need) $("go").onclick = () => check(q.kind === "hear" ? $("ans").value : gapWord(q));
    if (q.kind === "hear") $("ans").dispatchEvent(new Event("input"));
    if (q.kind === "gap") paintGaps(q);
  } else if (state === "checked") {
    const last = at === qs.length - 1;
    d.innerHTML = `<button type="button" class="act" id="next">${last ? "결과 보기" : "다음 문제"}${ARROW}</button>`;
    $("next").onclick = () => { if (last) { state = "end"; renderEnd(); } else { at++; state = "ask"; fromClick = true; renderQ(); } };
  } else {
    const n = done.filter(x => !x.ok).length;
    d.innerHTML = `<button type="button" class="act alt" id="again">한 번 더</button>${n ? `<a class="act" href="d2_review.html">오늘 복습 하기${ARROW}</a>` : `<a class="act" href="d2_dashboard.html">내 시험지로${ARROW}</a>`}`;
    $("again").onclick = () => { round++; build(); fromClick = true; renderQ(); window.scrollTo({ top: 0, behavior: P.reduced() ? "auto" : "smooth" }); };
  }
}

// 채점 : 빨간 펜(문제 번호에 동그라미 · 빗금, 틀리면 바른 철자를 빨간 글씨로)
function check(given, pickK){
  if (state !== "ask") return;
  const q = qs[at], ok = !!P.norm(given) && P.norm(given) === P.norm(q.w), el = $("q");
  state = "checked"; done[at] = { w: q.w, ok, given: P.norm(given) };
  if (!ok) P.review.add({ w: q.w, ok: false, src: "quiz" });   // 틀린 단어는 오늘 복습 1칸으로
  el.querySelectorAll(".opt,.tile,.gap,.write,.slow").forEach(n => { if (n.tagName === "INPUT") n.readOnly = true; else n.disabled = true; });
  const qno = $("qno"); qno.classList.add("marked"); if (!ok) qno.classList.add("x"); qno.insertAdjacentHTML("beforeend", P.markSvg(ok, at * 7 + 3));
  if (q.kind === "pick") {
    const right = el.querySelector(`.opt[data-k="${q.opts.indexOf(q.w)}"] .t`);
    right.insertAdjacentHTML("beforeend", `<svg class="ring" viewBox="0 0 120 60" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="${P.handCircle(at * 11 + 5, 120, 60, 1.06)}"/></svg>`);
    if (!ok && pickK != null) el.querySelector(`.opt[data-k="${pickK}"] .t`).insertAdjacentHTML("beforeend", '<span class="strike"></span>');
  }
  if (q.kind === "hear") el.querySelectorAll(".write,.len").forEach(n => n.remove());
  if (q.kind === "gap") el.querySelectorAll(".gap").forEach(b => { const g = +b.dataset.g; if (q.g.tiles[gapFill[g]] !== q.g.want[g]) b.classList.add("bad"); });
  const { kb } = P.lcsMarks(given || "", q.w);
  const fix = given ? P.markUp(q.w, kb, "u") : esc(q.w);
  const mine = q.kind === "pick" ? "" : given ? `<span class="mine">${esc(P.norm(given))}<span class="strike"></span></span>` : "";
  $("res").innerHTML = `<div class="res" role="status">${ok
      ? `<span class="ok">${esc(q.w)}</span><span class="praise">맞았어요!</span>${P.spk(q.w)}`
      : `${mine}<span class="fix">${fix}</span>${P.spk(q.w)}<p class="nx">${given ? "" : "괜찮아요. "}이 단어는 오늘 복습에 넣었어요.</p>`}</div>`;
  fresh = at; renderStrip(); fresh = -1; renderDock();
  const nx = $("next"); if (nx && matchMedia("(pointer:fine)").matches) nx.focus({ preventScroll: true });
}

function renderEnd(){
  const n = done.filter(x => x.ok).length, N = qs.length, pct = Math.round(n * 100 / N);
  const praise = pct === 100 ? "참 잘했어요!" : pct >= 90 ? "훌륭해요!" : "";
  const miss = done.filter(x => !x.ok).length;
  P.setQuizDone();
  $("sub").innerHTML = `틀린 단어부터 <b>${N}문제</b> 다 풀었어요`;
  const el = $("q"); el.className = "paper enter";
  el.innerHTML = `<div class="end-h"><div><h2 class="ask" id="q-ask">퀴즈 끝!</h2>${praise ? `<span class="praise">${praise}</span>` : ""}</div>
      <div class="total" role="img" aria-label="${N}문제 중 ${n}문제 맞음"><svg viewBox="0 0 120 94" aria-hidden="true"><path pathLength="1" d="${P.handCircle(N * 13 + n, 120, 94, 1.08)}"/></svg><span class="v">${n}<small>/${N}</small></span></div></div>
    <ol class="endlist">${done.map((d, i) => `<li class="marked${d.ok ? "" : " x"} still"><span class="n">${i + 1}${P.markSvg(d.ok, i * 7 + 3)}</span>
      <span class="w">${esc(d.w)}${!d.ok ? `<small>${d.given ? `내 답 <s>${esc(d.given)}</s>` : "모르겠어요"}</small>` : ""}</span>${P.spk(d.w)}<span class="vh">${d.ok ? "맞음" : "틀림"}</span></li>`).join("")}</ol>
    <p class="end-p">${miss ? `틀린 단어 <b>${miss}개</b>는 오늘 복습에 넣었어요.` : "틀린 단어가 없어요."}</p>`;
  renderStrip(); renderDock();
}

// 빠진 글자 : 자판으로도(글자 누르면 같은 글자 칸, 지우기는 마지막 칸 비우기)
document.addEventListener("keydown", e => {
  const q = qs[at]; if (!q || q.kind !== "gap" || state !== "ask" || e.metaKey || e.ctrlKey || e.altKey) return;
  if (/^[a-z]$/i.test(e.key)) { const t = [...$("q").querySelectorAll(".tile:not([disabled])")].find(b => b.textContent === e.key.toLowerCase()); if (t) { e.preventDefault(); t.click(); } }
  if (e.key === "Backspace") { const g = gapFill.map((v, i) => v == null ? -1 : i).filter(i => i >= 0).pop(); if (g != null) { e.preventDefault(); $("q").querySelector(`.gap[data-g="${g}"]`).click(); } }
});
$("wipe").onclick = () => { P.review.clear(); P.clearQuiz(); round = 0; build(); renderQ(); };

build();
if (!qs.length) {
  $("sub").textContent = "채점한 시험이 아직 없어요.";
  $("q").innerHTML = `<h2 class="ask" id="q-ask">퀴즈에 낼 단어가 없어요</h2><p class="ask-s">시험지를 채점하면 그 단어로 퀴즈가 생겨요.</p>`;
  $("dock").innerHTML = `<a class="act" href="d2_dashboard.html">내 시험지로${ARROW}</a>`;
} else renderQ();
