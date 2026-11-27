// 글이 한 줄씩 떠오르게
const io = new IntersectionObserver((ents) => {
  ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { rootMargin: '0px 0px -12% 0px' });
document.querySelectorAll('.r').forEach((el) => io.observe(el));

// 지원서 제출
const form = document.getElementById('form');
const status = form.querySelector('.status');
const btn = form.querySelector('button');
const cfg = window.SYAN_CONFIG || {};

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!form.checkValidity()) { form.reportValidity(); return; }
  const data = Object.fromEntries(new FormData(form));
  if (data._gotcha) return;
  delete data._gotcha;

  // 구글 시트(Apps Script 웹 앱)로 보내기. Apps Script는 CORS 응답을 주지 않아 no-cors로 보낸다.
  if (cfg.sheetEndpoint) {
    btn.disabled = true; status.textContent = '보내는 중…';
    try {
      await fetch(cfg.sheetEndpoint, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(data) });
      form.reset();
      status.textContent = '시안 잘 받았습니다. 한 편씩 소중히 읽고 연락드릴게요.';
    } catch {
      status.textContent = '전송에 실패했어요. 잠시 후 다시 시도하거나 idealee@inmybackyard.kr 로 보내 주세요.';
    } finally { btn.disabled = false; }
    return;
  }

  if (cfg.formEndpoint) {
    btn.disabled = true; status.textContent = '보내는 중…';
    try {
      const res = await fetch(cfg.formEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...data, _subject: `[SYAN 시안] ${data.name}` }),
      });
      if (!res.ok) throw new Error(res.status);
      form.reset();
      status.textContent = '시안 잘 받았습니다. 한 편씩 꼼꼼히 읽고 연락드릴게요.';
    } catch {
      status.textContent = '전송에 실패했어요. 잠시 후 다시 시도해 주세요.';
    } finally { btn.disabled = false; }
    return;
  }

  const labels = { name: '이름', major: '학과·학번', contact: '연락처', email: '이메일', q2_edge: 'Q1. 광고 분야에서 나만의 특출난 점', q4_worry: 'Q2. 지금 막막한 것', link: '링크' };
  const body = Object.entries(data).map(([k, v]) => `■ ${labels[k] || k}\n${v}`).join('\n\n');
  location.href = `mailto:${cfg.fallbackEmail || ''}?subject=${encodeURIComponent('[SYAN 시안] ' + data.name)}&body=${encodeURIComponent(body)}`;
  status.textContent = '메일 앱이 열리면 그대로 보내 주세요.';
});

// ───────── ATC 무드 인터랙션 ─────────
const root = document.documentElement;

// 메뉴
const burger = document.querySelector('.burger');
const toggleMenu = (open) => {
  open = open ?? !root.classList.contains('menu-open');
  root.classList.toggle('menu-open', open);
  burger.setAttribute('aria-expanded', open);
};
burger.addEventListener('click', () => toggleMenu());
document.querySelectorAll('.menu a').forEach((a) => a.addEventListener('click', () => toggleMenu(false)));
addEventListener('keydown', (e) => { if (e.key === 'Escape') toggleMenu(false); });

// 스크롤: 헤더 로고 등장
const onScroll = () => root.classList.toggle('scrolled', scrollY > innerHeight * 0.6);
addEventListener('scroll', onScroll, { passive: true }); onScroll();


// 캐러셀 (픽셀 그래픽 + 화살표 + 점 + 캡션, 자동 넘김, 드래그/스와이프)
document.querySelectorAll('.band, .hero').forEach((band) => {
  const cv = band.querySelector('canvas');
  const n = cv.pixCount ? cv.pixCount() : cv.dataset.words.split('|').length + (cv.dataset.src ? 1 : 0);
  const holds = Array.from({ length: n }, (_, k) => k).map((k) => Number((cv.dataset.hold || '').split(',')[k]) || 3500);
  const cycle = holds.reduce((a, b) => a + b, 0);
  let i = -1, hovering = false, manual = 0, t0 = performance.now(), wasVisible = false;
  const show = (k) => { k = ((k % n) + n) % n; if (k === i) return; i = k; cv.dispatchEvent(new CustomEvent('pix:go', { detail: k })); };
  if (cv.dataset.hover) {
    cv.addEventListener('pointerenter', () => { hovering = true; });
    cv.addEventListener('pointerleave', () => { hovering = false; t0 = performance.now(); });
  }
  let sx = null;
  cv.addEventListener('pointerdown', (e) => { sx = e.clientX; });
  addEventListener('pointerup', (e) => {
    if (sx === null) return;
    const dx = e.clientX - sx; sx = null;
    manual += Math.abs(dx) > 40 && dx > 0 ? -1 : 1; t0 = performance.now();
  });
  // 매 프레임 한 가지 규칙으로 모양을 정한다 (타이머끼리 꼬이지 않게)
  const loop = () => {
    requestAnimationFrame(loop);
    const r = band.getBoundingClientRect();
    const visible = r.bottom > 0 && r.top < innerHeight;
    if (!visible) { wasVisible = false; return; }
    if (!wasVisible) { wasVisible = true; t0 = performance.now(); manual = 0; }
    // 문단을 넘기기 전에 꼭 마지막 모양(SYAN)을 보게
    const past = cv.dataset.end && r.top + r.height / 2 < innerHeight * 0.4;
    if (past || hovering) return show(n - 1);
    let e = (performance.now() - t0) % cycle, k = 0;
    while (e >= holds[k]) { e -= holds[k]; k++; }
    show(k + manual);
  };
  loop();
});

