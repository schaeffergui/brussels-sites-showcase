// Point d'entrée : modules isolés (une erreur n'en arrête pas d'autres).
import { initReveal } from './reveal.js?v=3';
import { initFilter } from './filter.js?v=2';
import { initDialog } from './dialog.js?v=3';
import { initMagnet } from './magnet.js?v=1';
import { initHero } from './hero.js?v=1';

window.__siteErrors = [];
const run = (n, f) => { try { f(); } catch (e) { console.error(n, e); window.__siteErrors.push(`${n}: ${e.message}`); } };
run('filter', initFilter);
run('dialog', initDialog);
run('reveal', initReveal);
run('magnet', initMagnet);
run('hero', initHero);
document.querySelectorAll('main img').forEach((im) => {
  const mark = () => im.closest('[data-fallback-box], .plate, .shot, .essay__inline, .essay__stage, .grill__band, .menu__photo, .stage, .thumb, figure')?.classList.add('is-missing');
  if (im.complete && im.naturalWidth === 0 && im.currentSrc) mark();
  im.addEventListener('error', mark);
});
