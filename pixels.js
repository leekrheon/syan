/*
 * 검은 픽셀 그래픽.
 * 글자(단어)를 오프스크린 캔버스에 그려 샘플링 → 사각 픽셀 무리가 단어 사이를 흩어졌다 다시 모인다.
 * data-mode="cycle": 시간마다 다음 단어 / "scroll": 화면을 지나가는 정도에 따라 단어가 바뀐다.
 * 마우스(터치)가 가까이 오면 픽셀이 밀려난다.
 */
(function () {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function sampleWord(word, w, h, step) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    let size = h * 0.62;
    g.font = `900 ${size}px Pretendard, sans-serif`;
    const tw = g.measureText(word).width;
    if (tw > w * 0.82) size *= (w * 0.82) / tw;
    g.font = `900 ${size}px Pretendard, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#000';
    g.fillText(word, w / 2, h / 2);
    const d = g.getImageData(0, 0, w, h).data;
    const pts = [];
    for (let y = 0; y < h; y += step)
      for (let x = 0; x < w; x += step)
        if (d[(y * w + x) * 4 + 3] > 128) pts.push([x, y]);
    return pts;
  }

  // 이미지(워드마크)를 픽셀로. 화면이 좁으면 split 지점에서 두 줄로 쌓는다.
  function sampleImage(img, w, h, step, split) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const rows = split && w < 700 ? [[0, split], [split, 1]] : [[0, 1]];
    const maxW = w * 0.9, rowH = (h * 0.8) / rows.length;
    const scale = Math.min(...rows.map(([a, b]) => Math.min(maxW / (iw * (b - a)), (rowH * 0.8) / ih)));
    const totalH = rows.length * ih * scale + (rows.length - 1) * ih * scale * 0.35;
    rows.forEach(([a, b], i) => {
      const sw = iw * (b - a), dw = sw * scale, dh = ih * scale;
      const y = (h - totalH) / 2 + i * dh * 1.35;
      g.drawImage(img, iw * a, 0, sw, ih, (w - dw) / 2, y, dw, dh);
    });
    const d = g.getImageData(0, 0, w, h).data;
    const pts = [];
    for (let y = 0; y < h; y += step)
      for (let x = 0; x < w; x += step)
        { const i = (y * w + x) * 4; if (d[i + 3] > 110 && d[i] + d[i + 1] + d[i + 2] < 384) pts.push([x, y]); }
    return pts;
  }

  function Field(canvas, img) {
    const words = (canvas.dataset.words || 'SYAN').split('|');
    const mode = canvas.dataset.mode || 'cycle';
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, dpr = 1, step = 8, parts = [], shapes = [], cur = -1, visible = false;
    const mouse = { x: -1e4, y: -1e4 };
    let ink = '34,36,41', fc = 0;
    canvas.addEventListener('pix:go', (e) => setShape(((e.detail % shapes.length) + shapes.length) % shapes.length));
    canvas.pixCount = () => shapes.length;

    function build() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      if (!W || !H) return;
      canvas.width = W * dpr; canvas.height = H * dpr;
      if (img) {
        step = Math.max(3, Math.round(W / 320));
        const s = sampleImage(img, W, H, step, parseFloat(canvas.dataset.split) || 0);
        // 서강젊은광고인네트워크 → SYAN → … 흩어졌다 다시 모이며 바뀐다
        shapes = [s, ...words.map((wd) => sampleWord(wd, W, H * 0.5, step).map(([x, y]) => [x, y + H * 0.25]))];
      } else {
        step = Math.max(4, Math.round(Math.min(W, H) / 95));
        shapes = words.map((wd) => sampleWord(wd, W, H, step));
      }
      const N = Math.max(...shapes.map((s) => s.length));
      const old = parts;
      parts = [];
      for (let i = 0; i < N; i++) {
        const p = old[i] || { x: Math.random() * W, y: Math.random() * H, vx: 0, vy: 0, seed: Math.random() };
        parts.push(p);
      }
      const keep = cur;
      cur = -1;
      setShape(keep >= 0 ? keep : 0);
      if (canvas.dataset.order === 'x') parts.forEach((p) => { p.x = p.tx; p.y = p.ty; });
    }

    function setShape(k) {
      k = Math.max(0, Math.min(shapes.length - 1, k));
      if (k === cur || !shapes.length) return;
      cur = k;
      canvas.dispatchEvent(new CustomEvent('pix:change', { detail: k }));
      const s = shapes[k];
      const order = s.map((_, i) => i).sort(() => Math.random() - 0.5);
      if (canvas.dataset.order === 'x') {
        // 왼→오 순서를 지키며 옮긴다 → 긴 문장이 가로로 접히며 줄어드는 느낌
        const sorted = s.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        parts.forEach((p, i) => {
          const t = sorted[Math.floor((i / parts.length) * sorted.length)];
          p.tx = t[0]; p.ty = t[1]; p.ghost = false; p.delay = 0;
        });
        return;
      }
      parts.forEach((p, i) => {
        if (i < s.length) { const t = s[order[i]]; p.tx = t[0]; p.ty = t[1]; p.ghost = false; }
        else { const t = s[order[i % s.length]]; p.tx = t[0]; p.ty = t[1]; p.ghost = true; }
        // 흩어지는 힘
        if (!reduced) { const a = Math.random() * Math.PI * 2, f = 3 + Math.random() * 7; p.vx += Math.cos(a) * f; p.vy += Math.sin(a) * f; }
        p.delay = Math.random() * 14;
      });
    }

    function frame(t) {
      requestAnimationFrame(frame);
      if (!visible || !parts.length) return;
      if (mode === 'scroll') {
        const r = canvas.getBoundingClientRect();
        const prog = 1 - (r.top + r.height) / (innerHeight + r.height); // 0→1 while passing
        setShape(Math.floor(Math.max(0, Math.min(0.999, prog * 1.15 - 0.05)) * shapes.length));
      }
      if (!(fc++ % 20)) ink = (getComputedStyle(canvas).color.match(/\d+/g) || [34, 36, 41]).slice(0, 3).join(',');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const sz = Math.max(2, Math.round(step * 0.8));
      for (const p of parts) {
        if (p.delay > 0) p.delay--;
        else { p.vx += (p.tx - p.x) * 0.06; p.vy += (p.ty - p.y) * 0.06; }
        const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy, R = 110;
        if (d2 < R * R) { const d = Math.sqrt(d2) || 1, f = (1 - d / R) * 7; p.vx += (dx / d) * f; p.vy += (dy / d) * f; }
        p.vx *= 0.76; p.vy *= 0.76;
        p.x += p.vx; p.y += p.vy;
        if (p.ghost) continue; // 남는 점은 그리지 않는다 → 배경이 깨끗하게
        const d = Math.abs(p.tx - p.x) + Math.abs(p.ty - p.y);
        const a = d < 1 ? 1 : Math.max(0.35, 1 - d / 160);
        // 은색: 픽셀마다 금속 톤이 다르고(ink ↔ silver), 가끔 반짝 빛난다
        const tone = p.seed < 0.55 ? 0 : (p.seed - 0.55) / 0.45;          // 45%는 은색 계열
        let tw = reduced ? 0 : Math.pow(Math.max(0, Math.sin(t * 0.0007 * (1 + p.seed * 1.5) + p.seed * 60)), 60) * 0.6;
        // 대각선으로 지나가는 광택
        const band = ((t * 0.00012) % 3) - 0.3, pos = (p.x / W + p.y / H) * 0.5;
        const sheen = reduced ? 0 : Math.max(0, 1 - Math.abs(pos - band) * 7);
        // 마우스 근처는 더 반짝
        const mdx = p.x - mouse.x, mdy = p.y - mouse.y, md = Math.sqrt(mdx * mdx + mdy * mdy);
        const near = md < 170 ? 1 - md / 170 : 0;
        tw = Math.min(0.7, tw + sheen * 0.35 * tone + near * 0.3 * tone);
        // 픽셀마다 검정 ↔ 회색을 천천히 오가며 색이 흐른다 (물결처럼 위치에 따라 박자가 어긋남)
        const flow = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(t * 0.0011 * (0.6 + p.seed * 0.9) + p.seed * 40 + (p.tx / W) * 5 - (p.ty / H) * 3);
        const silver = Math.min(1, flow * 0.85 + near * 0.3);
        const base = [10 + 150 * silver, 10 + 154 * silver, 12 + 160 * silver];      // 검정 → #a0a4ac
        const hi = [214, 219, 226];                                                  // 밝은 은색
        const c = base.map((v, k) => Math.round(v + (hi[k] - v) * tw));
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${a})`;
        const z = sz;
        ctx.fillRect(Math.round(p.x - z / 2), Math.round(p.y - z / 2), z, z);
      }
    }

    const move = (e) => { const r = canvas.getBoundingClientRect(); const pt = e.touches ? e.touches[0] : e; mouse.x = pt.clientX - r.left; mouse.y = pt.clientY - r.top; };
    addEventListener('pointermove', move, { passive: true });
    addEventListener('touchmove', move, { passive: true });
    canvas.addEventListener('pointerleave', () => { mouse.x = mouse.y = -1e4; });
    if (mode !== 'manual') canvas.addEventListener('click', () => setShape((cur + 1) % shapes.length));

    new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(canvas);
    new ResizeObserver(() => build()).observe(canvas);
    // 3초마다 다음 모양으로
    if (mode === 'cycle' && !reduced) setInterval(() => visible && setShape((cur + 1) % shapes.length), 3000);
    requestAnimationFrame(frame);
  }

  const start = () => document.querySelectorAll('canvas.pix').forEach((cv) => {
    if (!cv.dataset.src) return Field(cv);
    const im = new Image();
    im.onload = () => Field(cv, im);
    im.src = cv.dataset.src;
  });
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(start);
})();
