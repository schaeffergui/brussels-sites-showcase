// Zoom photographique très lent, une seule fois à l'entrée (1,06 → 1 en 6 s), puis immobile.
// Désactivé en mouvement réduit ; terminé immédiatement si le réglage change en cours de route.
import { reduced, onReducedChange } from './prefs.js?v=3';

export function initHero() {
  const img = document.querySelector('[data-hero-zoom]');
  if (!img || reduced() || !img.animate) return;
  const a = img.animate([{ transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 6000, easing: 'cubic-bezier(.2,.6,.2,1)', fill: 'backwards' });
  document.addEventListener('visibilitychange', () => { if (document.hidden) a.pause(); else if (a.playState === 'paused') a.play(); });
  new IntersectionObserver(([e]) => { if (!e.isIntersecting && a.playState === 'running') a.finish(); }).observe(img);
  onReducedChange((r) => { if (r) a.finish(); });
  window.__heroZoom = a;
}
