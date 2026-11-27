// 새로고침하면 항상 맨 위에서 시작 (브라우저의 스크롤 위치 기억, 주소의 #apply 등 무시)
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
if (location.hash) history.replaceState(null, '', location.pathname + location.search);
window.scrollTo(0, 0);
addEventListener('load', () => window.scrollTo(0, 0));

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
  form.querySelectorAll('.miss').forEach((el) => el.classList.remove('miss'));
  const missing = [...form.querySelectorAll('[required]')].filter((el) => !el.value.trim() || (el.type === 'email' && !el.checkValidity()));
  if (missing.length) {
    missing.forEach((el) => el.classList.add('miss'));
    status.textContent = '빠짐없이 작성해주세요 :)';
    missing[0].focus({ preventScroll: true });
    missing[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const data = Object.fromEntries(new FormData(form));
  if (data._gotcha) return;
  delete data._gotcha;
  delete data.pdf;
  if (portMode === 'pdf') data.link = '';
  const pdf = portMode === 'pdf' ? pdfInput.files[0] : null;
  const version = subs().length + 1;
  data.version = `${version}차`;
  if (pdf && !pdfOk(pdf)) return;

  // 구글 시트(Apps Script 웹 앱)로 보내기. Apps Script는 CORS 응답을 주지 않아 no-cors로 보낸다.
  if (cfg.sheetEndpoint) {
    btn.disabled = true; status.textContent = pdf ? 'PDF 올리는 중… 잠시만 기다려 주세요' : '보내는 중…';
    try {
      if (pdf) data.file = { name: pdf.name, type: 'application/pdf', data: await toBase64(pdf) };
      await fetch(cfg.sheetEndpoint, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(data) });
      saveSub(version, data, pdf); form.reset(); clearDraft(); refreshForm(); showPdf(); setMode('link'); updateVersionUI();
      status.textContent = `${version}차 시안 잘 받았습니다. 한 편씩 소중히 읽고 연락드릴게요.`;
    } catch {
      status.textContent = '전송에 실패했어요. 잠시 후 다시 시도하거나 contact@sogangsyan.team 로 보내 주세요.';
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


// ───────── 지원서 쓰기 편하게 ─────────
const DRAFT_KEY = 'syan-draft';
const fields = [...form.querySelectorAll('input[name]:not(.hp):not([type=file]), textarea')];
const draftNote = form.querySelector('.draft');
// 답변 칸이 글 길이에 맞춰 자동으로 늘어남 (스크롤 없이 한눈에)
const grow = (t) => { t.style.height = 'auto'; t.style.height = Math.max(t.scrollHeight + 2, 0) + 'px'; };
// 글자 수
const count = (t) => { const c = form.querySelector(`.count[data-for="${t.name}"]`); if (c) c.textContent = `${t.value.length.toLocaleString()}자`; };
function refreshForm() { form.querySelectorAll('textarea').forEach((t) => { grow(t); count(t); }); }
// 임시 저장: 이 브라우저에만 저장되어, 새로고침하거나 창을 닫았다 와도 쓰던 글이 남아 있음
let saveT;
const saveDraft = () => {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    const d = Object.fromEntries(fields.map((f) => [f.name, f.value]));
    if (!Object.values(d).some((v) => v.trim())) return clearDraft();
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); draftNote.textContent = '임시 저장됨 · ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }); } catch {}
  }, 500);
};
function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch {} draftNote.textContent = ''; }
try {
  const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
  if (d) { fields.forEach((f) => { if (d[f.name]) f.value = d[f.name]; }); draftNote.textContent = '쓰던 글을 불러왔어요'; }
} catch {}
form.addEventListener('input', (e) => { e.target.classList.remove('miss'); if (status.textContent.startsWith('빠짐없이')) status.textContent = ''; if (e.target.tagName === 'TEXTAREA') { grow(e.target); count(e.target); } saveDraft(); });
addEventListener('resize', refreshForm);
refreshForm();
// Ctrl(⌘) + Enter로 제출
form.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(); } });


// ───────── 포트폴리오 PDF 첨부 ─────────
const pdfInput = document.getElementById('pdf');
const drop = form.querySelector('.drop');
const dropText = form.querySelector('.drop-text');
const MAX_PDF = 10 * 1024 * 1024;
const PDF_ICON = '<svg class="ficon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M6 2.75h8.5L19.25 7.5v13.75H6z"/><path d="M14.25 2.75V7.75h5"/><path d="M9 13.5h6M9 16.5h4"/></svg>';
function pdfOk(f) {
  if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { status.textContent = 'PDF 파일만 올릴 수 있어요.'; return false; }
  if (f.size > MAX_PDF) { status.textContent = 'PDF가 10MB를 넘어요. 용량을 줄이거나 위 링크 칸에 올려 주세요.'; return false; }
  return true;
}
function showPdf() {
  const f = pdfInput.files[0];
  drop.classList.toggle('has', !!f);
  dropText.innerHTML = f
    ? `${PDF_ICON}<span class="fname">${f.name.replace(/[<>&]/g, '')}</span><span class="fsize">${(f.size / 1048576).toFixed(1)}MB</span><u>바꾸기</u>`
    : `${PDF_ICON}<span>PDF를 끌어다 놓거나 <u>눌러서 고르기</u></span>`;
}
function toBase64(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });
}
showPdf();
pdfInput.addEventListener('change', () => { const f = pdfInput.files[0]; if (f && !pdfOk(f)) pdfInput.value = ''; else status.textContent = ''; showPdf(); });
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', (e) => {
  const f = e.dataTransfer.files[0]; if (!f) return;
  if (!pdfOk(f)) return;
  const dt = new DataTransfer(); dt.items.add(f); pdfInput.files = dt.files; status.textContent = ''; showPdf();
});


