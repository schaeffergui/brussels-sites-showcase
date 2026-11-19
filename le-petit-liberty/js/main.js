// Point d'entrée : modules isolés (une erreur n'en arrête pas d'autres).
import { initReveal } from './reveal.js?v=3';
import { initMagnet } from './magnet.js?v=1';
import { initSpots, initSmoothDetails } from './explore.js?v=3';

window.__siteErrors = [];
const run = (n, f) => { try { f(); } catch (e) { console.error(n, e); window.__siteErrors.push(`${n}: ${e.message}`); } };
run('reveal', initReveal);
run('magnet', initMagnet);
run('spots', initSpots);
run('details', initSmoothDetails);
// « Préparer ma visite » : le focus suit le défilement vers les infos pratiques.
document.querySelector('a[href="#infos"].btn')?.addEventListener('click', () => {
  requestAnimationFrame(() => document.getElementById('infos')?.focus({ preventScroll: true }));
});
document.querySelectorAll('main img').forEach((im) => {
  const mark = () => im.closest('[data-fallback-box], .plate, .shot, .essay__inline, .grill__band, .menu__photo, .stage, .thumb, figure')?.classList.add('is-missing');
  if (im.complete && im.naturalWidth === 0 && im.currentSrc) mark();
  im.addEventListener('error', mark);
});
