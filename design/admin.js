// 확인 관리(본원 직원용) — 데이터는 모두 api.js(TVApi)로만. 화면 상태는 이 파일 안에서만 바꾼다.
(function () {
  const A = window.TVApi;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pad2 = (n) => String(n).padStart(2, "0");
  const when = (iso) => { const d = new Date(iso); return `${d.getMonth() + 1}.${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
  const ago = (iso) => {
    const m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 6e4));
    return m < 1 ? "방금" : m < 60 ? `${m}분 전` : m < 1440 ? `${Math.floor(m / 60)}시간 전` : `${Math.floor(m / 1440)}일 전`;
  };
  let toastT = null;
  const toast = (msg) => { const t = $("toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 3200); };
  const busy = (b, on) => { if (on) b.setAttribute("aria-busy", "true"); else b.removeAttribute("aria-busy"); };

  // ── 탭(화살표 · Home · End) ─────────────────────────────────────────────
  const TABS = ["pending", "linked", "upload", "names"];
  function selectTab(name, focus) {
    TABS.forEach((n) => {
      const on = n === name, t = $("t-" + n);
      t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1; $("p-" + n).hidden = !on;
      if (on && focus) t.focus();
    });
    const u = new URL(location.href); u.searchParams.set("tab", name); history.replaceState(null, "", u);
    if (name === "linked") loadLinked();
    if (name === "upload") loadNow();
    if (name === "names") loadNames();
  }
  TABS.forEach((n, i) => {
    const t = $("t-" + n);
    t.onclick = () => selectTab(n);
    t.onkeydown = (e) => {
      const k = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key];
      if (k === undefined) return;
      e.preventDefault(); selectTab(TABS[(k + TABS.length) % TABS.length], true);
    };
  });

  // ── ① 확인 대기 ─────────────────────────────────────────────────────────
  const P = { list: [], cur: null, picked: new Set(), mode: "child", rejecting: false };

  async function loadPending(keepId) {
    try { P.list = await A.admin_pending_requests(); }
    catch (e) { $("queue").innerHTML = `<li class="empty err">목록을 불러오지 못했어요. 새로고침해 주세요.</li>`; return; }
    $("c-pending").textContent = P.list.length;
    $("q-sum").textContent = P.list.length ? `${P.list.length}건` : "";
    const next = P.list.find((x) => x.id === keepId) || P.list[0] || null;
    renderQueue(); pick(next ? next.id : null, false);
  }
  function renderQueue() {
    if (!P.list.length) {
      $("queue").innerHTML = `<li class="empty"><b>확인할 요청이 없어요</b>학부모가 연결을 시도했는데 명단과 맞지 않으면 여기에 쌓여요.</li>`;
      return;
    }
    $("queue").innerHTML = P.list.map((r) => `<li><button class="qi" type="button" data-id="${esc(r.id)}" aria-current="${P.cur && P.cur.id === r.id}">
      <b>${esc(r.guardian_name)} · ${esc(r.child_name)}</b><span class="t num" title="${esc(when(r.created_at))}">${esc(ago(r.created_at))}</span>
      <span class="p num">${esc(A.showPhone(r.phone))}</span></button></li>`).join("");
    $("queue").querySelectorAll(".qi").forEach((b) => (b.onclick = () => pick(b.dataset.id, true)));
  }
  function pick(id, userAction) {
    P.cur = P.list.find((x) => x.id === id) || null; P.picked = new Set(); P.mode = "child"; P.rejecting = false;
    $("queue").querySelectorAll(".qi").forEach((b) => b.setAttribute("aria-current", String(b.dataset.id === id)));
    $("md").classList.toggle("open", !!(P.cur && userAction));
    renderDetail();
    if (P.cur) search(P.cur.child_name);
    if (userAction && matchMedia("(max-width:900px)").matches) $("d-h").focus();
  }
  // 확인 대기 사유(서버 link_requests.reason — 관리자 화면에만 · 학부모에게는 보이지 않음)
  const REASON = {
    phone_not_in_roster: "명단에 없는 번호",
    phone_already_registered: "이미 등록된 번호",
    not_matched: "자녀 이름이 명단과 다름",
    blocked: "관리자가 막은 연결",
    limited: "시도 제한(같은 번호 · 이름 실패가 많음)",
  };
  const who = (r) => r.guardian_name || r.guardian_display_name || "보호자";
  function renderDetail() {
    const r = P.cur;
    if (!r) { $("detail").innerHTML = `<div class="empty"><b>모두 처리했어요</b>새 요청이 들어오면 왼쪽 목록에 보여요.</div>`; return; }
    $("detail").innerHTML = `
      <button class="btn quiet back" type="button" id="d-back">← 목록</button>
      <div class="d-top"><h2 id="d-h" tabindex="-1">${esc(who(r))} 님 요청</h2><span class="mute num">${esc(when(r.created_at))} · ${esc(ago(r.created_at))}</span></div>
      <dl class="req">
        ${r.reason ? `<div><dt>확인 사유</dt><dd>${esc(REASON[r.reason] || r.reason)}</dd></div>` : ""}
        ${r.reason === "phone_already_registered" ? `<div><dt>이미 등록된 번호</dt><dd>기존 계정: ${esc(r.existing_kakao_name || "–")}${r.existing_linked_at ? ` · ${esc(when(r.existing_linked_at))} 연결` : ""}</dd></div>` : ""}
        <div><dt>보호자 이름</dt><dd>${esc(r.guardian_name || "–")}</dd></div>
        <div><dt>전화</dt><dd class="num">${esc(A.showPhone(r.phone))}</dd></div>
        <div><dt>자녀 이름</dt><dd>${esc(r.child_name)}</dd></div>
        <div><dt>카카오 이름</dt><dd>${esc(r.guardian_display_name || "–")}</dd></div>
        <div><dt>접수 번호</dt><dd class="num">${esc(String(r.id).replace(/^q-/, "").slice(0, 8).toUpperCase())}</dd></div>
      </dl>
      <h3>명단에서 찾기</h3>
      <div class="find">
        <input type="search" id="d-q" aria-label="명단 검색" placeholder="학생 · 보호자 이름, 전화 뒷자리, 아카 번호">
        <div class="quick" role="group" aria-label="빠른 찾기">
          <button class="chip" type="button" data-m="child" aria-pressed="true">자녀 이름</button>
          <button class="chip" type="button" data-m="phone" aria-pressed="false">전화</button>
          <button class="chip" type="button" data-m="guardian" aria-pressed="false">보호자 이름</button>
        </div>
      </div>
      <div class="cands-wrap"><table class="tbl cands rt"><thead><tr><th scope="col"><span class="vh">고르기</span></th><th scope="col">학생</th><th scope="col">학교 · 학년 · 반</th><th scope="col">보호자</th><th scope="col">전화</th><th scope="col">아카 번호</th></tr></thead><tbody id="d-body"></tbody></table></div>
      <p class="find-note" id="d-note" aria-live="polite"></p>
      ${r.reason === "phone_already_registered" ? `<fieldset class="xfer"><legend>이 번호의 기존 계정</legend>
          <label><input type="radio" name="xfer" value="keep" checked> 둘 다 두기</label>
          <label><input type="radio" name="xfer" value="move"> 기존 계정 연결을 끊고 이 계정으로 넘기기</label>
        </fieldset>` : ""}
      <div class="do">
        <button class="btn" id="d-link" type="button" disabled>골라서 연결</button>
        <button class="btn ghost" id="d-rej" type="button">거절</button>
        <span class="hint">노란 칠 = 요청과 같음 · 「다름」 = 요청과 다름</span>
      </div>
      <div class="rej" id="d-rejbox" hidden>
        <fieldset><legend>거절 사유</legend>
          <label><input type="radio" name="why" value="명단에 없는 학생" checked> 명단에 없는 학생</label>
          <label><input type="radio" name="why" value="보호자 정보가 다름"> 보호자 정보가 다름</label>
          <label><input type="radio" name="why" value="본인 확인 안 됨"> 본인 확인 안 됨</label>
          <label><input type="radio" name="why" value="기타"> 기타</label>
        </fieldset>
        <input type="text" id="d-note2" placeholder="메모(선택) — 통화 내용 등" aria-label="거절 메모">
        <button class="btn cut sure" id="d-rejgo" type="button">거절 확정</button>
        <button class="btn quiet" id="d-rejno" type="button">취소</button>
      </div>`;
    $("d-back").onclick = () => { $("md").classList.remove("open"); const b = $("queue").querySelector(`[data-id="${CSS.escape(r.id)}"]`); if (b) b.focus(); };
    let t = null;
    $("d-q").oninput = () => { clearTimeout(t); setMode(null); t = setTimeout(() => search($("d-q").value), 200); };
    $("detail").querySelectorAll(".chip").forEach((c) => (c.onclick = () => {
      setMode(c.dataset.m);
      search({ child: r.child_name, phone: r.phone.slice(-4), guardian: r.guardian_name }[c.dataset.m]);
    }));
    $("d-link").onclick = resolveLink;
    $("d-rej").onclick = () => { $("d-rejbox").hidden = false; $("d-rejgo").focus(); };
    $("d-rejno").onclick = () => { $("d-rejbox").hidden = true; $("d-rej").focus(); };
    $("d-rejgo").onclick = resolveReject;
  }
  function setMode(m) { $("detail").querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.m === m))); }

  async function search(qv) {
    const r = P.cur; if (!r) return;
    if ($("d-q").value !== qv) $("d-q").value = qv;
    let rows;
    try { rows = await A.admin_search_roster(qv); }
    catch (e) { $("d-note").textContent = "명단을 찾지 못했어요. 다시 해 주세요."; return; }
    if (P.cur !== r) return;                              // 그사이 다른 요청을 골랐으면 버린다
    const same = (a, b) => A.normName(a) === A.normName(b);
    const cell = (v, ok, cls = "") => `<span class="${ok ? "m-ok" : "m-diff"} ${cls}">${esc(v)}</span>`;
    $("d-body").innerHTML = rows.map((x) => {
      const on = P.picked.has(x.id);
      return `<tr class="${on ? "picked" : ""} ${x.active ? "" : "off"}">
        <td><input type="checkbox" value="${esc(x.id)}" ${on ? "checked" : ""} aria-label="${esc(x.student_name)} 고르기" ${x.active ? "" : "disabled"}></td>
        <td class="who">${cell(x.student_name, same(x.student_name, r.child_name))}${x.active ? "" : ' <span class="pill off">빠짐</span>'}${x.linked_count ? ` <span class="pill">이미 연결 ${x.linked_count}</span>` : ""}</td>
        <td data-l="학교">${esc(x.school)} · ${esc(x.grade)} · <span class="num">${esc(x.class_name)}</span></td>
        <td data-l="보호자">${cell(x.guardian_name, same(x.guardian_name, r.guardian_name))}</td>
        <td data-l="전화">${cell(A.showPhone(x.guardian_phone), x.guardian_phone === r.phone, "num")}</td>
        <td data-l="아카" class="num">${esc(x.aca_student_no)}</td></tr>`;
    }).join("");
    $("d-body").querySelectorAll("input").forEach((i) => (i.onchange = () => {
      i.checked ? P.picked.add(i.value) : P.picked.delete(i.value);
      i.closest("tr").classList.toggle("picked", i.checked); updateLinkBtn();
    }));
    // 줄 아무 데나 눌러도 고르기(손이 닿는 면을 넓게)
    $("d-body").querySelectorAll("tr").forEach((tr) => (tr.onclick = (e) => {
      const i = tr.querySelector("input"); if (!i || i.disabled || e.target === i) return;
      i.checked = !i.checked; i.dispatchEvent(new Event("change"));
    }));
    $("d-note").textContent = !String(qv).trim() ? "찾을 말을 넣어 주세요."
      : rows.length ? `${rows.length}명 찾음` : "명단에서 찾지 못했어요. 전화나 보호자 이름으로도 찾아보세요.";
    updateLinkBtn();
  }
  function updateLinkBtn() {
    const n = P.picked.size;
    $("d-link").disabled = !n; $("d-link").textContent = n ? `골라서 연결 (${n}명)` : "골라서 연결";
  }
  async function resolveLink() {
    const r = P.cur, b = $("d-link"); if (!r || !P.picked.size || b.getAttribute("aria-busy")) return;
    busy(b, true);
    try {
      const move = (document.querySelector('input[name="xfer"]:checked') || {}).value === "move";
      const res = await A.admin_resolve_request(r.id, [...P.picked], true, "", move);
      if (!res.ok) throw new Error(res.error || "fail");
      toast(`${who(r)} 님 — ${P.picked.size}명 연결했어요.${res.transferred ? " 기존 계정 연결은 끊었어요." : ""}`);
      await loadPending(); refreshCounts();
    } catch (e) { busy(b, false); $("d-note").textContent = e.message === "already_decided" ? "다른 직원이 이미 처리한 요청이에요. 목록을 새로 불러왔어요." : "연결하지 못했어요. 다시 눌러 주세요."; if (e.message === "already_decided") loadPending(); }
  }
  async function resolveReject() {
    const r = P.cur, b = $("d-rejgo"); if (!r || b.getAttribute("aria-busy")) return;
    const why = (document.querySelector('input[name="why"]:checked') || {}).value || "기타";
    const memo = $("d-note2").value.trim();
    busy(b, true);
    try {
      const res = await A.admin_resolve_request(r.id, [], false, memo ? `${why} — ${memo}` : why);
      if (!res.ok) throw new Error(res.error || "fail");
      toast(`${who(r)} 님 요청을 거절했어요 (${why}).`);
      await loadPending();
    } catch (e) { busy(b, false); $("d-note").textContent = "거절하지 못했어요. 다시 눌러 주세요."; }
  }

  // ── ④ 못 맞춘 이름 — 같은 반 후보(가까운 까닭 순)에서 골라 name_map 에 고정(다음 날 같은 원문이면 자동) ──
  const WHY = { ko: "한글 이름 같음", en: "영문 이름 같음", hint: "「명단:」 메모와 같음", edit1: "영문 한 글자 다름", class: "같은 반" };
  async function loadNames() {
    let rows = [];
    try { rows = await A.admin_unmatched_names(); } catch (e) { $("n-sum").textContent = "불러오지 못했어요. 다시 눌러 주세요."; return; }
    $("c-names").textContent = rows.length;
    $("n-sum").textContent = rows.length ? `${rows.length}개 · 고르면 그 반 · 그 이름은 다음부터 자동` : "";
    $("n-empty").hidden = !!rows.length; $("n-empty").textContent = "못 맞춘 이름이 없어요.";
    $("n-body").innerHTML = rows.map((r, i) => `<tr data-i="${i}">
      <td>${esc(r.class_name)}</td>
      <td class="who"><b>${esc(r.sheet_name)}</b>${r.low_confidence ? ' <span class="pill off">판독 불확실</span>' : ""}</td>
      <td class="num">${r.rows_count}</td>
      <td class="num">${esc(String(r.last_date).slice(5, 10))}</td>
      <td><select aria-label="${esc(r.sheet_name)} 학생 고르기"><option value="">고르기</option>${(r.candidates || []).map((c) =>
        `<option value="${esc(c.roster_id)}">${esc(c.student_name)} (${esc(c.english_name || "–")}) · ${esc((c.class_names || []).join(", "))} · ${esc(WHY[c.why] || c.why)}</option>`).join("")}</select></td>
      <td><button class="btn" type="button" disabled>정하기</button></td></tr>`).join("");
    $("n-body").querySelectorAll("tr").forEach((tr) => {
      const r = rows[+tr.dataset.i], sel = tr.querySelector("select"), b = tr.querySelector("button");
      sel.onchange = () => { b.disabled = !sel.value; };
      b.onclick = async () => {
        if (!sel.value || b.getAttribute("aria-busy")) return;
        busy(b, true);
        try {
          const res = await A.admin_map_name(r.sheet_kind, r.class_name, r.sheet_name, sel.value);
          if (!res.ok) throw new Error(res.error || "fail");
          toast(`${r.sheet_name} → ${sel.options[sel.selectedIndex].text.split(" (")[0]} (${res.updated}줄)`);
          loadNames();
        } catch (e) { busy(b, false); $("n-sum").textContent = "정하지 못했어요. 다시 눌러 주세요."; }
      };
    });
  }

  // ── ② 연결된 학부모 ─────────────────────────────────────────────────────
  let lT = null;
  $("l-q").oninput = () => { clearTimeout(lT); lT = setTimeout(loadLinked, 200); };
  async function loadLinked() {
    let rows;
    try { rows = await A.admin_linked_list($("l-q").value); }
    catch (e) { $("l-body").innerHTML = ""; $("l-empty").hidden = false; $("l-empty").innerHTML = `<span class="err">목록을 불러오지 못했어요.</span>`; return; }
    const kakao = new Set(rows.map((x) => x.guardian_user_id)).size;
    $("l-sum").textContent = `학부모 ${kakao}명 · 학생 ${rows.length}명`;
    if (!$("l-q").value) $("c-linked").textContent = kakao;
    $("l-empty").hidden = !!rows.length;
    $("l-empty").innerHTML = $("l-q").value ? `<b>찾는 연결이 없어요</b>이름이나 전화 뒷자리 4개로 찾아보세요.` : `<b>아직 연결된 학부모가 없어요</b>학부모가 카카오로 들어와 우리 아이를 연결하면 여기에 보여요.`;
    $("l-body").innerHTML = rows.map((x) => `<tr data-g="${esc(x.guardian_user_id)}" data-r="${esc(x.roster_id)}">
      <td class="who c-full"><b>${esc(x.student_name)}${x.active ? "" : ' <span class="pill off">명단에서 빠짐</span>'}</b><small>${esc(x.school)} · ${esc(x.grade)} · ${esc(x.class_name)}</small></td>
      <td data-l="보호자">${esc(x.guardian_name)}</td>
      <td data-l="카카오">${esc(x.kakao_name)}</td>
      <td data-l="전화" class="num">${esc(A.showPhone(x.guardian_phone))}</td>
      <td><span class="pill ${x.linked_by === "admin" ? "admin" : ""}">${x.linked_by === "admin" ? "직원 확인" : "자동"}</span></td>
      <td data-l="연결" class="num">${esc(when(x.linked_at))}</td>
      <td class="c-act"><button class="btn cut sm" type="button" data-cut>끊기</button></td></tr>`).join("");
    $("l-body").querySelectorAll("[data-cut]").forEach((b) => (b.onclick = () => askCut(b)));
  }
  function askCut(b) {
    const td = b.parentElement, tr = td.parentElement, name = tr.querySelector(".who b").firstChild.textContent;
    td.innerHTML = `<span class="confirm">끊을까요? <button class="btn cut sure sm" type="button" data-yes>끊기</button><button class="btn quiet sm" type="button" data-no>취소</button></span>`;
    td.querySelector("[data-no]").onclick = () => { td.innerHTML = `<button class="btn cut sm" type="button" data-cut>끊기</button>`; td.querySelector("[data-cut]").onclick = () => askCut(td.querySelector("[data-cut]")); td.querySelector("[data-cut]").focus(); };
    td.querySelector("[data-yes]").onclick = async (e) => {
      busy(e.currentTarget, true);
      try { const r = await A.admin_unlink(tr.dataset.g, tr.dataset.r); if (!r.ok) throw new Error(); toast(`${name} 연결을 끊었어요.`); loadLinked(); }
      catch (err) { busy(e.currentTarget, false); toast("끊지 못했어요. 다시 눌러 주세요."); }
    };
    td.querySelector("[data-no]").focus();
  }

  // ── ③ 명단 올리기 ───────────────────────────────────────────────────────
  // 아카 내보내기 칸 이름이 정해지지 않아 흔한 이름을 모두 받는다(실제 파일을 받으면 여기만 고친다)
  const COLS = [
    ["aca_student_no", "학생 번호", ["원생번호", "학생번호", "회원번호", "번호", "학번"]],
    ["student_name", "학생 이름", ["원생명", "학생명", "학생이름", "이름", "성명"]],
    ["school", "학교", ["학교", "학교명"]],
    ["grade", "학년", ["학년"]],
    ["class_name", "반", ["반", "반명", "클래스", "수업반"]],
    ["guardian_name", "보호자 이름", ["보호자명", "보호자", "학부모", "학부모명", "학부모이름", "보호자이름"]],
    ["guardian_phone", "보호자 전화", ["보호자연락처", "학부모연락처", "보호자전화", "학부모전화", "보호자휴대폰", "학부모휴대폰", "연락처"]],
  ];
  const REQUIRED = ["aca_student_no", "student_name", "guardian_name", "guardian_phone"];
  const U = { rows: [], ok: [], file: "", active: 0 };

  async function loadNow() {
    try {
      const s = await A.admin_roster_status(); U.active = s.active;
      $("now").innerHTML = `<div><dt>지금 명단</dt><dd class="num">${s.active}명</dd></div>` +
        (s.last ? `<div><dt>마지막 올린 때</dt><dd class="num">${esc(when(s.last.at))}</dd></div><div><dt>그때</dt><dd class="num">${s.last.rows}줄 · 새로 ${s.last.inserted} · 고침 ${s.last.updated} · 빠짐 ${s.last.deactivated}</dd></div>` : `<div><dt>마지막 올린 때</dt><dd>아직 없음</dd></div>`);
    } catch (e) { $("now").innerHTML = `<div class="err">명단 상태를 불러오지 못했어요.</div>`; }
  }
  function parseCSV(text) {
    const out = []; let row = [], cur = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; continue; }
      if (c === '"') q = true; else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); out.push(row); row = []; cur = ""; }
      else cur += c;
    }
    if (cur || row.length) { row.push(cur); out.push(row); }
    return out.filter((r) => r.some((v) => v.trim()));
  }
  function readText(file) {
    return file.arrayBuffer().then((buf) => {
      const utf = new TextDecoder("utf-8").decode(buf).replace(/^﻿/, "");
      return utf.includes("�") ? new TextDecoder("euc-kr").decode(buf) : utf;   // 아카 CSV 가 EUC-KR 이면
    });
  }
  async function takeFile(file) {
    $("u-err").textContent = ""; $("res").hidden = true;
    if (!file) return;
    if (/\.xlsx?$/i.test(file.name)) {
      // 실제판: SheetJS 로 첫 시트를 읽는다. 시안은 예시 명단으로 보여 준다.
      return preview(A.demo.sampleFile(), file.name);
    }
    if (!/\.csv$/i.test(file.name)) { $("u-err").textContent = "CSV 나 엑셀 파일만 올릴 수 있어요."; return; }
    try { preview(await readText(file), file.name); }
    catch (e) { $("u-err").textContent = "파일을 읽지 못했어요. 아카에서 다시 내려받아 주세요."; }
  }
  function preview(text, name) {
    const grid = parseCSV(text);
    if (grid.length < 2) { $("u-err").textContent = "파일에 줄이 없어요."; return; }
    const head = grid[0].map((h) => h.replace(/\s+/g, ""));
    const idx = {}; COLS.forEach(([k, , al]) => { idx[k] = head.findIndex((h) => al.includes(h)); });
    const missing = REQUIRED.filter((k) => idx[k] < 0);
    $("pv-map").innerHTML = COLS.map(([k, label]) => idx[k] >= 0
      ? `<li>${esc(grid[0][idx[k]])} → ${label}</li>`
      : `<li class="${REQUIRED.includes(k) ? "miss" : ""}">${label} 칸 없음</li>`).join("");
    if (missing.length) {
      $("pv").hidden = false; $("pv-tbl").innerHTML = ""; $("pv-warn").innerHTML = "";
      $("pv-go").disabled = true; $("pv-hint").textContent = "";
      $("u-err").textContent = `꼭 있어야 할 칸이 없어요: ${missing.map((k) => COLS.find((c) => c[0] === k)[1]).join(", ")}. 아카 내보내기에서 이 칸을 넣어 주세요.`;
      return;
    }
    U.file = name;
    U.rows = grid.slice(1).map((r) => {
      const o = {}; COLS.forEach(([k]) => { o[k] = idx[k] >= 0 ? (r[idx[k]] || "").trim() : ""; });
      const p = []; if (!o.aca_student_no) p.push("학생 번호 없음"); if (!o.student_name) p.push("학생 이름 없음");
      if (!o.guardian_name) p.push("보호자 이름 없음"); if (!/^01\d{8,9}$/.test(A.normPhone(o.guardian_phone))) p.push("전화 자리 수");
      return Object.assign(o, { _bad: p });
    });
    const count = {}; U.rows.forEach((r) => { if (r.aca_student_no) count[r.aca_student_no] = (count[r.aca_student_no] || 0) + 1; });
    U.rows.forEach((r) => { if (count[r.aca_student_no] > 1) r._bad.push("학생 번호 겹침"); });   // 서버는 겹친 번호가 있으면 통째로 거절한다
    U.rows.sort((a, b) => (b._bad.length ? 1 : 0) - (a._bad.length ? 1 : 0));   // 확인 필요 줄을 맨 위로
    U.ok = U.rows.filter((r) => !r._bad.length);
    const bad = U.rows.length - U.ok.length;
    $("pv-file").textContent = `${name} · ${U.rows.length}줄`;
    $("pv-tbl").innerHTML = `<thead><tr><th scope="col">상태</th>${COLS.map(([, l]) => `<th scope="col">${l}</th>`).join("")}</tr></thead><tbody>` +
      U.rows.map((r) => `<tr class="${r._bad.length ? "bad" : ""}"><td>${r._bad.length ? `<span class="st">확인 필요 · ${esc(r._bad.join(", "))}</span>` : ""}</td>${COLS.map(([k]) => `<td class="${k === "guardian_phone" || k === "aca_student_no" ? "num" : ""}">${esc(r[k])}</td>`).join("")}</tr>`).join("") + "</tbody>";
    const thin = U.active && U.ok.length < U.active * 0.7;
    $("pv-warn").innerHTML = (bad ? `<div class="warn"><span><b>확인 필요 ${bad}줄은 이번에 바꾸지 않아요.</b> 지금 명단에 있는 학생이면 그대로 두고, 아카에서 고친 뒤 다시 올리면 들어가요.</span></div>` : "") +
      (thin ? `<div class="warn"><span><b>지금 명단(${U.active}명)보다 훨씬 적어요(${U.ok.length}명).</b> 파일에 없는 학생은 모두 「빠짐」이 돼요. 반 하나만 내려받은 파일이 아닌지 확인해 주세요.<label><input type="checkbox" id="pv-sure"> 전체 원생 명단이 맞아요</label></span></div>` : "");
    $("pv").hidden = false;
    $("pv-hint").textContent = `${U.ok.length}명 넣기 · 파일에 없는 학생은 「빠짐」으로 바뀌어요`;
    const sure = $("pv-sure");
    $("pv-go").disabled = !U.ok.length || !!sure;
    if (sure) sure.onchange = () => { $("pv-go").disabled = !sure.checked; };
    if (!document.documentElement.classList.contains("is-shot")) $("pv").scrollIntoView({ block: "nearest" });
  }
  $("pv-go").onclick = async () => {
    const b = $("pv-go"); if (b.getAttribute("aria-busy") || !U.ok.length) return;
    busy(b, true); b.textContent = "넣는 중";
    try {
      const rows = U.ok.map((r) => Object.fromEntries(COLS.map(([k]) => [k, k === "guardian_phone" ? A.normPhone(r[k]) : r[k]])));
      // 확인 필요 줄도 학생 번호가 있으면 keep 으로 보낸다 — 서버는 고치지도, 「빠짐」으로 돌리지도 않는다
      [...new Set(U.rows.filter((r) => r._bad.length && r.aca_student_no).map((r) => r.aca_student_no))].forEach((no) => rows.push({ aca_student_no: no, keep: true }));
      const sure = $("pv-sure");
      const res = await A.admin_import_roster(rows, false, !!(sure && sure.checked));
      if (res && res.ok === false) {
        $("u-err").textContent = res.error === "too_many_deactivations"
          ? `파일에 없는 학생이 너무 많아요(빠짐 ${res.deactivated}명 · 지금 ${res.active}명). 전체 원생 명단인지 확인해 주세요.`
          : "명단을 넣지 못했어요. 파일을 확인해 주세요.";
        return;
      }
      $("res-dl").innerHTML = `<div><dt>새로</dt><dd class="num">${res.inserted}</dd></div><div><dt>고침</dt><dd class="num">${res.updated}</dd></div><div><dt>빠짐</dt><dd class="num">${res.deactivated}</dd></div>${res.kept ? `<div><dt>그대로 둠</dt><dd class="num">${res.kept}</dd></div>` : ""}<div><dt>파일</dt><dd style="font-size:15px">${esc(U.file)}</dd></div>`;
      $("pv").hidden = true; $("res").hidden = false; $("file").value = "";
      toast("명단을 넣었어요."); loadNow();
    } catch (e) { $("u-err").textContent = (e && e.code === "invalid_input") ? "명단을 넣지 못했어요 — 학생 번호 겹침 · 빈 칸 · 전화 꼴을 확인해 주세요." : "명단을 넣지 못했어요. 다시 눌러 주세요."; }
    finally { busy(b, false); b.textContent = "명단에 넣기"; }
  };
  $("pv-cancel").onclick = () => { $("pv").hidden = true; $("file").value = ""; $("u-err").textContent = ""; $("drop").focus(); };
  $("file").onchange = () => takeFile($("file").files[0]);
  $("drop").tabIndex = 0;
  $("drop").onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("file").click(); } };
  ["dragenter", "dragover"].forEach((ev) => $("drop").addEventListener(ev, (e) => { e.preventDefault(); $("drop").classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => $("drop").addEventListener(ev, (e) => { e.preventDefault(); $("drop").classList.remove("over"); }));
  $("drop").addEventListener("drop", (e) => takeFile(e.dataTransfer.files[0]));
  // 창 아무 데나 떨어뜨려도 브라우저가 파일을 열어 버리지 않게
  ["dragover", "drop"].forEach((ev) => window.addEventListener(ev, (e) => { if (!$("drop").contains(e.target)) e.preventDefault(); }));

  // ── 시작 ────────────────────────────────────────────────────────────────
  async function refreshCounts() {
    try { const rows = await A.admin_linked_list(""); $("c-linked").textContent = new Set(rows.map((x) => x.guardian_user_id)).size; } catch (e) { $("c-linked").textContent = "–"; }
  }
  $("p-sample").onclick = () => { selectTab("upload"); preview(A.demo.sampleFile(), "아카_원생명단_예시.csv"); };
  $("p-reset").onclick = () => { A.demo.reset(); location.reload(); };

  const qs = new URLSearchParams(location.search), tab = TABS.includes(qs.get("tab")) ? qs.get("tab") : "pending";
  function start() {
    if (qs.has("demo")) { document.documentElement.classList.add("is-shot"); A.demo.reset(); }
    loadPending(); refreshCounts(); selectTab(tab);
    if (qs.get("demo") === "preview") setTimeout(() => preview(A.demo.sampleFile(), "아카_원생명단_예시.csv"), 250);
    if (qs.get("demo") === "result") setTimeout(() => { preview(A.demo.sampleFile(), "아카_원생명단_예시.csv"); $("pv-go").click(); }, 250);
    if (qs.get("demo") === "pick") setTimeout(() => { pick(P.list[0] && P.list[0].id, true); }, 500);
  }

  // ── 실제 모드 관문: 로그인 → 관리자 → 2단계 인증(TOTP · aal2) ────────────────
  const G = () => $("gate");
  function gateOn(on) {
    G().hidden = !on; document.querySelector(".tabs").hidden = on;
    if (on) TABS.forEach((n) => { $("p-" + n).hidden = true; });
  }
  function gateMsg(title, text, action) {
    gateOn(true);
    G().innerHTML = `<h2></h2><p></p>${action ? `<div class="row"><a class="btn" href="${action.href}">${esc(action.label)}</a></div>` : ""}`;
    G().querySelector("h2").textContent = title; G().querySelector("p").textContent = text;
  }
  function codeForm(factorId, done) {
    G().insertAdjacentHTML("beforeend", `<label for="g-code">인증 앱의 6자리</label>
      <div class="row"><input type="text" id="g-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" aria-describedby="g-msg"><button class="btn" id="g-go" type="button">확인</button></div>
      <p class="err" id="g-msg" role="alert"></p>`);
    const go = async () => {
      const b = $("g-go"); if (b.getAttribute("aria-busy")) return;
      const code = $("g-code").value.replace(/\D/g, "");
      if (code.length !== 6) { $("g-msg").textContent = "6자리 숫자를 넣어 주세요."; $("g-code").focus(); return; }
      busy(b, true); $("g-msg").textContent = "";
      try { await A.mfa.verify(factorId, code); done(); }
      catch (e) { busy(b, false); $("g-msg").textContent = (e && e.userMessage) || "확인하지 못했어요. 다시 해 주세요."; $("g-code").select(); }
    };
    $("g-go").onclick = go;
    $("g-code").onkeydown = (e) => { if (e.key === "Enter") go(); };
    $("g-code").focus();
  }
  function mfaGate() {
    return new Promise(async (resolve) => {
      gateOn(true);
      const done = async () => { try { await A.admin_roster_status(); gateOn(false); resolve(true); } catch (e) { gateMsg("열지 못했어요", (e && e.userMessage) || "잠시 뒤 다시 해 주세요."); resolve(false); } };
      try {
        const lv = await A.mfa.level();
        if (lv.factorId) {
          G().innerHTML = `<h2>2단계 확인</h2><p>휴대폰 인증 앱(Google Authenticator 등)에 보이는 「TeensVoca」 6자리를 넣어 주세요.</p>`;
          codeForm(lv.factorId, done);
          return;
        }
        const en = await A.mfa.enroll();
        G().innerHTML = `<h2>인증 앱 등록 (처음 한 번)</h2>
          <ol><li>휴대폰에서 인증 앱(Google Authenticator · Microsoft Authenticator 등)을 엽니다.</li><li>아래 QR 을 찍어 계정을 더합니다.</li><li>앱에 뜬 6자리를 넣습니다.</li></ol>
          <img class="qr" id="g-qr" alt="인증 앱 등록용 QR"><p class="key">QR 을 못 찍으면 이 키를 앱에 직접 넣으세요: <span id="g-key"></span></p>`;
        $("g-qr").src = en.qr; $("g-key").textContent = en.secret;
        codeForm(en.factorId, done);
      } catch (e) { gateMsg("2단계 확인을 시작하지 못했어요", (e && e.userMessage) || "잠시 뒤 다시 해 주세요.", { href: "d2_admin.html", label: "다시 하기" }); resolve(false); }
    });
  }
  // 관리자 카카오 로그인 — 돌아오는 곳 = 이 화면(d2_admin.html)
  async function kakaoAdminLogin(btn) {
    if (btn.getAttribute("aria-busy")) return;
    busy(btn, true); btn.textContent = "카카오로 이동 중";
    try { await A.signInWithKakao("d2_admin.html"); }
    catch (e) { busy(btn, false); btn.textContent = "카카오로 관리자 로그인"; toast((e && e.userMessage) || "카카오 로그인을 마치지 못했어요. 다시 눌러 주세요."); }
  }
  function loginGate(text) {
    gateMsg("로그인이 필요해요", text);
    G().insertAdjacentHTML("beforeend", `<div class="row"><button class="btn" id="g-kakao" type="button">카카오로 관리자 로그인</button></div>`);
    $("g-kakao").onclick = () => kakaoAdminLogin($("g-kakao"));
    $("g-kakao").focus();
  }
  async function gate() {
    document.querySelectorAll(".proto").forEach((x) => { x.style.display = "none"; });
    document.querySelector(".queue-h span").textContent = "먼저 들어온 순";
    const me = A.getSession();
    if (!me) { loginGate(A.authError() ? "카카오 로그인을 마치지 못했어요. 다시 눌러 주세요." : "카카오로 로그인한 관리자만 쓸 수 있어요."); return false; }
    document.querySelector(".bar .nm").textContent = `본원 · ${me.display_name}`;
    const out = document.querySelector(".bar .me a");
    out.onclick = async (e) => { e.preventDefault(); try { await A.signOut(); } finally { location.href = "d2_login.html"; } };
    try { await A.admin_roster_status(); return true; }
    catch (e) {
      const code = e && e.code;
      if (code === "mfa_required") return mfaGate();
      if (code === "forbidden" || code === "kakao_required") { gateMsg("관리자만 볼 수 있어요", "이 카카오 계정은 관리자로 등록되어 있지 않아요. 본원에 관리자 등록을 요청해 주세요."); return false; }
      if (code === "auth_required") { loginGate("로그인이 풀렸어요. 다시 로그인해 주세요."); return false; }
      gateMsg("불러오지 못했어요", (e && e.userMessage) || "잠시 뒤 다시 해 주세요.", { href: "d2_admin.html", label: "다시 하기" });
      return false;
    }
  }
  A.ready.then(async (mode) => {
    if (mode === "real") { if (!(await gate())) return; }
    else if (!qs.has("demo")) {
      // 시안으로 열린 상태(로그인 안 함) — 실제 관리자는 여기서 카카오로 들어온다
      const b = document.createElement("button");
      b.type = "button"; b.className = "btn ghost sm"; b.textContent = "카카오로 관리자 로그인";
      b.onclick = () => kakaoAdminLogin(b);
      document.querySelector(".bar .me").prepend(b);
      if (A.authError()) toast("카카오 로그인을 마치지 못했어요. 다시 눌러 주세요.");
    }
    start();
  });
})();
