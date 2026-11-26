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

  function Field(canvas) {
    const words = (canvas.dataset.words || 'SYAN').split('|');
    const mode = canvas.dataset.mode || 'cycle';
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, dpr = 1, step = 8, parts = [], shapes = [], cur = -1, visible = false;
    const mouse = { x: -1e4, y: -1e4 };

    function build() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      if (!W || !H) return;
      canvas.width = W * dpr; canvas.height = H * dpr;
      step = Math.max(5, Math.round(Math.min(W, H) / 70));
      shapes = words.map((wd) => sampleWord(wd, W, H, step));
      const N = Math.max(...shapes.map((s) => s.length));
      const old = parts;
      parts = [];
      for (let i = 0; i < N; i++) {
        const p = old[i] || { x: Math.random() * W, y: Math.random() * H, vx: 0, vy: 0, seed: Math.random() };
        parts.push(p);
      }
      cur = -1;
      setShape(0);
    }

    function setShape(k) {
      k = Math.max(0, Math.min(shapes.length - 1, k));
      if (k === cur || !shapes.length) return;
      cur = k;
      const s = shapes[k];
      const order = s.map((_, i) => i).sort(() => Math.random() - 0.5);
      parts.forEach((p, i) => {
        if (i < s.length) { const t = s[order[i]]; p.tx = t[0]; p.ty = t[1]; p.ghost = false; }
        else { const t = s[order[i % s.length]]; p.tx = t[0]; p.ty = t[1]; p.ghost = true; }
        // 흩어지는 힘
        if (!reduced) { const a = Math.random() * Math.PI * 2, f = 6 + Math.random() * 14; p.vx += Math.cos(a) * f; p.vy += Math.sin(a) * f; }
        p.delay = Math.random() * 25;
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
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const sz = step * 0.78;
      for (const p of parts) {
        if (p.delay > 0) p.delay--;
        else { p.vx += (p.tx - p.x) * 0.045; p.vy += (p.ty - p.y) * 0.045; }
        const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy, R = 110;
        if (d2 < R * R) { const d = Math.sqrt(d2) || 1, f = (1 - d / R) * 7; p.vx += (dx / d) * f; p.vy += (dy / d) * f; }
        p.vx *= 0.82; p.vy *= 0.82;
        p.x += p.vx; p.y += p.vy;
        const flick = reduced ? 1 : 0.75 + 0.25 * Math.sin(t * 0.002 + p.seed * 40);
        ctx.fillStyle = p.ghost ? `rgba(10,10,10,${0.08 * flick})` : `rgba(10,10,10,${0.55 + 0.45 * flick * p.seed})`;
        ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
      }
    }

    const move = (e) => { const r = canvas.getBoundingClientRect(); const pt = e.touches ? e.touches[0] : e; mouse.x = pt.clientX - r.left; mouse.y = pt.clientY - r.top; };
    addEventListener('pointermove', move, { passive: true });
    addEventListener('touchmove', move, { passive: true });
    canvas.addEventListener('pointerleave', () => { mouse.x = mouse.y = -1e4; });
    canvas.addEventListener('click', () => setShape((cur + 1) % shapes.length));

    new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(canvas);
    new ResizeObserver(() => build()).observe(canvas);
    if (mode === 'cycle' && !reduced) setInterval(() => visible && setShape((cur + 1) % shapes.length), 3200);
    requestAnimationFrame(frame);
  }

  const start = () => document.querySelectorAll('canvas.pix').forEach(Field);
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(start);
})();
