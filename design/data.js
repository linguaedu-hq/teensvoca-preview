// 시안용 가짜 데이터 — 실제 시트(초등 단어시험 Sheet)의 날짜 탭 꼴을 따름: Class · Subject · Name · Correct · Wrong · Score · Wrong Answers
// 학생 이름은 지어낸 것. 실제 연결은 다음 단계(매일 갱신)에서.
window.TV = (function () {
  const days = ["0928", "0929", "0930", "1001", "1002", "1006", "1007", "1008", "1012", "1013", "1014"];
  const classes = [
    { c: "LIV1-4", s: "LANGUAGE ARTS", q: 15, t: "Ashley" },
    { c: "LIV2P-1", s: "LANGUAGE ARTS", q: 20, t: "Grace" },
    { c: "202-11", s: "READING", q: 20, t: "Hedy" },
    { c: "Apex2-12", s: "SCIENCE", q: 20, t: "Anna" },
    { c: "PYALE-1", s: "SOCIAL STUDIES", q: 10, t: "Ashley" },
  ];
  const names = ["Mia", "Leo", "Ella", "Noah", "Ruby", "Theo", "Luna", "Ian", "Chloe", "Owen", "Hazel", "Jude", "Ivy", "Finn", "Nora", "Eli", "Zoe", "Max", "Lily", "Sam"];
  const words = {
    "LANGUAGE ARTS": [["greeting", "geeting"], ["important", "infortant"], ["clean", "cleam"], ["everything", "all thing"], ["invisible", "inbisible"], ["graceful", "gracefal"], ["vogue", "vouge"], ["traveler", "travelese"]],
    READING: [["decoration", "decoreshon"], ["sculpture", "sculipture"], ["guilty", "gueilcit"], ["festival", "festivel"], ["museum", "musium"]],
    SCIENCE: [["separate", "sprate"], ["mixture", "mixtrue"], ["predator", "predetor"], ["shield", "sheild"], ["camouflage", "cammouflage"], ["safety label", "safely label"]],
    "SOCIAL STUDIES": [["humidity", "humity"], ["temperature", "tomerature"], ["elevation", "elevaton"], ["precipitation", "preperuvuti"], ["average", "avadio"]],
  };
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const results = {};
  days.forEach((d) => {
    results[d] = [];
    classes.forEach((k, ci) => {
      const n = 4 + ((ci + d.length) % 3);
      for (let i = 0; i < n; i++) {
        const nm = names[(ci * 4 + i) % names.length];
        const base = 0.55 + rnd() * 0.45;
        let correct = Math.min(k.q, Math.round(k.q * base));
        if (rnd() > 0.82) correct = k.q;
        const wrongN = k.q - correct;
        const pool = words[k.s];
        // 문항마다 정답 단어(시안용 — 실제는 답안지에서)
        const key = Array.from({ length: k.q }, (_, j) => pool[(j + ci) % pool.length]);
        const wrong = [];
        const used = new Set();
        for (let w = 0; w < wrongN; w++) {
          let no;
          do { no = 1 + Math.floor(rnd() * k.q); } while (used.has(no));
          used.add(no);
          const pair = key[no - 1];
          wrong.push({ no, ans: pair[0], wrote: rnd() > 0.35 ? pair[1] : "" });
        }
        wrong.sort((a, b) => a.no - b.no);
        const items = key.map((pair, j) => { const w = wrong.find(x => x.no === j + 1); return { no: j + 1, ans: pair[0], wrote: w ? w.wrote : pair[0], ok: !w }; });
        results[d].push({ cls: k.c, subject: k.s, teacher: k.t, name: nm, q: k.q, correct, wrong: wrongN, score: Math.round((correct / k.q) * 100), wrongs: wrong, items });
      }
    });
  });
  const label = (d) => `${+d.slice(0, 2)}월 ${+d.slice(2)}일`;
  const avg = (rows) => Math.round(rows.reduce((a, r) => a + r.score, 0) / (rows.length || 1));

  // 학생 한 명 창구(D안). 실제판은 서버가 로그인한 학생 것만, 그리고
  // 채점 전에는 학생이 쓴 단어만 내려주고 채점 결과는 「채점하기」를 눌렀을 때 따로 내려준다.
  // 시안은 같은 꼴을 흉내 낸다: sheet() 에는 정답·맞음 여부가 없다.
  const copy = (o) => JSON.parse(JSON.stringify(o));

  // 레벨 = 반 이름에서 「-」 앞부분, 대소문자 무시(대표 10-14): LIV1-1~LIV1-4 → LIV1 · LIV2P-1 → LIV2P(LIV2 와 다른 레벨) · liv1-1 → LIV1
  const levelOf = (cls) => String(cls).trim().split("-")[0].toUpperCase();
  // 같은 레벨의 다른 반(가짜, 반마다 5명). results·classes 와 위 난수 순서는 건드리지 않는다(다른 시안·Mia 점수 유지).
  // 밖으로는 레벨별 합계(맞힌 문제 수·전체 문제 수)만 낸다. 다른 학생 이름·점수는 내보내지 않는다.
  let seed2 = 101;
  const rnd2 = () => ((seed2 = (seed2 * 9301 + 49297) % 233280) / 233280);
  const levelTotals = {};
  days.forEach((d) => {
    const t = (levelTotals[d] = {});
    const add = (lv, c, q) => { const x = (t[lv] = t[lv] || { c: 0, q: 0 }); x.c += c; x.q += q; };
    results[d].forEach((r) => add(levelOf(r.cls), r.correct, r.q));
    classes.forEach((k) => {
      for (let sib = 0; sib < 3; sib++) for (let i = 0; i < 5; i++) {
        const c = Math.min(k.q, Math.round(k.q * (0.5 + rnd2() * 0.45)));
        add(levelOf(k.c), c, k.q);
      }
    });
  });

  function student(name, cls) {
    const find = (d) => (results[d] || []).find((x) => x.name === name && x.cls === cls);
    const history = days.filter((d) => find(d));
    const lv = levelOf(cls);
    return {
      history,
      level: lv,
      // 같은 레벨 전체(그날 시험 본 모든 반) 합계 — 숫자 하나로만 쓴다
      levelTotal(d) { const x = (levelTotals[d] || {})[lv]; return x ? { c: x.c, q: x.q } : { c: 0, q: 0 }; },
      sheet(d) {
        const r = find(d);
        if (!r) return null;
        return { d, cls: r.cls, subject: r.subject, teacher: r.teacher, q: r.q,
          words: r.items.map((it) => ({ no: it.no, wrote: it.wrote })) };
      },
      // 이미 채점된(고정된) 날의 결과
      result(d) { const r = find(d); return r ? Object.assign(copy(r), { d }) : null; },
      // 「채점하기」: 채점된 결과를 불러온다(시안: 약간 늦게 도착)
      fetchGrade(d, delayMs = 450) {
        return new Promise((resolve, reject) => {
          setTimeout(() => { const r = find(d); r ? resolve(Object.assign(copy(r), { d })) : reject(new Error("no-result")); }, delayMs);
        });
      },
    };
  }
  return { days, classes, results, label, avg, today: days[days.length - 1], student, levelOf };
})();
