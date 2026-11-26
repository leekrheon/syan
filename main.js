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

  const labels = { name: '이름', major: '학과·학번', contact: '연락처', email: '이메일', q1_origin: 'Q1. 광고를 좋아하게 된 순간', q2_edge: 'Q2. 나만의 특출난 점', q3_idea: 'Q3. 세상에 걸고 싶은 시안', q4_worry: 'Q4. 지금 막막한 것', link: '링크' };
  const body = Object.entries(data).map(([k, v]) => `■ ${labels[k] || k}\n${v}`).join('\n\n');
  location.href = `mailto:${cfg.fallbackEmail || ''}?subject=${encodeURIComponent('[SYAN 시안] ' + data.name)}&body=${encodeURIComponent(body)}`;
  status.textContent = '메일 앱이 열리면 그대로 보내 주세요.';
});
