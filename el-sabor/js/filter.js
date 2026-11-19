// Filtre de la carte : boutons à bascule (aria-pressed) dans un groupe nommé.
// La zone image a une taille réservée ; fondu interruptible entre couches, jamais d'image vide.
// Les fiches apparaissent avec un léger décalage ; si le focus était sur une fiche masquée,
// il revient au bouton de catégorie (jamais « perdu » dans un élément caché).
import { reduced, onReducedChange } from './prefs.js?v=3';

const EASE = 'cubic-bezier(.22,.8,.3,1)';

export function initFilter() {
  const root = document.querySelector('[data-filter]');
  if (!root) return;
  const buttons = [...root.querySelectorAll('[data-cat-btn]')];
  const items = [...root.querySelectorAll('[data-cat]')];
  const imgs = [...root.querySelectorAll('[data-cat-img]')];
  const status = root.querySelector('[data-filter-status]');
  const credit = root.querySelector('[data-stage-credit]');
  let current = buttons.find((b) => b.getAttribute('aria-pressed') === 'true') || buttons[0];
  let token = 0;
  const stats = { started: 0, superseded: 0 };
  window.__menuFilter = stats;

  async function showImage(key, animate) {
    const next = imgs.find((i) => i.dataset.catImg === key) || imgs[0];
    if (credit && next.dataset.credit) credit.textContent = next.dataset.credit;
    const my = ++token;
    if (animate) { try { await next.decode(); } catch (_) {} if (my !== token) { stats.superseded++; return; } }
    const opac = imgs.map((i) => parseFloat(getComputedStyle(i).opacity) || 0);
    imgs.forEach((i) => i.getAnimations().forEach((a) => a.cancel()));
    imgs.forEach((i) => { i.classList.toggle('is-on', i === next); i.style.opacity = ''; i.style.zIndex = ''; });
    if (!animate) return;
    imgs.filter((i) => i !== next).forEach((i) => { i.style.opacity = String(opac[imgs.indexOf(i)]); i.style.zIndex = '1'; });
    next.style.zIndex = '2'; next.style.opacity = '1'; stats.started++;
    const a = next.animate([{ opacity: opac[imgs.indexOf(next)], transform: 'scale(1.03)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 420, easing: EASE });
    a.onfinish = () => { if (my === token) imgs.forEach((i) => { i.style.opacity = ''; i.style.zIndex = ''; }); };
  }

  function select(btn) {
    const changed = btn !== current; current = btn;
    const cat = btn.dataset.catBtn;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    const focusLost = document.activeElement && document.activeElement.closest('[data-cat]');
    let shown = 0;
    items.forEach((it) => {
      it.getAnimations().forEach((a) => a.cancel());
      const on = cat === 'tout' || it.dataset.cat === cat;
      it.hidden = !on;
      if (on) {
        if (changed && !reduced()) it.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 260, delay: Math.min(shown, 6) * 40, easing: EASE, fill: 'backwards' });
        shown++;
      }
    });
    if (focusLost && focusLost.hidden) btn.focus();
    if (status) status.textContent = `${shown} seç${shown > 1 ? 'ões' : 'ão'} exibida${shown > 1 ? 's' : ''}`;
    showImage(cat, changed && !reduced());
  }

  buttons.forEach((b) => b.addEventListener('click', () => select(b)));
  root.classList.add('filter-ready');
  select(current);
  onReducedChange((r) => { if (r) { imgs.forEach((i) => i.getAnimations().forEach((a) => a.finish())); items.forEach((i) => i.getAnimations().forEach((a) => a.finish())); } });
}
