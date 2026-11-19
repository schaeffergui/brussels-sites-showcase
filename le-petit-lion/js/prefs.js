// Préférences suivies en direct : mouvement réduit et pointeur fin (souris/trackpad).
const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
const mqFine = matchMedia('(hover: hover) and (pointer: fine)');
const subs = new Set();
const apply = () => document.documentElement.classList.toggle('motion', !mqReduce.matches);
apply();
const emit = () => { apply(); subs.forEach((fn) => { try { fn(mqReduce.matches); } catch (e) { console.error(e); } }); };
mqReduce.addEventListener('change', emit);
mqFine.addEventListener('change', emit);

export const reduced = () => mqReduce.matches;
export const finePointer = () => mqFine.matches;
/** Effets décoratifs au pointeur : seulement pointeur fin ET mouvement permis. */
export const pointerFx = () => mqFine.matches && !mqReduce.matches;
/** fn(reduced) appelé à chaque changement de réglage (mouvement ou type de pointeur). */
export const onReducedChange = (fn) => { subs.add(fn); return () => subs.delete(fn); };
