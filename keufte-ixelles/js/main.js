// Point d'entrée : modules isolés (une erreur n'en arrête pas d'autres).
import { initReveal } from './reveal.js?v=3';
import { initTabs } from './tabs.js?v=1';
import { initHours } from './hours.js?v=2';
import { initMagnet } from './magnet.js?v=1';
import { initEmber } from './ember.js?v=2';
import { initSizes } from './sizes.js?v=1';
import { initStrip } from './strip.js?v=9';

window.__siteErrors = [];
const run = (n, f) => { try { f(); } catch (e) { console.error(n, e); window.__siteErrors.push(`${n}: ${e.message}`); } };
run('tabs', initTabs);
run('hours', initHours);
run('sizes', initSizes);
run('strip', initStrip);
run('reveal', initReveal);
run('magnet', initMagnet);
run('ember', initEmber);
document.querySelectorAll('main img').forEach((im) => {
  const mark = () => im.closest('[data-fallback-box], .plate, .shot, .essay__inline, .essay__stage, .grill__band, .menu__photo, .stage, .thumb, figure')?.classList.add('is-missing');
  if (im.complete && im.naturalWidth === 0 && im.currentSrc) mark();
  im.addEventListener('error', mark);
});
