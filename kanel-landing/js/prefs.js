// Préférences d'affichage, suivies en direct (y compris si l'utilisateur change de réglage page ouverte).
const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
const mqFine = matchMedia('(hover: hover) and (pointer: fine)');
const mqDesktop = matchMedia('(min-width: 64rem)');

const listeners = new Set();

export const prefs = {
  get reduce() { return mqReduce.matches; },
  get finePointer() { return mqFine.matches; },
  get desktop() { return mqDesktop.matches; },
  /** fn(prefs) est appelé à chaque changement de réglage. Renvoie une fonction de désinscription. */
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

function emit() {
  document.documentElement.classList.toggle('motion', !mqReduce.matches);
  listeners.forEach((fn) => { try { fn(prefs); } catch (e) { console.error(e); } });
}
[mqReduce, mqFine, mqDesktop].forEach((mq) => mq.addEventListener('change', emit));
