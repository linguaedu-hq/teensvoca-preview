// 단어 퀴즈 · 복습 · 발음 듣기 공통(시안). data.js 다음에 불러온다.
// 시안은 학생 한 명(Mia)과 가짜 데이터. 실제판은 서버가 로그인한 학생 것만 내려준다.
window.TVP = (function () {
  // 대시보드에서 고른 아이(형제) — tv-child-me = { roster_id, name, cls, display }. 없으면 시안 학생 Mia.
  // 기록 열쇠(채점 · 복습 · 퀴즈)는 아이마다 따로. 시안 데이터에 없는 아이(실제 학생)는 단어 묶음만 Mia 것을 빌려 쓴다.
  const picked = (() => { try { const v = JSON.parse(localStorage.getItem("tv-child-me")); return v && v.name && v.cls ? v : null; } catch (e) { return null; } })();
  const ME = picked ? { name: picked.name, cls: picked.cls, display: picked.display || picked.name } : { name: "Mia", cls: "LIV1-4" };
  const own = TV.student(ME.name, ME.cls);
  const API = own.history.length ? own : TV.student("Mia", "LIV1-4");
  const TODAY = API.history[API.history.length - 1];
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const KEY = {
    graded: (d) => `tv-graded-${ME.cls}-${ME.name}-${d}`,     // 대시보드와 같은 열쇠(채점 고정)
    log: `tv-review-log-${ME.cls}-${ME.name}`,
    quizDone: (d) => `tv-quiz-done-${ME.cls}-${ME.name}-${d}`,
  };
  const isGraded = (d) => d !== TODAY || store.get(KEY.graded(d)) === "1";

  // ── 날짜(시안 데이터는 2026년, MMDD) ──
  const dateOf = (d) => new Date(2026, +d.slice(0, 2) - 1, +d.slice(2));
  const fmt = (t) => String(t.getMonth() + 1).padStart(2, "0") + String(t.getDate()).padStart(2, "0");
  const addDays = (d, n) => { const t = dateOf(d); t.setDate(t.getDate() + n); return fmt(t); };
  const daysBetween = (a, b) => Math.round((dateOf(b) - dateOf(a)) / 864e5);

  // ── 손그림 표시(대시보드 시험지와 같은 손) ──
  function rnd(seed) { let s = seed * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); }
  const hash = (w) => [...String(w)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 100003, 7);
  function handCircle(seed, w, h, turns = 1.12) {
    const r = rnd(seed), cx = w / 2, cy = h / 2, pts = [], n = 10, a0 = -2.4 + r() * 0.4;
    for (let i = 0; i <= n; i++) { const a = a0 + (Math.PI * 2 * turns) * i / n, k = 1 + (r() - 0.5) * 0.14 - (i / n) * 0.05;
      pts.push([cx + Math.cos(a) * (w / 2 - 3) * k, cy + Math.sin(a) * (h / 2 - 3) * k]); }
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`; }
    return d;
  }
  function handSlash(seed) { const r = rnd(seed); return `M${(5 + r() * 4).toFixed(1)} ${(34 + r() * 3).toFixed(1)} Q${(20 + r() * 4).toFixed(1)} ${(22 - r() * 4).toFixed(1)} ${(40 + r() * 3).toFixed(1)} ${(3 + r() * 3).toFixed(1)}`; }
  const markSvg = (ok, seed) => `<svg class="mark" viewBox="0 0 46 38" aria-hidden="true"><path pathLength="1" d="${ok ? handCircle(seed, 46, 38) : handSlash(seed)}"/></svg>`;

  // 내가 쓴 답과 정답을 글자 단위로 맞대어(LCS) 다른 글자만 짚는다
  function lcsMarks(a, b) {
    const A = [...String(a).toLowerCase()], B = [...String(b).toLowerCase()], m = A.length, n = B.length;
    const L = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const ka = new Array(m).fill(false), kb = new Array(n).fill(false); let i = 0, j = 0;
    while (i < m && j < n) { if (A[i] === B[j]) { ka[i] = kb[j] = true; i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++; }
    return { ka, kb };
  }
  const markUp = (word, keep, tag) => { let out = "", run = "";
    [...word].forEach((ch, k) => { if (keep[k]) { if (run) { out += `<${tag}>${esc(run)}</${tag}>`; run = ""; } out += esc(ch); } else run += ch; });
    return out + (run ? `<${tag}>${esc(run)}</${tag}>` : ""); };

  // ── 발음 듣기 : 브라우저 내장 음성(en-US, 조금 느리게). 목소리가 없으면 단추를 숨기고, 그 밖의 실패는 조용히 넘긴다 ──
  const tts = (function () {
    const ss = window.speechSynthesis;
    const ok = !!ss && typeof window.SpeechSynthesisUtterance === "function";
    let voice = null, none = false, current = null;
    const LIKE = /(Samantha|Aria|Jenny|Ava|Allison|Google US English|Natural)/i;
    function pick() {
      if (!ok) return;
      let vs = [];
      try { vs = ss.getVoices() || []; } catch (e) { vs = []; }
      if (!vs.length) return;                                   // 아직 목록을 못 받음 : lang 만 걸고 시도한다
      const us = vs.filter((v) => /^en[-_]US/i.test(v.lang)), en = vs.filter((v) => /^en/i.test(v.lang));
      voice = us.find((v) => LIKE.test(v.name)) || us.find((v) => v.localService) || us[0] || en[0] || null;
      none = !voice;
      document.documentElement.classList.toggle("no-tts", none);
    }
    if (!ok) document.documentElement.classList.add("no-tts");
    else { pick(); try { ss.addEventListener("voiceschanged", pick); } catch (e) {} }
    function speak(text, opt = {}) {
      if (!ok || none || !text) return false;
      try {
        ss.cancel();
        const u = new SpeechSynthesisUtterance(String(text));
        u.lang = "en-US"; if (voice) u.voice = voice;
        u.rate = opt.slow ? 0.6 : 0.85; u.pitch = 1;
        const btn = opt.btn;
        if (current && current !== btn) current.classList.remove("on");
        if (btn) { btn.classList.add("on"); current = btn; const off = () => btn.classList.remove("on"); u.onend = off; u.onerror = off; setTimeout(off, 4000); }
        ss.speak(u);
        return true;
      } catch (e) { return false; }
    }
    return { speak, available: () => ok && !none };
  })();
  // 듣기 단추 : 어느 화면이든 <button class="spk" data-say="word"> 하나로
  const SPK = `<svg viewBox="0 0 28 24" aria-hidden="true"><path class="sb" d="M3.4 9.2c1.6-.2 3.3-.1 4.8-.3 1.9-1.6 3.6-3.4 5.6-4.7.4 4.6.5 9.4.1 14.1-2-1.2-3.8-2.9-5.7-4.4-1.6-.1-3.2.1-4.8-.2-.4-1.5-.4-3 0-4.5Z"/><path class="w1" d="M17.6 8.6c1.3 1.9 1.3 4.6-.1 6.6"/><path class="w2" d="M20.9 5.6c2.6 3.7 2.6 9.2-.1 12.7"/></svg>`;
  const spk = (word, label, cls = "") => `<button type="button" class="spk${cls ? " " + cls : ""}" data-say="${esc(word)}" aria-label="${esc(label || word)} 소리 듣기">${SPK}</button>`;
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest(".spk");
    if (!b) return;
    tts.speak(b.dataset.say, { slow: b.dataset.slow === "1", btn: b });
  });

  // ── 복습 기록 ──
  // 시안은 이 기기 localStorage 에 둔다. 실제로는 Supabase review_log 표(학생 id · 단어 · 날짜 · 맞음 · 출처)에 두고 RLS 로 본인 것만 읽는다.
  const readLog = () => { try { const v = JSON.parse(store.get(KEY.log) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  const writeLog = (log) => store.set(KEY.log, JSON.stringify(log));
  function addLog(entry) { writeLog([...readLog(), { w: entry.w, d: entry.d || TODAY, ok: !!entry.ok, src: entry.src || "review" }]); }

  // 상자 세 칸(라이트너). 시험·퀴즈에서 틀린 단어 = 1칸, 그날부터 복습. 복습에서 틀리면 1칸 · 다음 날 다시.
  // 그날 차례인 단어를 맞히면 다음 칸 : 2칸 = 3일 뒤 · 3칸 = 7일 뒤. 3칸에서 맞히면 다 외움(빠짐).
  // 차례가 아닌 날 맞힌 것은 칸을 올리지 않는다(몰아서 외우기 막기).
  const GAP = { 1: 1, 2: 3, 3: 7 };
  function apply(state, w, d, ok, src) {
    const cur = state[w];
    if (!ok) return { ...state, [w]: { w, box: 1, due: addDays(d, src === "review" ? GAP[1] : 0), miss: ((cur && cur.miss) || 0) + 1, done: false } };
    if (!cur || cur.done || cur.due > d) return state;
    const box = cur.box + 1;
    return { ...state, [w]: box > 3 ? { ...cur, box: 4, due: null, done: true, doneOn: d } : { ...cur, box, due: addDays(d, GAP[box]) } };
  }
  // 채점된 시험(그날 한 번이라도 틀리면 틀림) → 그다음 복습·퀴즈 기록 순서로 다시 계산
  function testEvents() {
    const ev = [];
    API.history.filter(isGraded).forEach((d) => {
      const by = {};
      API.result(d).items.forEach((it) => { by[it.ans] = by[it.ans] === false ? false : it.ok; });
      Object.entries(by).forEach(([w, ok]) => ev.push({ w, d, ok, src: "test" }));
    });
    return ev;
  }
  function reviewState() {
    const log = readLog().map((e, i) => ({ ...e, i }));
    const ev = [...testEvents().map((e, i) => ({ ...e, i, t: 0 })), ...log.map((e) => ({ ...e, t: 1 }))]
      .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.t - b.t || a.i - b.i));
    return ev.reduce((s, e) => apply(s, e.w, e.d, e.ok, e.src), {});
  }
  const dueToday = (state = reviewState()) => Object.values(state).filter((x) => !x.done && x.due <= TODAY)
    .sort((a, b) => a.box - b.box || (a.due < b.due ? -1 : a.due > b.due ? 1 : 0) || b.miss - a.miss);
  const reviewedToday = () => readLog().some((e) => e.d === TODAY && e.src === "review");
  function nextDue(state = reviewState()) {
    const later = Object.values(state).filter((x) => !x.done && x.due > TODAY).map((x) => x.due).sort();
    if (!later.length) return null;
    return { d: later[0], n: later.filter((d) => d === later[0]).length };
  }
  const boxCounts = (state = reviewState()) => Object.values(state).reduce((a, x) => { a[x.done ? 4 : x.box] += 1; return a; }, { 1: 0, 2: 0, 3: 0, 4: 0 });

  // ── 단어장 : 채점된 시험에서만(채점 전 시험의 정답은 쓰지 않는다) ──
  function bank() {
    const m = {};
    API.history.filter(isGraded).forEach((d) => API.result(d).items.forEach((it) => {
      const x = (m[it.ans] = m[it.ans] || { w: it.ans, seen: [], wrong: 0, wrote: [] });
      if (!x.seen.includes(d)) x.seen.push(d);
      if (!it.ok) { x.wrong += 1; if (it.wrote && norm(it.wrote) !== norm(it.ans)) x.wrote.push({ d, s: it.wrote }); }
    }));
    return m;
  }
  const lastMiss = (b, w) => { const x = b[w]; return x && x.wrote.length ? x.wrote[x.wrote.length - 1].s : ""; };
  // 퀴즈 범위 : 틀린 단어 먼저(복습 차례 → 아직 칸에 있는 단어 → 많이 틀린 단어) + 최근 시험 단어
  function quizPool(max = 10) {
    const b = bank(), st = reviewState(), out = [];
    const push = (w) => { if (w && b[w] && !out.includes(w) && out.length < max) out.push(w); };
    dueToday(st).forEach((x) => push(x.w));
    Object.values(st).filter((x) => !x.done).sort((a, c) => a.box - c.box || c.miss - a.miss).forEach((x) => push(x.w));
    Object.values(b).filter((x) => x.wrong).sort((a, c) => c.wrong - a.wrong).forEach((x) => push(x.w));
    const graded = API.history.filter(isGraded);
    for (let k = graded.length - 1; k >= 0 && out.length < max; k--) API.result(graded[k]).items.forEach((it) => push(it.ans));
    return out.map((w) => ({ w, miss: lastMiss(b, w), wrong: b[w].wrong, fromReview: !!(st[w] && !st[w].done) }));
  }

  // ── 문제 재료(뜻 데이터가 없으므로 철자만) ──
  const VOW = { a: "e", e: "i", i: "e", o: "u", u: "o" };
  // 그럴듯한 틀린 철자 : 아이가 실제로 쓴 답을 먼저, 모자라면 글자 바꾸기로 만든다
  function misspell(w, need, own = []) {
    const r = rnd(hash(w)), out = [], L = [...w];
    const okWord = (s) => s && norm(s) !== norm(w) && !out.some((o) => norm(o) === norm(s)) && /^[a-z ]+$/i.test(s) && s.length > 1;
    own.forEach((s) => { if (out.length < need && okWord(s)) out.push(s.toLowerCase()); });
    const ops = [
      () => { const v = L.map((c, i) => (VOW[c] && i > 0 ? i : -1)).filter((i) => i > 0); if (!v.length) return ""; const i = v[Math.floor(r() * v.length)]; const c = [...L]; c[i] = VOW[c[i]]; return c.join(""); },
      () => { const c = [...L]; for (let i = 1; i < c.length - 1; i++) if (c[i] === c[i + 1]) { c.splice(i, 1); return c.join(""); } const i = 1 + Math.floor(r() * (c.length - 2)); if (/[bcdfglmnprst]/.test(c[i])) { c.splice(i, 0, c[i]); return c.join(""); } return ""; },
      () => { const c = [...L]; const i = 1 + Math.floor(r() * (c.length - 3)); if (c[i] === " " || c[i + 1] === " " || c[i] === c[i + 1]) return ""; [c[i], c[i + 1]] = [c[i + 1], c[i]]; return c.join(""); },
      () => (w.includes("ie") ? w.replace("ie", "ei") : w.includes("ei") ? w.replace("ei", "ie") : ""),
      () => { const v = L.map((c, i) => (VOW[c] && i > 0 && i < L.length - 1 ? i : -1)).filter((i) => i > 0); if (!v.length) return ""; const c = [...L]; c.splice(v[Math.floor(r() * v.length)], 1); return c.join(""); },
    ];
    for (let k = 0; k < 40 && out.length < need; k++) { const s = ops[k % ops.length](); if (okWord(s)) out.push(s); }
    return out;
  }
  // 빠진 글자 : 아이가 틀렸던 글자 자리를 먼저 비운다. 없으면 모음.
  const NEAR = { a: "e", e: "i", i: "e", o: "u", u: "a", c: "k", k: "c", s: "c", f: "p", p: "f", b: "v", v: "b", g: "j", r: "l", l: "r", m: "n", n: "m", t: "d", d: "t", y: "i", w: "u", h: "g", j: "g", q: "k", x: "z", z: "s" };
  function gaps(w, miss) {
    const L = [...w.toLowerCase()], max = L.length >= 9 ? 3 : 2;
    let pos = [];
    if (miss) { const { kb } = lcsMarks(miss, w); pos = kb.map((k, i) => (!k && L[i] !== " " ? i : -1)).filter((i) => i >= 0); }
    if (!pos.length) pos = L.map((c, i) => (VOW[c] ? i : -1)).filter((i) => i >= 0);
    if (!pos.length) pos = [1];
    const r = rnd(hash(w) + 3);
    while (pos.length > max) pos.splice(Math.floor(r() * pos.length), 1);
    pos.sort((a, b) => a - b);
    const want = pos.map((i) => L[i]);
    const extra = [];
    want.forEach((c) => { const n = NEAR[c] || "e"; if (!want.includes(n) && !extra.includes(n)) extra.push(n); });
    "aeiourstln".split("").forEach((c) => { if (want.length + extra.length < 6 && !want.includes(c) && !extra.includes(c)) extra.push(c); });
    const tiles = [...want, ...extra.slice(0, Math.max(2, 6 - want.length))];
    for (let i = tiles.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [tiles[i], tiles[j]] = [tiles[j], tiles[i]]; }
    return { pos, want, tiles };
  }

  return { ME, API, TODAY, store, esc, norm, reduced, KEY, isGraded, dateOf, addDays, daysBetween, rnd, hash,
    handCircle, handSlash, markSvg, lcsMarks, markUp, tts, spk,
    review: { state: reviewState, due: dueToday, next: nextDue, counts: boxCounts, add: addLog, reviewedToday, clear: () => store.del(KEY.log), GAP },
    bank, lastMiss, quizPool, misspell, gaps,
    quizDone: () => store.get(KEY.quizDone(TODAY)) === "1", setQuizDone: () => store.set(KEY.quizDone(TODAY), "1"),
    clearQuiz: () => store.del(KEY.quizDone(TODAY)) };
})();
