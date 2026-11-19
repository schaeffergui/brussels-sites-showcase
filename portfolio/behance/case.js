// Vídeos em loop: tocam só quando visíveis (economia de CPU e dados).
// Com “reduzir movimento”: nada toca sozinho; aparecem os controles nativos e o pôster.
const mq = matchMedia('(prefers-reduced-motion: reduce)');
const vids = [...document.querySelectorAll('video[data-loop]')];
const seen = new Map();
function apply() {
  for (const v of vids) {
    if (mq.matches) { v.pause(); v.controls = true; v.preload = 'metadata'; }
    else { v.controls = false; if (seen.get(v)) v.play().catch(() => { v.controls = true; }); }
  }
}
const io = new IntersectionObserver((es) => {
  for (const e of es) {
    const v = e.target, on = e.intersectionRatio >= 0.35;
    seen.set(v, on);
    if (mq.matches) continue;
    if (on) { v.preload = 'auto'; v.play().catch(() => { v.controls = true; }); } else v.pause();
  }
}, { threshold: [0, 0.35] });
vids.forEach((v) => io.observe(v));
mq.addEventListener('change', apply);
apply();
