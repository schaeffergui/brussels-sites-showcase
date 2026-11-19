// Point d'entrée : chaque module est isolé pour qu'une erreur n'arrête pas les autres.
import { initReveal } from './reveal.js?v=3';
import { initScenes } from './scenes.js?v=4';
import { initGallery } from './gallery.js?v=8';
import { initPointer } from './pointer.js?v=3';
import { initBilliard } from './billiard.js?v=11';
import { initSocial } from './social.js?v=3';

window.__lionErrors = [];
const run = (name, fn) => { try { fn(); } catch (e) { console.error(`[petit-lion] ${name}`, e); window.__lionErrors.push(`${name}: ${e.message}`); } };
run('scenes', initScenes);
run('gallery', initGallery);
run('social', initSocial);
run('reveal', initReveal);   // ajoute .motion-ready (sinon le filet de sécurité affiche tout)
run('pointer', initPointer);
run('billiard', initBilliard);

// Photo absente ou en échec réseau : cadre « Image indisponible » au lieu d'une image cassée.
document.querySelectorAll('main img').forEach((im) => {
  const mark = () => im.closest('[data-slot], .stage, .thumb, figure')?.classList.add('is-missing');
  if (im.complete && im.naturalWidth === 0 && im.currentSrc) mark();
  im.addEventListener('error', mark);
});
