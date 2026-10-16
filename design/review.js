const P = TVP, $ = id => document.getElementById(id), esc = P.esc, B = P.bank();
const ARROW = `<svg viewBox="0 0 24 16" aria-hidden="true"><path d="M2 8.4c6.6-.6 13-.2 19.4-.4"/><path d="M15.4 2.4 21.6 8l-6.2 5.8"/></svg>`;
const when = d => { const n = P.daysBetween(P.TODAY, d); return n <= 0 ? "오늘" : n === 1 ? "내일" : `${+d.slice(0, 2)}월 ${+d.slice(2)}일`; };
// 상자 칸 이름 : 그 칸에 들어가면 언제 다시 나오나
const BOX = [null, ["1칸", "다음 날"], ["2칸", "3일 뒤"], ["3칸", "1주 뒤"], ["다 외움", "빠졌어요"]];

// 연필로 그린 네모(칸마다 조금씩 다르게)
function handBox(seed){ const r = P.rnd(seed), j = () => (r() - .5) * 2.4;
  return `M${3 + j()} ${4 + j()} C${30 + j()} ${3 + j()} ${70 + j()} ${5 + j()} ${97 + j()} ${3 + j()} C${98 + j()} ${30 + j()} ${96 + j()} ${70 + j()} ${97 + j()} ${97 + j()} C${70 + j()} ${96 + j()} ${30 + j()} ${98 + j()} ${3 + j()} ${96 + j()} C${4 + j()} ${70 + j()} ${2 + j()} ${30 + j()} ${4 + j()} ${6 + j()}`; }

let queue = [], at = 0, phase = "look", results = [], practiced = new Set(), prevCounts = null;

function start(){
  queue = P.review.due().map(x => ({ w: x.w, box: x.box, extra: false }));
  at = 0; phase = "look"; results = []; practiced = new Set();
  renderBoxes(); queue.length ? renderCard() : renderEmpty();
}
function renderBoxes(curBox){
  const c = P.review.counts();
  $("boxes").innerHTML = [1, 2, 3, 4].map(b => `<li class="bx${b === curBox ? " cur" : ""}${b === 4 ? " out" : ""}"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${handBox(b * 17)}"/></svg>
      <span class="c${prevCounts && prevCounts[b] !== c[b] ? " bump" : ""}">${c[b]}</span><b>${BOX[b][0]}</b><small>${BOX[b][1]}</small><span class="vh">단어 ${c[b]}개</span></li>`).join("");
  prevCounts = c;
}
function stepsHtml(){ const S = ["보기", "가리고 쓰기", "확인"], k = phase === "look" ? 0 : phase === "write" ? 1 : 2;
  return `<ol class="steps" aria-label="단계">${S.map((s, i) => `<li class="${i === k ? "on" : i < k ? "past" : ""}"${i === k ? ' aria-current="step"' : ""}><i></i>${s}</li>`).join("")}</ol>`; }

