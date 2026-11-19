// Une seule boucle requestAnimationFrame partagée par tous les effets.
// Elle ne tourne que si au moins un abonné est actif, et s'arrête quand l'onglet est masqué.
// Un abonné qui lève une erreur est retiré seul : il ne peut pas arrêter les autres effets.
const subs = new Set();
let raf = 0;
let last = 0;

// Mesures légères, lues par les tests (window.__kanelPerf).
const perf = { frames: 0, slow: 0, worst: 0, sum: 0, longTasks: 0, longTaskMs: 0, errors: [] };
window.__kanelPerf = perf;
try {
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) { perf.longTasks++; perf.longTaskMs += e.duration; }
  }).observe({ type: 'longtask', buffered: true });
} catch (_) { /* navigateur sans longtask */ }

function frame(t) {
  raf = 0;
  const dt = last ? Math.min(t - last, 100) : 16.7;
  last = t;
  if (subs.size) {
    perf.frames++; perf.sum += dt; if (dt > perf.worst) perf.worst = dt; if (dt > 20) perf.slow++;
  }
  for (const fn of [...subs]) {
    try { fn(t, dt); } catch (e) {
      subs.delete(fn);
      perf.errors.push(`${fn.name || 'anonyme'}: ${e && e.message}`);
      console.error('[kanel] effet arrêté', e);
    }
  }
  if (subs.size && !document.hidden) raf = requestAnimationFrame(frame);
  else last = 0;
}

export function addTick(fn) {
  subs.add(fn);
  if (!raf && !document.hidden) raf = requestAnimationFrame(frame);
  return () => removeTick(fn);
}
export function removeTick(fn) { subs.delete(fn); }

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && subs.size && !raf) raf = requestAnimationFrame(frame);
});

export function resetPerf() { Object.assign(perf, { frames: 0, slow: 0, worst: 0, sum: 0 }); }
