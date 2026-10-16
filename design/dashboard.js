// 로그인한 학생 한 명 : 실제로는 서버가 이 학생 것만 내려준다(다른 학생 결과는 페이지에 없음)
const ME = { name: "Mia", cls: "LIV1-4" };
let API = TV.student(ME.name, ME.cls);          // 실제 모드에서는 아래 realStudent() 로 바뀐다(같은 꼴)
let TODAY = API.history[API.history.length - 1];
const $ = id => document.getElementById(id);
const store = { get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }, set(k,v){ try { localStorage.setItem(k,v); } catch(e){} }, del(k){ try { localStorage.removeItem(k); } catch(e){} } };
const KEY = d => `tv-graded-${ME.cls}-${ME.name}-${d}`;
// 지난 날은 이미 채점(고정). 오늘 것만 학생이 처음 열 때 「채점하기」. 한 번 채점하면 고정.
const isGraded = d => d !== TODAY || store.get(KEY(d)) === "1";
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const rate = rs => { const q = rs.reduce((a,r)=>a+r.q,0), c = rs.reduce((a,r)=>a+r.correct,0); return { q, c, p: q ? Math.round(c*100/q) : 0 }; };
const esc = s => String(s).replace(/[&<>"']/g, ch => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[ch]));
let day = TODAY, tab = "day", busy = false;

// 손으로 그린 동그라미 : 문항마다 조금씩 다르게(같은 문항은 늘 같은 모양)
function rnd(seed){ let s = seed * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); }
function handCircle(seed, w, h, turns = 1.12){
  const r = rnd(seed), cx = w/2, cy = h/2, pts = [], n = 10, a0 = -2.4 + r()*.4;
  for (let i = 0; i <= n; i++){ const a = a0 + (Math.PI*2*turns) * i/n, k = 1 + (r()-.5)*.14 - (i/n)*.05;
    pts.push([cx + Math.cos(a)*(w/2-3)*k, cy + Math.sin(a)*(h/2-3)*k]); }
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length-1; i++){ const p0 = pts[i-1]||pts[i], p1 = pts[i], p2 = pts[i+1], p3 = pts[i+2]||p2;
    const c1 = [p1[0]+(p2[0]-p0[0])/6, p1[1]+(p2[1]-p0[1])/6], c2 = [p2[0]-(p3[0]-p1[0])/6, p2[1]-(p3[1]-p1[1])/6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`; }
  return d;
}
function handSlash(seed){ const r = rnd(seed); return `M${(5+r()*4).toFixed(1)} ${(34+r()*3).toFixed(1)} Q${(20+r()*4).toFixed(1)} ${(22-r()*4).toFixed(1)} ${(40+r()*3).toFixed(1)} ${(3+r()*3).toFixed(1)}`; }

const PEN = `<svg viewBox="0 0 84 84" aria-hidden="true"><g transform="rotate(-38 42 42)"><rect x="18" y="35" width="56" height="14" rx="3" fill="#d71718" stroke="#221815" stroke-width="2"/><rect x="58" y="35" width="7" height="14" fill="#9e0f10"/><path d="M18 35 L4 42 L18 49 Z" fill="#fce9c8" stroke="#221815" stroke-width="2" stroke-linejoin="round"/><path d="M8.5 39.6 L4 42 L8.5 44.4 Z" fill="#d71718"/><rect x="66" y="31" width="12" height="4" rx="2" fill="#221815"/></g></svg>`;
const BTN_PEN = `<svg class="pen" viewBox="0 0 40 40" aria-hidden="true"><g transform="rotate(-40 20 20)"><rect x="9" y="15" width="27" height="10" rx="2" fill="#fcd377" stroke="#fff" stroke-width="2"/><rect x="30" y="15" width="6" height="10" fill="#fff"/><path d="M9 15 L1 20 L9 25 Z" fill="#fce9c8" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><path d="M3.6 18.5 L1 20 L3.6 21.5 Z" fill="#221815"/></g></svg>`;
const ARROW = `<svg viewBox="0 0 34 40" aria-hidden="true"><path d="M4 4 C20 6 28 16 22 34"/><path d="M14 28 L22 36 L29 27"/></svg>`;
// 손으로 그린 웃는 얼굴(로그인 화면과 같은 결) : 칭찬 기준 90점 이상인 날만
const SMILE = `<svg class="smile" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.4c5.3-.2 9.4 3.6 9.5 9.2.1 5.5-4 9.9-9.4 9.9-5.4.1-9.6-4.1-9.6-9.4C2.5 6.6 6.4 2.6 12 2.4Z" fill="#fcd377" stroke="#673a1b" stroke-width="1.6" stroke-linejoin="round"/><path d="M8.6 9.6v1.6M15.3 9.4v1.7" stroke="#673a1b" stroke-width="1.8" stroke-linecap="round"/><path d="M7.6 14.2c1.4 2.4 6.6 2.7 8.9-.3" fill="none" stroke="#673a1b" stroke-width="1.7" stroke-linecap="round"/></svg>`;
const ULINE = `<svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true"><path d="M2 6 C25 2 55 9 98 4" fill="none" stroke="#89b929" stroke-width="3" stroke-linecap="round"/></svg>`;

// 날짜 계산(시안 데이터는 2026년)
const WD = ["일","월","화","수","목","금","토"];
const dateOf = d => new Date(2026, +d.slice(0,2)-1, +d.slice(2));
const mondayOf = d => { const t = dateOf(d); t.setDate(t.getDate() - ((t.getDay()+6)%7)); return t; };

function renderTop(){
  $("who").textContent = ME.display || ME.name; $("nm").textContent = ME.display || ME.name;
  const sub = $("sub");
  if (day === TODAY && !isGraded(day)) sub.innerHTML = "오늘 시험지가 도착했어요. <b>채점하기</b>를 눌러 보세요.";
  else { const r = API.result(day); sub.innerHTML = `${day === TODAY ? "오늘" : TV.label(day)} <b>${r.q}문제 중 ${r.correct}문제</b> 맞혔어요.${r.wrong ? ` <a class="jump" href="#memo">다시 외울 단어 ${r.wrong}개</a>` : ''}`; }
}
function renderFlow(stampDay, smooth){
  const flow = $("flow"), m0 = mondayOf(TODAY).getTime(), weeks = new Map();
  API.history.forEach(d => { const k = mondayOf(d).getTime(); if (!weeks.has(k)) weeks.set(k, []); weeks.get(k).push(d); });
  const rel = k => { const n = Math.round((m0 - k) / (7*864e5)); return n === 0 ? "이번 주" : n === 1 ? "지난주" : `${n}주 전`; };
  flow.innerHTML = [...weeks.entries()].map(([k, ds]) => { const mon = new Date(k);
    return `<div class="wk${k === m0 ? ' now' : ''}" role="group" aria-label="${rel(k)}"><span class="wk-l">${rel(k)}<small>${mon.getMonth()+1}월 ${mon.getDate()}일~</small></span><div class="wk-days">${ds.map(d => {
      const g = isGraded(d), r = g ? API.result(d) : null, isT = d === TODAY, dt = dateOf(d);
      return `<button type="button" class="day${isT?' today':''}${g?' graded':''}${d===stampDay?' stamp':''}" data-d="${d}" aria-pressed="${d===day}" aria-label="${TV.label(d)} ${WD[dt.getDay()]}요일 ${g ? r.score+'점' : '채점 전'}">
        ${g && r.score >= 90 ? SMILE : ''}<span class="d">${isT ? '<b>오늘</b>' : `<b>${dt.getDate()}</b>일 ${WD[dt.getDay()]}`}</span>${g ? `<span class="s">${r.score}</span>` : '<span class="s wait">채점 전</span>'}</button>`; }).join("")}</div></div>`; }).join("");
  const on = flow.querySelector('[aria-pressed="true"]');
  if (on) { const left = Math.max(0, on.offsetLeft + on.offsetWidth - flow.clientWidth + 24);   // 고른 칸이 오른쪽 끝에 오도록(지난 날이 왼쪽에 보이게)
    if (smooth && !reduced()) flow.scrollTo({ left, behavior: "smooth" }); else flow.scrollLeft = left; }
}
function sheetHead(s){
  return `<div class="sheet-h"><h2 id="sheet-title">${TV.label(s.d)} 시험지</h2><div class="meta">${esc(s.subject)} ${s.q}문제<br>${esc(s.cls)} 담임 ${esc(s.teacher)}</div>`;
}
// 채점 전: 학생이 쓴 단어만. 정답·맞음 여부·점수는 DOM 에 없다.
function renderBlank(){
  const s = API.sheet(day), el = $("sheet");
  el.className = "sheet";
  // 점수 자리 : 빈 점선 동그라미만. 채점하면 빨간 펜이 이 자리에 동그라미를 그린다.
  el.innerHTML = sheetHead(s) + `<div class="total wait" aria-hidden="true"><svg viewBox="0 0 116 92"><path pathLength="1" d="${handCircle(s.q*13, 116, 92, 1.0)}"/></svg><span class="v">채점 전</span></div></div>
    <ol class="items">${s.words.map(w => `<li><span class="n">${w.no}</span><span class="ans">${w.wrote ? `<span class="w">${esc(w.wrote)}</span>` : '<span class="w blank"></span>'}</span></li>`).join("")}</ol>
    <div class="cta" id="cta"><div class="gwrap"><span class="ring"></span>
      <button class="gbtn" id="gbtn" type="button">${BTN_PEN}<span class="lbl">채점하기</span></button></div>
      <div class="hint">눌러서 오늘 시험지 채점!${ARROW}</div><div class="err" id="err" role="alert"></div></div>`;
  $("gbtn").onclick = grade;
}
// 채점된 시험지. animate = 빨간 펜이 지금 매기는 연출
function renderGraded(r, animate){
  const el = $("sheet"), step = Math.min(.22, Math.max(.12, 2.8 / r.q));
  let t = .35; const times = [];
  const items = r.items.map(it => { const at = t; times.push({ no: it.no, at, ok: it.ok }); t += step + (it.ok ? 0 : .6);
    const mark = it.ok ? handCircle(it.no*7+3, 46, 38) : handSlash(it.no*5+1);
    const word = it.wrote ? `<span class="w">${esc(it.wrote)}${it.ok ? '' : '<span class="strike"></span>'}</span>` : '<span class="w blank"></span>';
    return `<li${it.ok ? "" : ' class="x"'} style="--t:${at.toFixed(2)}s" data-no="${it.no}"><span class="n">${it.no}<svg class="mark" viewBox="0 0 46 38" aria-hidden="true"><path pathLength="1" d="${mark}"/></svg></span>
      <span class="ans">${word}${it.ok ? '' : `<span class="fix">${esc(it.ans)}</span>`}</span><span class="vh">${it.ok ? '맞음' : '틀림, 정답 ' + esc(it.ans)}</span>${TVP.spk(it.ans, `${it.no}번 ${it.ans}`)}</li>`; }).join("");
  const tt = t + .15;
  const praise = r.score === 100 ? '참 잘했어요!' : r.score >= 90 ? '훌륭해요!' : '';
  el.className = "sheet " + (animate ? "run" : "done");
  el.innerHTML = sheetHead(r) + `<div class="total" style="--t:${tt.toFixed(2)}s" aria-label="${r.q}문제 중 ${r.correct}문제 맞음"><svg viewBox="0 0 116 92" aria-hidden="true"><path pathLength="1" d="${handCircle(r.q*13+r.correct, 116, 92, 1.08)}"/></svg><span class="v">${r.correct}<small>/${r.q}</small></span></div>
    ${praise ? `<div class="praise" style="--t:${tt.toFixed(2)}s">${praise}</div>` : ''}</div><ol class="items">${items}</ol>`;
  return { times, end: tt + (praise ? 1.35 : 0.9) };
}
// 빨간 펜이 문항을 차례로 찾아가며 매긴다(Web Animations)
function runPen(times, end){
  const el = $("sheet"), pen = document.createElement("div"), box = el.getBoundingClientRect();
  pen.className = "redpen"; pen.innerHTML = PEN; el.appendChild(pen);
  const at = (node, dx = 0, dy = 0) => { const b = node.getBoundingClientRect(); return [b.left - box.left + b.width/2 + dx, b.top - box.top + b.height/2 + dy]; };
  const pos = (x, y) => `translate(${(x - 6).toFixed(1)}px, ${(y - 66).toFixed(1)}px)`;   // 펜 끝(6,66)을 점에 맞춘다
  const frames = [{ t: 0, x: box.width + 30, y: 40, o: 0 }];
  times.forEach(({ no, at: t, ok }) => { const li = el.querySelector(`li[data-no="${no}"]`), [x, y] = at(li.querySelector(".n"));
    frames.push({ t: Math.max(0, t - .1), x: x - 12, y: y - 8, o: 1 }, { t: t + .22, x: x + 10, y: y + 6, o: 1 });
    if (!ok) { const f = li.querySelector(".fix"), [fx, fy] = at(f); const w = f.getBoundingClientRect().width;
      frames.push({ t: t + .24, x: fx - w/2, y: fy + 6, o: 1 }, { t: t + .58, x: fx + w/2, y: fy + 4, o: 1 }); } });
  const [tx, ty] = at(el.querySelector(".total"));
  const tt = parseFloat(el.querySelector(".total").style.getPropertyValue("--t"));
  frames.push({ t: tt, x: tx - 30, y: ty - 30, o: 1 }, { t: tt + .7, x: tx + 20, y: ty + 10, o: 1 }, { t: end - .2, x: tx + 70, y: ty - 40, o: 0 });
  const T = end; frames.sort((a, b) => a.t - b.t);   // 시간순(겹치는 구간이 있어도 Web Animations 오프셋은 늘 오름차순)
  pen.animate(frames.map(f => ({ transform: pos(f.x, f.y), opacity: f.o, offset: Math.min(1, f.t / T), easing: "cubic-bezier(.65,0,.35,1)" })),   // 구간마다 가속·감속(등속 미끄럼 X)
    { duration: T * 1000, easing: "linear", fill: "forwards" }).finished.then(() => pen.remove()).catch(() => pen.remove());
}
async function grade(){
  if (busy) return; busy = true;
  const btn = $("gbtn"), err = $("err");
  btn.disabled = true; btn.classList.add("loading"); $("cta").classList.add("busy"); btn.querySelector(".lbl").textContent = "불러오는 중"; err.textContent = "";
  let r;
  try { r = await API.fetchGrade(day); }
  catch (e) { busy = false; btn.disabled = false; btn.classList.remove("loading"); $("cta").classList.remove("busy"); btn.querySelector(".lbl").textContent = "채점하기";
    err.textContent = "채점을 불러오지 못했어요. 다시 눌러 주세요."; return; }
  store.set(KEY(day), "1");               // 한 번 채점되면 고정
  const cta = $("cta"); cta.classList.add("leave");
  const settle = () => { busy = false; $("sheet").classList.add("settled"); renderTop(); renderFlow(day); renderMemo(true); renderStat(); renderTodo(); };
  if (reduced()) { renderGraded(r, false); $("sheet").classList.add("fade-in"); settle(); return; }
  setTimeout(() => { const { times, end } = renderGraded(r, true); try { runPen(times, end); } catch (e) { document.querySelectorAll(".redpen").forEach(n => n.remove()); }
    setTimeout(settle, end * 1000); }, 200);
}

// ── 기록 칸이 쓰는 숫자(어느 안이든 같은 계산) ──
// 레벨 평균: 같은 레벨 전체의 맞힌 문제 / 전체 문제(숫자 하나). 다른 학생 이름·점수는 쓰지 않는다.
const levelRate = ds => { const t = ds.reduce((a, d) => { const x = API.levelTotal(d); return { c: a.c + x.c, q: a.q + x.q }; }, { c: 0, q: 0 }); return { ...t, p: t.q ? Math.round(t.c*100/t.q) : 0 }; };
const statOf = ds => ({ ds, R: rate(ds.map(d => API.result(d))), A: levelRate(ds) });
function groupBy(ds, keyFn){ const m = new Map(); ds.forEach(d => { const k = keyFn(d); if (!m.has(k)) m.set(k, []); m.get(k).push(d); }); return [...m.entries()].map(([k, g]) => ({ k, ...statOf(g) })); }
const weekKey = d => mondayOf(d).getTime(), monthKey = d => +d.slice(0, 2);
// 고른 날 기준 : 그날 · 그 주 · 그 달(채점된 날만 센다)
function recModel(){
  const graded = API.history.filter(isGraded), wk = weekKey(day), mo = monthKey(day);
  const days = graded.map(d => ({ k: d, ...statOf([d]) })), weeks = groupBy(graded, weekKey), months = groupBy(graded, monthKey);
  const wAgo = Math.round((weekKey(TODAY) - wk) / (7*864e5)), mon = mondayOf(day);
  return { days, weeks, months, level: API.level,
    sel: isGraded(day) ? days.find(x => x.k === day) : null,
    selLabel: day === TODAY ? "오늘" : TV.label(day),
    week: weeks.find(x => x.k === wk) || null,
    weekLabel: wAgo === 0 ? "이번 주" : wAgo === 1 ? "지난주" : `${mon.getMonth()+1}월 ${mon.getDate()}일 주`,
    month: months.find(x => x.k === mo) || null,
    monthLabel: mo === monthKey(TODAY) ? "이번 달" : `${mo}월`, mo };
}
const diffTxt = (me, lv) => me > lv ? `평균보다 ${me - lv}%p 높아요` : me < lv ? `평균보다 ${lv - me}%p 낮아요` : "평균과 같아요";
// 자주 틀린 단어(여러 날을 모아 많이 틀린 순)
function missBlock(title, ds){
  const miss = {}; ds.forEach(d => API.result(d).wrongs.forEach(w => miss[w.ans] = (miss[w.ans] || 0) + 1));
  const words = Object.entries(miss).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const body = !ds.length ? '<p class="none">채점한 시험이 아직 없어요.</p>'
    : !words.length ? `<span class="clear">틀린 단어가 없어요${ULINE}</span>`
    : `<ul>${words.map(([w, n]) => `<li>${esc(w)}${n > 1 ? `<small>${n}번</small>` : ''}</li>`).join("")}</ul>`;
  return `<div class="miss"><h3>${title}</h3>${body}</div>`;
}

//REC-JS-START
function renderStat(){
  const M = recModel(), LV = esc(M.level);
  const rows = [[M.selLabel, M.sel, "채점 전"], [M.weekLabel, M.week, "아직 없어요"], [M.monthLabel, M.month, "아직 없어요"]];
  const body = rows.map(([k, s, none]) => s
    ? `<tbody><tr><th scope="row">${k}<small>${s.R.q}문제 중 ${s.R.c}문제</small></th><td class="me">${s.R.p}<span class="u">%</span></td><td class="lv">${s.A.p}<span class="u">%</span></td></tr>
        <tr class="say${s.R.p > s.A.p ? ' up' : ''}"><td colspan="3">${diffTxt(s.R.p, s.A.p)}</td></tr></tbody>`
    : `<tbody><tr><th scope="row">${k}</th><td class="wait" colspan="2">${none}</td></tr><tr class="say"><td colspan="3"></td></tr></tbody>`).join("");
  $("stat").innerHTML = `<table class="rc"><caption class="vh">기간별 내 정답률과 ${LV} 평균</caption><colgroup><col class="c1"><col class="c2"><col></colgroup>
      <thead><tr><th scope="col"><span class="vh">기간</span></th><th scope="col" class="c-me">나</th><th scope="col" class="c-lv">${LV} 평균</th></tr></thead>${body}</table>
    ${M.month ? missBlock(`${M.monthLabel} 자주 틀린 단어`, M.month.ds) : ''}`;
}
//REC-JS-END

function renderSheet(){ if (isGraded(day)) renderGraded(API.result(day), false); else renderBlank(); }
// 다시 외울 단어 쪽지. 채점된 날에만 있다(채점 전에는 정답이 화면에 없다).
// 내가 쓴 답과 정답을 글자 단위로 맞대어(LCS) 다른 글자만 짚는다: 정답 쪽은 노란 형광펜, 내 답 쪽은 빨간 밑줄(채점 표시).
function lcsMarks(a, b){
  const A = [...a.toLowerCase()], B = [...b.toLowerCase()], m = A.length, n = B.length;
  const L = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i+1][j+1] + 1 : Math.max(L[i+1][j], L[i][j+1]);
  const ka = new Array(m).fill(false), kb = new Array(n).fill(false); let i = 0, j = 0;
  while (i < m && j < n){ if (A[i] === B[j]) { ka[i] = kb[j] = true; i++; j++; } else if (L[i+1][j] >= L[i][j+1]) i++; else j++; }
  return { ka, kb };
}
const markUp = (word, keep, tag) => { let out = "", run = ""; const chars = [...word];
  chars.forEach((ch, k) => { if (keep[k]) { if (run) { out += `<${tag}>${esc(run)}</${tag}>`; run = ""; } out += esc(ch); } else run += ch; });
  return out + (run ? `<${tag}>${esc(run)}</${tag}>` : ""); };
let peekOn = false;
function renderMemo(fade){
  const el = $("memo");
  if (!isGraded(day)) { el.hidden = true; el.innerHTML = ""; return; }
  const r = API.result(day), ws = r.wrongs, when = day === TODAY ? "오늘" : TV.label(day);
  el.hidden = false; el.classList.toggle("fade-in", !!fade);
  if (!ws.length) { el.innerHTML = `<div class="memo-h"><h3 id="memo-title">다시 외울 단어<span class="when">${when} 시험</span></h3></div><span class="clear">틀린 단어가 없어요${ULINE}</span>`; return; }
  const cards = ws.map(w => { const { ka, kb } = lcsMarks(w.wrote || "", w.ans);
    const right = w.wrote ? markUp(w.ans, kb, "mark") : esc(w.ans);
    const mine = w.wrote ? `<span>${markUp(w.wrote, ka, "u")}</span>` : `<i>빈칸으로 냈어요</i>`;
    return `<li class="wc"><div class="wc-top"><span class="right">${right}${peekOn ? `<button type="button" class="cover" aria-label="${w.no}번 정답 보기">눌러서 확인</button>` : ''}</span>${TVP.spk(w.ans, `${w.no}번 정답`)}</div>
      <div class="mine">${w.no}번 · 내가 쓴 답 ${mine}</div></li>`; }).join("");
  el.innerHTML = `<div class="memo-h"><h3 id="memo-title">다시 외울 단어 <b>${ws.length}개</b><span class="when">${when} 시험</span></h3>
      <button type="button" class="peek" id="peek" aria-pressed="${peekOn}">${peekOn ? '다 보기' : '가리고 외우기'}</button></div>
    <ul class="wcs">${cards}</ul>`;
  $("peek").onclick = () => { peekOn = !peekOn; renderMemo(false); $("peek").focus(); };
  el.querySelectorAll(".cover").forEach(b => b.onclick = () => { b.closest(".wc").classList.add("open"); });
}
// 오늘 할 공부 : 복습(오늘 차례인 단어 수) · 퀴즈(틀린 단어부터). 숫자는 practice.js 가 채점된 시험과 복습 기록으로 계산
const CB = done => `<svg viewBox="0 0 30 30" aria-hidden="true"><path class="sq" d="M4.2 5.1c7.3-.6 14.4-.9 21.6-.3.6 6.9.4 13.8-.2 20.7-7.1.5-14.3.6-21.4.1-.5-6.8-.6-13.6 0-20.5Z"/>${done ? '<path class="tk" d="M8.4 15.6c2 1.6 3.6 3.6 5 5.8 3.4-6 7.4-11.2 12.6-15.6"/>' : ''}</svg>`;
const GO = `<svg class="go" viewBox="0 0 22 16" aria-hidden="true"><path d="M2 8.3c5.8-.5 11.6-.2 17.4-.3"/><path d="M13.6 2.6 19.4 8l-5.8 5.4"/></svg>`;
function renderTodo(){
  const due = TVP.review.due().length, rDone = !due && TVP.review.reviewedToday(), qDone = TVP.quizDone(), qn = TVP.quizPool(10).length;
  $("todo").innerHTML = `<h2 class="todo-t" id="todo-title">오늘 할 공부</h2>
    <a class="tl${rDone ? ' done' : ''}" href="d2_review.html"><span class="cb">${CB(rDone)}</span><span class="tl-k">오늘 복습</span><span class="tl-v">${rDone ? '다 했어요' : due ? `단어 ${due}개` : '없어요'}</span>${GO}</a>
    ${qn ? `<a class="tl${qDone ? ' done' : ''}" href="d2_quiz.html"><span class="cb">${CB(qDone)}</span><span class="tl-k">단어 퀴즈</span><span class="tl-v">${qDone ? '한 번 더' : `${qn}문제`}</span>${GO}</a>` : ''}`;
}
function renderAll(smooth){ renderTop(); renderFlow(undefined, smooth); renderSheet(); renderMemo(false); renderStat(); renderTodo(); }

$("flow").onclick = e => { const b = e.target.closest(".day"); if (!b || busy) return; day = b.dataset.d; renderAll(true); };
$("logout").onclick = async () => { store.del("tv-auto"); try { await TVApi.signOut(); } catch (e) { /* 이 기기 세션만 지우면 됨 */ } location.href = "d2_login.html"; };
$("reset").onclick = () => { if (busy) return; store.del(KEY(TODAY)); day = TODAY; peekOn = false; renderAll(); };
renderAll();
// 실제 모드(카카오 로그인): 아이 이름 = my_children() · 점수 = my_results() · 레벨 평균 = level_average()
// 시트에는 정답 단어가 없어(학생이 쓴 답만) 문항별 정답 칸은 비어 있다 — 정답지 연결은 다음 단계.
const isoDay = (iso) => String(iso).slice(5, 7) + String(iso).slice(8, 10);      // 'YYYY-MM-DD' → 'MMDD'
function realStudent(kid, rows, avgRows){
  const byDay = new Map();
  rows.forEach(r => { const d = isoDay(r.test_date); if (!byDay.has(d)) byDay.set(d, []); byDay.get(d).push(r); });
  const history = [...byDay.keys()].sort((a, b) => [...byDay.get(a)][0].test_date.localeCompare([...byDay.get(b)][0].test_date));
  const last = byDay.get(history[history.length - 1])[0];
  // 서버는 그날 레벨 평균 %만 준다(합계 · 인원 없음) → 하루를 100문제 중 평균 % 로 놓고 기간은 날들의 평균
  const totals = new Map(avgRows.filter(a => a.avg_rate !== null && a.avg_rate !== undefined).map(a => [isoDay(a.test_date), { c: Number(a.avg_rate), q: 100 }]));
  const resultOf = (d) => { const rs = byDay.get(d); if (!rs) return null;
    // 같은 날 시험이 둘이면 합쳐서 한 장으로(번호는 이어 붙임)
    let base = 0; const items = [], wrongs = [];
    rs.forEach(r => { const q = r.correct + r.wrong, wa = new Map((r.wrong_answers || []).map(w => [w.no, w.wrote || ""]));
      for (let no = 1; no <= q; no++) { const ok = !wa.has(no) && !(wa.size < r.wrong && no > q - (r.wrong - wa.size));
        const it = { no: base + no, ans: "", wrote: ok ? "" : (wa.get(no) || ""), ok }; items.push(it); if (!ok) wrongs.push({ no: it.no, ans: "", wrote: it.wrote }); }
      base += q; });
    const q = items.length, correct = items.filter(i => i.ok).length;
    return { d, cls: rs[0].class_name, subject: rs.map(r => r.subject || "").filter(Boolean).join(" · "), teacher: "", name: kid.student_name,
      q, correct, wrong: q - correct, score: q ? Math.round(correct * 100 / q) : 0, wrongs, items }; };
  return { history, level: last.level || TV.levelOf(last.class_name),
    levelTotal: (d) => totals.get(d) || { c: 0, q: 0 },
    sheet: (d) => { const r = resultOf(d); return r && { d, cls: r.cls, subject: r.subject, teacher: "", q: r.q, words: r.items.map(i => ({ no: i.no, wrote: i.wrote })) }; },
    result: resultOf,
    fetchGrade: (d) => { const r = resultOf(d); return r ? Promise.resolve(r) : Promise.reject(new Error("no-result")); } };
}
TVApi.ready.then(async (mode) => {
  if (mode !== "real") return;
  let kids;
  try { kids = await TVApi.my_children(); }
  catch (e) { if (e && e.code === "auth_required") location.replace("d2_login.html"); return; }
  if (!kids.length) { location.replace("d2_link.html"); return; }
  const kid = kids[0];
  ME.display = kid.student_name;
  const note = document.querySelector(".note");
  try {
    const to = new Date(), from = new Date(to.getTime() - 120 * 864e5), ymd = (t) => t.toISOString().slice(0, 10);
    const rows = await TVApi.my_results(kid.roster_id, ymd(from), ymd(to));
    if (!rows.length) { renderTop(); if (note) note.firstChild.textContent = "아직 받은 시험 결과가 없어요 — 아래는 시안 데이터예요 "; return; }
    const lv = rows[rows.length - 1].level;
    const avg = lv ? await TVApi.level_average(lv, ymd(from), ymd(to)) : [];
    API = realStudent(kid, rows, avg);
    ME.name = kid.student_name; ME.cls = rows[rows.length - 1].class_name;
    TODAY = API.history[API.history.length - 1]; day = TODAY;
    renderAll();
    if (note) note.firstChild.textContent = "시험 결과는 매일 밤 학원 시트에서 옮겨 와요 ";
  } catch (e) {
    if (e && e.code === "auth_required") { location.replace("d2_login.html"); return; }
    renderTop(); if (note) note.firstChild.textContent = "시험 결과를 불러오지 못했어요 — 아래는 시안 데이터예요 ";
  }
});