function renderCard(){
  const item = queue[at], w = item.w, miss = P.lastMiss(B, w), real = queue.filter(x => !x.extra).length;
  $("sub").innerHTML = `오늘 복습할 단어 <b>${real}개</b> · 지금 ${at + 1}번째${queue.length > real ? ` (한 번 더 ${queue.length - real}개)` : ""}`;
  renderBoxes(item.box);
  const { kb, ka } = P.lcsMarks(miss || "", w);
  const word = miss ? P.markUp(w, kb, "mark") : esc(w);
  const before = miss ? `<p class="before">전에 쓴 답 <span class="mine">${P.markUp(miss, ka, "u")}</span></p>` : "";
  const el = $("card"); el.className = "paper enter";
  el.innerHTML = `<span class="qno">${at + 1}</span>${stepsHtml()}
    <h2 class="ask" id="card-ask">${phase === "look" ? "눈으로 보고, 소리 내어 읽어요" : "가리고 써 봐요"}${item.extra ? '<span class="again">한 번 더</span>' : ""}</h2>
    <div class="stage" id="stage"><span class="word">${word}</span>${P.spk(w)}<span class="cover" aria-hidden="true">가렸어요</span></div>
    <div id="slot">${before}</div><div id="res"></div>`;
  renderDock();
}
function toWrite(){
  phase = "write";
  const el = $("card");
  el.querySelector(".steps").outerHTML = stepsHtml();
  $("card-ask").innerHTML = "가리고 써 봐요" + (queue[at].extra ? '<span class="again">한 번 더</span>' : "");
  $("stage").classList.add("covered");
  $("stage").querySelector(".word").setAttribute("aria-hidden", "true");
  $("slot").innerHTML = `<label class="vh" for="ans">외운 단어 쓰기</label><input class="write" id="ans" type="text" placeholder="여기에 써요" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="done">`;
  const inp = $("ans");
  inp.oninput = () => { $("go").disabled = !P.norm(inp.value); };
  inp.onkeydown = e => { if (e.key === "Enter" && P.norm(inp.value)) { e.preventDefault(); check(inp.value); } };
  renderDock();
  inp.focus({ preventScroll: true });
}
// 확인 : 쪽지를 떼고 빨간 펜. 처음 푼 것만 기록(한 번 더는 연습)
function check(given){
  if (phase !== "write") return;
  const item = queue[at], ok = !!P.norm(given) && P.norm(given) === P.norm(item.w);
  phase = "checked";
  const before = P.review.state()[item.w];
  if (!item.extra) P.review.add({ w: item.w, ok, src: "review" });
  const after = P.review.state()[item.w];
  if (!item.extra) results.push({ w: item.w, ok, given: P.norm(given), after });
  if (!ok && !item.extra && !practiced.has(item.w)) { practiced.add(item.w); queue.push({ w: item.w, box: 1, extra: true }); }
  const el = $("card");
  el.querySelector(".steps").outerHTML = stepsHtml();
  $("stage").classList.remove("covered"); $("stage").querySelector(".word").removeAttribute("aria-hidden");
  const qno = el.querySelector(".qno"); qno.classList.add("marked"); if (!ok) qno.classList.add("x"); qno.insertAdjacentHTML("beforeend", P.markSvg(ok, at * 7 + 3));
  $("slot").innerHTML = "";
  $("card-ask").innerHTML = ok ? "잘 외웠어요" : "다시 봐요";
  const { kb } = P.lcsMarks(given || "", item.w);
  let mv;
  if (item.extra) mv = ok ? "이번엔 맞았어요. 내일 다시 볼게요." : "내일 다시 볼게요.";
  else if (!ok) mv = "1칸으로. 내일 다시 나와요.";
  else if (after && after.done) mv = "3칸을 다 지났어요. 다 외운 단어!";
  else if (after && before && after.box > before.box) mv = `${after.box}칸으로. ${when(after.due)} 다시 나와요.`;
  else mv = "맞았어요.";
  $("res").innerHTML = `<div class="res" role="status">${ok
      ? `<span class="mine">${esc(P.norm(given))}</span><span class="praise">맞았어요!</span>`
      : `${P.norm(given) ? `<span class="mine">${esc(P.norm(given))}<span class="strike"></span></span>` : ""}<span class="fix">${given ? P.markUp(item.w, kb, "u") : esc(item.w)}</span>`}
    <p class="mv${ok && !item.extra ? " up" : ""}">${mv}</p></div>`;
  renderBoxes(after ? (after.done ? 4 : after.box) : item.box);
  renderDock();
  const nx = $("next"); if (nx && matchMedia("(pointer:fine)").matches) nx.focus({ preventScroll: true });
}
function renderDock(){
  const d = $("dock");
  if (phase === "look") { d.innerHTML = `<button type="button" class="act" id="hide">가리고 쓰기${ARROW}</button>`; $("hide").onclick = toWrite; }
  else if (phase === "write") { d.innerHTML = `<button type="button" class="act alt" id="peek">모르겠어요</button><button type="button" class="act" id="go" disabled>확인</button>`;
    $("peek").onclick = () => check(""); $("go").onclick = () => check($("ans").value); }
  else if (phase === "checked") { const last = at === queue.length - 1;
    d.innerHTML = `<button type="button" class="act" id="next">${last ? "복습 끝" : "다음 단어"}${ARROW}</button>`;
    $("next").onclick = () => { if (last) renderEnd(); else { at++; phase = "look"; renderCard(); } }; }
  else d.innerHTML = `<a class="act alt" href="d2_quiz.html">단어 퀴즈</a><a class="act" href="d2_dashboard.html">내 시험지로${ARROW}</a>`;
}
function renderEnd(){
  phase = "end";
  const ok = results.filter(r => r.ok).length, nx = P.review.next();
  $("sub").innerHTML = `오늘 복습할 단어 <b>${results.length}개</b>를 다 봤어요`;
  renderBoxes();
  const el = $("card"); el.className = "paper enter";
  el.innerHTML = `<h2 class="ask" id="card-ask">오늘 복습 끝!</h2><p class="ask-s">${results.length}개 중 ${ok}개 맞혔어요.${nx ? ` 다음 복습은 ${when(nx.d)}, ${nx.n}개예요.` : ""}</p>
    <ol class="endlist">${results.map((r, i) => `<li class="marked${r.ok ? "" : " x"} still"><span class="n">${i + 1}${P.markSvg(r.ok, i * 7 + 3)}</span>
      <span class="w">${esc(r.w)}<small class="${r.ok ? "up" : ""}">${r.after.done ? "다 외웠어요" : `${r.after.box}칸 · ${when(r.after.due)} 다시`}</small></span>${P.spk(r.w)}<span class="vh">${r.ok ? "맞음" : "틀림"}</span></li>`).join("")}</ol>`;
  renderDock();
  window.scrollTo({ top: 0, behavior: P.reduced() ? "auto" : "smooth" });
}
function renderEmpty(){
  phase = "end";
  const nx = P.review.next(), c = P.review.counts();
  $("sub").innerHTML = P.review.reviewedToday() ? "오늘 복습을 다 했어요" : "오늘은 복습할 단어가 없어요";
  const el = $("card"); el.className = "paper empty";
  el.innerHTML = `<h2 class="ask" id="card-ask">${P.review.reviewedToday() ? "오늘 복습 끝!" : "오늘 복습할 단어가 없어요"}</h2>
    <p class="ask-s">${nx ? `다음 복습은 ${when(nx.d)}, ${nx.n}개예요.` : c[4] ? "칸에 남은 단어가 없어요. 다 외웠어요." : "시험지를 채점하면 틀린 단어가 여기로 와요."}</p>`;
  renderDock();
}
$("wipe").onclick = () => { P.review.clear(); prevCounts = null; start(); };
start();
