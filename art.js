/*
 * 오른쪽 고정 픽토그램.
 * 위치는 화면 오른쪽에 고정. 왼쪽 글을 스크롤하면 그 진행도에 맞춰
 * 픽셀이 흩어졌다가 다음 픽토그램으로 다시 붙는다 (스프링으로 쫀득하게 따라옴).
 * 순서: 확성기(hello) → 미로(lost) → 그래프(me) → 말풍선(syan) → 지구(you)
 */
(function () {
  const cv = document.querySelector('.fixed-art canvas');
  if (!cv) return;
  const wrap = cv.parentElement;
  const ctx = cv.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STEPS = [
    { id: 'hello', src: 'assets/art/megaphone.svg' },
    { id: 'lost', src: 'assets/art/maze.svg' },
    { id: 'me', src: 'assets/art/growth.svg' },
    { id: 'syan', src: 'assets/art/chat.svg' },
    { id: 'you', globe: true },
  ];
  const secs = STEPS.map((s) => document.getElementById(s.id));

  const BOX = 0.4;            // 캔버스 대비 픽토그램 크기 (주변은 흩어질 공간)
  let W = 0, H = 0, dpr = 1, S = 0, step = 6, N = 0;
  let shapes = [];            // 각 픽토그램의 목표 좌표 [N][2] (지구는 매 프레임 계산)
  let globe3d = [];           // 지구용 3D 점
  let parts = [];             // {seed, dx, dy, ox, oy}
  let imgs = [];
  let P = 0, sp = 0, vel = 0; // 목표 진행도, 스프링 위치/속도
  const mouse = { x: -1e4, y: -1e4 };

  const load = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });

  // 그림을 '내용 크기' 기준으로 맞춰서 모든 픽토그램이 비슷한 크기가 되게
  function sample(im) {
    const big = 600, c = document.createElement('canvas'); c.width = c.height = big;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0, big, big);
    const d = g.getImageData(0, 0, big, big).data;
    let x0 = big, y0 = big, x1 = 0, y1 = 0;
    const dark = (i) => d[i + 3] > 110 && d[i] + d[i + 1] + d[i + 2] < 384;
    for (let y = 0; y < big; y += 2) for (let x = 0; x < big; x += 2) if (dark((y * big + x) * 4)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const bw = x1 - x0 || 1, bh = y1 - y0 || 1, box = S * BOX, k = box / Math.max(bw, bh);
    const ox = (W - bw * k) / 2, oy = (H - bh * k) / 2, pts = [];
    for (let y = 0; y < bh * k; y += step) for (let x = 0; x < bw * k; x += step) {
      const sx = Math.round(x0 + x / k), sy = Math.round(y0 + y / k);
      if (dark((sy * big + sx) * 4)) pts.push([ox + x, oy + y]);
    }
    return pts;
  }

  function buildGlobe() {
    globe3d = [];
    const R = S * BOX * 0.5, d = step / R;
    for (let lon = 0; lon < 360; lon += 20) for (let la = -Math.PI / 2; la <= Math.PI / 2; la += d) globe3d.push([la, lon * Math.PI / 180]);
    for (let lat = -60; lat <= 60; lat += 30) for (let lo = 0; lo < Math.PI * 2; lo += d / Math.cos(lat * Math.PI / 180)) globe3d.push([lat * Math.PI / 180, lo]);
  }
  function globeAt(i, spin, out) {
    const [lat, lon] = globe3d[i % globe3d.length], L = lon + spin, R = S * BOX * 0.5, tilt = 0.38;
    let x = Math.cos(lat) * Math.sin(L), y = Math.sin(lat), z = Math.cos(lat) * Math.cos(L);
    const y2 = y * Math.cos(tilt) - z * Math.sin(tilt), z2 = y * Math.sin(tilt) + z * Math.cos(tilt);
    out[0] = W / 2 + x * R; out[1] = H / 2 - y2 * R; out[2] = z2; return out;
  }

  function build() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight; if (!W || !H) return;
    cv.width = W * dpr; cv.height = H * dpr;
    S = Math.min(W, H); step = Math.max(4, Math.round(S * BOX / 46));
    buildGlobe();
    const raw = STEPS.map((s, i) => (s.globe ? null : imgs[i] ? sample(imgs[i]) : []));
    N = Math.max(globe3d.length, ...raw.filter(Boolean).map((r) => r.length));
    // 픽토그램마다 픽셀 순서를 섞어서, 다음 그림으로 갈 때 서로 교차하며 날아가게
    shapes = raw.map((r) => {
      if (!r) return null;
      const order = r.map((_, i) => i).sort(() => Math.random() - 0.5);
      return Array.from({ length: N }, (_, i) => r[order[i % r.length]]);
    });
    parts = Array.from({ length: N }, () => {
      const a = Math.random() * Math.PI * 2, m = 0.25 + Math.sqrt(Math.random()) * 0.75;
      return { seed: Math.random(), dx: Math.cos(a) * m, dy: Math.sin(a) * m, ox: 0, oy: 0 };
    });
  }

  // 스크롤 위치 → 진행도 (k = 몇 번째 그림, 소수점 = 흩어진 정도)
  function target() {
    const line = innerHeight * 0.5, Z = innerHeight * 0.32;
    let p = 0;
    for (let k = 0; k < secs.length; k++) {
      const r = secs[k].getBoundingClientRect();
      if (r.top <= line) {
        p = k;
        if (k < secs.length - 1) { const t = (line - (r.bottom - Z)) / (2 * Z); if (t > 0) p = k + Math.min(1, t); }
      }
    }
    const first = secs[0].getBoundingClientRect(), last = secs[secs.length - 1].getBoundingClientRect();
    // 큰 그래픽 띠(.band)가 화면 가운데를 지나는 동안은 잠깐 숨김 → 띠에 잘려 네모진 경계가 생기지 않게
    const bandOver = [...document.querySelectorAll('.band')].some((b) => { const r = b.getBoundingClientRect(); return r.top < innerHeight * 0.9 && r.bottom > innerHeight * 0.1; });
    wrap.classList.toggle('on', first.top < innerHeight * 0.75 && last.bottom > innerHeight * 0.3 && !bandOver);
    return p;
  }

  const sm = (x) => x * x * (3 - 2 * x);
  const tmpA = [0, 0, 1], tmpB = [0, 0, 1];
  function frame(t) {
    requestAnimationFrame(frame);
    if (!N || !wrap.classList.contains('on')) { P = target(); return; }
    P = target();
    // 쫀득한 스프링: 목표를 살짝 늦게, 살짝 튕기며 따라감
    vel += (P - sp) * 0.06; vel *= 0.78; sp += vel;
    if (reduced) sp = Math.round(P);
    const last = STEPS.length - 1, sv = Math.max(0, Math.min(last, sp));
    const a = Math.min(last, Math.floor(sv)), b = Math.min(last, a + 1), e = sv - a;
    const spin = t * 0.00045;
    const ink = (getComputedStyle(cv).color.match(/\d+/g) || [10, 10, 10]).slice(0, 3).map(Number), grey = [150, 155, 165];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const sz = Math.max(2, Math.round(step * 0.8)), spread = S * 0.47;
    for (let i = 0; i < N; i++) {
      const p = parts[i];
      const A = shapes[a] ? shapes[a][i] : globeAt(i, spin, tmpA);
      const B = shapes[b] ? shapes[b][i] : globeAt(i, spin, tmpB);
      const k = Math.max(0, Math.min(1, e * 1.5 - p.seed * 0.5)), ee = sm(k);
      const burst = Math.sin(ee * Math.PI);
      let x = A[0] + (B[0] - A[0]) * ee + p.dx * burst * spread;
      let y = A[1] + (B[1] - A[1]) * ee + p.dy * burst * spread;
      // 마우스 가까이 가면 살짝 밀려났다가 돌아옴
      const mx = x - mouse.x, my = y - mouse.y, md = Math.hypot(mx, my);
      const push = md < 90 ? (1 - md / 90) * 16 : 0;
      p.ox += ((push ? (mx / (md || 1)) * push : 0) - p.ox) * 0.2; p.oy += ((push ? (my / (md || 1)) * push : 0) - p.oy) * 0.2;
      x += p.ox; y += p.oy;
      // 지구의 뒷면은 희미하게
      let alpha = 1;
      const zA = shapes[a] ? 1 : tmpA[2], zB = shapes[b] ? 1 : tmpB[2];
      const z = zA + (zB - zA) * ee; if (z < -0.05) alpha = 0.08; else if (!shapes[a] || !shapes[b]) alpha = 0.35 + 0.65 * z;
      const flow = reduced ? 0.4 : 0.5 + 0.5 * Math.sin(t * 0.0011 * (0.6 + p.seed * 0.9) + p.seed * 40 + (x / W) * 4);
      const c = ink.map((v, j) => Math.round(v + (grey[j] - v) * flow * 0.85));
      const far = Math.hypot(p.dx, p.dy) * burst;   // 멀리 흩어질수록 희미하게 사라지듯
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${alpha * (1 - far * 0.75)})`;
      ctx.fillRect(Math.round(x - sz / 2), Math.round(y - sz / 2), sz, sz);
    }
  }

  addEventListener('pointermove', (e) => { const r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; }, { passive: true });
  let lw = 0;
  Promise.all(STEPS.map((s) => (s.src ? load(s.src) : null))).then((r) => {
    imgs = r; build(); lw = cv.clientWidth;
    new ResizeObserver(() => { if (cv.clientWidth !== lw) { lw = cv.clientWidth; build(); } }).observe(cv);
    requestAnimationFrame(frame);
  });
})();