// ───────── 스크롤 타자기: 스크롤한 만큼 한 글자씩 써진다 ─────────
const typeTargets = [...document.querySelectorAll('.poem > p, .apply h2, .apply .note')];
const typers = typeTargets.map((el) => {
  el.classList.remove('r', 'in'); el.classList.add('typed');
  const chars = [];
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        [...n.textContent].forEach((c) => {
          if (/\s/.test(c) && c !== ' ') { frag.append(c); return; }
          const s = document.createElement('span'); s.className = 'ch'; s.textContent = c;
          frag.append(s); chars.push(s);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
    });
  };
  walk(el);
  return { el, chars, shown: 0 };
});
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
// 모든 글자를 위→아래 한 줄로 이어 붙인다. 화면에 들어온 문단까지가 '목표',
// 실제로 보이는 글자 수는 목표를 향해 한 글자씩 빠르게 따라간다.
// 위로 스크롤하면 목표가 줄어들어 마지막 글자부터(아래→위) 지워진다.
const all = typers.flatMap((t) => t.chars);
const ends = []; { let n = 0; typers.forEach((t) => { n += t.chars.length; ends.push(n); }); }
let shown = 0, target = 0, lastCur = null;
const SPEED = 4; // 프레임당 글자 수 (≈ 초당 240자)
// 폰 주소창이 나타났다 사라져도 기준선이 흔들리지 않도록, 화면 높이는 가로폭이 바뀔 때만 갱신
let vh = document.documentElement.clientHeight, vw = innerWidth;
addEventListener('resize', () => { if (innerWidth !== vw) { vw = innerWidth; vh = document.documentElement.clientHeight; } });
const measure = () => {
  // 히스테리시스: 화면 85% 선을 넘으면 쓰고, 화면 아래로 완전히 내려가야만 지운다
  // → 읽는 중에 살짝 위로 스크롤해도 보이는 글이 지워졌다 다시 써지며 출렁이지 않음
  const typeLine = vh * 0.85, eraseLine = vh * 1.02;
  let typed = 0, keep = 0;
  typers.forEach((t, k) => {
    const top = t.el.getBoundingClientRect().top;
    if (top < typeLine) typed = ends[k];
    if (top < eraseLine) keep = ends[k];
  });
  if (typed > target) target = typed;          // 앞으로: 새 문단 쓰기
  else if (keep < target) target = keep;       // 뒤로: 화면 밖으로 나간 문단만 지우기
};
const tick = () => {
  if (shown < target) { const to = reduceMotion ? target : Math.min(target, shown + SPEED); for (; shown < to; shown++) all[shown].classList.add('on'); }
  else if (shown > target) { const to = reduceMotion ? target : Math.max(target, shown - SPEED * 1.5); for (; shown > to; shown--) all[shown - 1].classList.remove('on'); shown = Math.round(shown); }
  // 마지막으로 써진 글자 뒤에 커서. 쓰는 중엔 켜져 있고, 문장이 끝나 멈추면 깜빡인다
  const cur = shown > 0 ? all[shown - 1] : null;
  if (lastCur !== cur) { lastCur && lastCur.classList.remove('cur'); cur && cur.classList.add('cur'); lastCur = cur; }
  document.documentElement.classList.toggle('typing', shown !== target);
  requestAnimationFrame(tick);
};
addEventListener('scroll', measure, { passive: true });
addEventListener('resize', measure);
measure(); tick();