// ───────── 포트폴리오: 링크 / PDF 선택 ─────────
let portMode = 'link';
function setMode(m) {
  portMode = m;
  form.querySelectorAll('.seg button').forEach((b) => { const on = b.dataset.mode === m; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  form.querySelectorAll('.port-pane').forEach((p) => { p.hidden = p.dataset.pane !== m; });
}
form.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

// ───────── 내가 제출한 시안: 1차, 2차, 3차… (이 브라우저에만 보관) ─────────
const SUB_KEY = 'syan-submissions';
function subs() { try { return JSON.parse(localStorage.getItem(SUB_KEY) || '[]'); } catch { return []; } }
function saveSub(v, data, pdf) {
  const list = subs();
  const { file, ...rest } = data;
  list.push({ v, at: new Date().toISOString(), data: rest, pdfName: pdf ? pdf.name : '' });
  try { localStorage.setItem(SUB_KEY, JSON.stringify(list)); } catch {}
}
const pill = document.getElementById('pill');
const mineLink = document.querySelector('.mine-link');
const submitBtn = form.querySelector('.submit-btn');
function updateVersionUI() {
  const n = subs().length;
  pill.textContent = n ? `${n}차 시안_hwp` : '제출 전_hwp';
  pill.setAttribute('href', n ? '#mine' : '#apply');
  mineLink.hidden = !n;
  submitBtn.textContent = `${n + 1}차 시안 제출하기`;
}
updateVersionUI();

const dlg = document.getElementById('mine');
const esc = (t) => String(t || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let viewing = 0;
function renderMine() {
  const list = subs(); if (!list.length) return;
  const it = list[viewing];
  dlg.querySelector('.mine-title').textContent = `${it.v}차 시안_hwp`;
  dlg.querySelector('.mine-tabs').innerHTML = list.map((x, i) => `<button type="button" class="soft${i === viewing ? ' on' : ''}" data-i="${i}">${x.v}차</button>`).join('');
  dlg.querySelectorAll('.mine-tabs button').forEach((b) => b.onclick = () => { viewing = +b.dataset.i; renderMine(); });
  const d = it.data, when = new Date(it.at).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  dlg.querySelector('.mine-body').innerHTML = `
    <p class="mine-meta">${esc(when)} 제출</p>
    <dl>
      <dt>이름</dt><dd>${esc(d.name)}</dd><dt>이메일</dt><dd>${esc(d.email)}</dd>
      <dt>학과 · 학번</dt><dd>${esc(d.major)}</dd><dt>연락처</dt><dd>${esc(d.contact)}</dd>
      <dt>Q1. 광고 분야에서 나의 잠재력과 역량</dt><dd class="long">${esc(d.q2_edge)}</dd>
      <dt>Q2. 지금 막막한 것</dt><dd class="long">${esc(d.q4_worry)}</dd>
      <dt>포트폴리오</dt><dd>${it.pdfName ? 'PDF · ' + esc(it.pdfName) : (d.link ? esc(d.link) : '없음')}</dd>
    </dl>`;
}
function openMine() { if (!subs().length) { location.hash = '#apply'; return; } viewing = subs().length - 1; renderMine(); dlg.showModal(); }
pill.addEventListener('click', (e) => { if (subs().length) { e.preventDefault(); openMine(); } });
mineLink.addEventListener('click', (e) => { e.preventDefault(); toggleMenu(false); openMine(); });
dlg.querySelector('.mine-close').onclick = () => dlg.close();
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
dlg.querySelector('.mine-edit').onclick = () => {
  const d = subs()[viewing].data;
  ['name', 'email', 'major', 'contact', 'q2_edge', 'q4_worry', 'link'].forEach((k) => { if (form.elements[k]) form.elements[k].value = d[k] || ''; });
  setMode(d.link ? 'link' : 'link');
  refreshForm(); saveDraft(); dlg.close();
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  status.textContent = `고쳐서 제출하면 ${subs().length + 1}차 시안으로 접수됩니다.`;
};


// (검은 화면 반전은 뺐음)
