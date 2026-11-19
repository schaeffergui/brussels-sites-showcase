// Un seul planificateur requestAnimationFrame pour tous les effets.
// Il ne tourne que si un abonné en a besoin, s'arrête quand l'onglet est masqué,
// et un abonné en erreur est retiré seul (il ne peut pas arrêter les autres).
const subs = new Set();
let raf = 0;
let last = 0;
const perf = { frames: 0, worst: 0, sum: 0, over20: 0, errors: [] };
window.__lionPerf = perf;

function frame(t) {
  raf = 0;
  const dt = last ? Math.min(t - last, 50) : 16.7; // temps écoulé plafonné
  last = t;
  perf.frames++; perf.sum += dt; if (dt > perf.worst) perf.worst = dt; if (dt > 20) perf.over20++;
  for (const fn of [...subs]) {
    try { if (fn(t, dt) === false) subs.delete(fn); } catch (e) { subs.delete(fn); perf.errors.push(`${fn.name}: ${e.message}`); }
  }
  if (subs.size && !document.hidden) raf = requestAnimationFrame(frame); else last = 0;
}

/** Abonne fn(t, dt). fn peut renvoyer false pour se désabonner (état stable atteint). */
export function addTick(fn) {
  subs.add(fn);
  if (!raf && !document.hidden) raf = requestAnimationFrame(frame);
}
export function removeTick(fn) { subs.delete(fn); }
export const activeTicks = () => subs.size;

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { cancelAnimationFrame(raf); raf = 0; last = 0; }
  else if (subs.size && !raf) raf = requestAnimationFrame(frame);
});
