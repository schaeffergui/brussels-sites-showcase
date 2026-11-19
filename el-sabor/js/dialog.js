// Fiche photo dans un <dialog> modal natif : bouton « Fermer » libellé, Échap, focus contenu,
// focus rendu au déclencheur, défilement de la page bloqué puis rendu.
// - Groupes : « plates » (assiettes) et « menu » (photo de la carte) ; précédent/suivant restent
//   dans le groupe du déclencheur.
// - Ouverture « FLIP » : la photo grandit depuis la vignette cliquée (transform seulement).
// - Glisser (doigt ou souris) : l'image suit le geste horizontal ; au-delà de 60 px on change de
//   photo, sinon elle revient. touch-action: pan-y pinch-zoom garde défilement et zoom natifs.
// Seules les images voisines sont préchargées. Mouvement réduit : aucune animation.
import { reduced } from './prefs.js?v=3';

const BLANK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E";
const EASE = 'cubic-bezier(.22,.8,.3,1)';

export function initDialog() {
  const dlg = document.querySelector('[data-dish-dialog]');
  if (!dlg || typeof dlg.showModal !== 'function') return; // sans <dialog> : les vignettes restent dans la page
  const img = dlg.querySelector('.dish__img');
  const title = dlg.querySelector('.dish__title');
  const text = dlg.querySelector('.dish__text');
  const pos = dlg.querySelector('.dish__pos');
  const btnClose = dlg.querySelector('[data-close]');
  const btnPrev = dlg.querySelector('[data-prev]');
  const btnNext = dlg.querySelector('[data-next]');
  const frame = dlg.querySelector('.dish__frame');
  let list = [], index = 0, opener = null, token = 0;
  const cache = new Map();
  const stats = { requested: [], shown: [], flips: 0, swipes: 0 };
  window.__dishDialog = stats;

  const load = (url) => {
    if (!cache.has(url)) {
      stats.requested.push(url.split('/').pop());
      cache.set(url, new Promise((res) => {
        const im = new Image();
        im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => res(true));
        im.onerror = () => { cache.delete(url); res(false); };
        im.src = url;
      }));
    }
    return cache.get(url);
  };
  const groupOf = (b) => [...document.querySelectorAll(`[data-dish][data-group="${b.dataset.group}"]`)].filter((x) => !x.closest('[hidden]'));

  function show(i, dir = 0) {
    const n = list.length; index = (i + n) % n;
    const b = list[index]; const my = ++token;
    title.textContent = b.dataset.name;
    text.textContent = b.dataset.desc;
    pos.textContent = `${index + 1} / ${n}`;
    img.alt = b.dataset.alt || '';
    frame.classList.remove('is-missing');
    btnPrev.hidden = btnNext.hidden = n < 2;
    return load(b.dataset.img).then((ok) => {
      if (my !== token) return false;
      if (ok) { img.src = b.dataset.img; stats.shown.push(b.dataset.img.split('/').pop()); } else { img.src = BLANK; frame.classList.add('is-missing'); }
      if (dir && !reduced()) img.animate([{ opacity: 0, transform: `translateX(${dir * 40}px)` }, { opacity: 1, transform: 'none' }], { duration: 260, easing: EASE });
      [index - 1, index + 1].forEach((k) => load(list[(k + n) % n].dataset.img));
      return ok;
    });
  }

  // La photo part de la vignette : on mesure les deux boîtes et on anime le décalage.
  function flipFrom(thumb) {
    if (reduced() || !thumb || !img.animate) return;
    const a = thumb.getBoundingClientRect(), b = img.getBoundingClientRect();
    if (!a.width || !b.width) return;
    const s = a.width / b.width;
    const dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2);
    stats.flips++;
    img.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: .6 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: EASE });
  }

  function cleanup() {
    if (!document.body.classList.contains('has-dialog')) return;
    document.body.classList.remove('has-dialog'); token++;
    img.getAnimations().forEach((a) => a.cancel());
    if (opener && opener.isConnected && !opener.closest('[hidden]')) opener.focus();
  }
  function close() { if (dlg.open) dlg.close(); cleanup(); }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-dish]');
    if (!b) return;
    list = groupOf(b); opener = b;
    document.body.classList.add('has-dialog');
    img.src = BLANK;
    dlg.showModal(); btnClose.focus();
    const thumb = b.querySelector('img');
    show(list.indexOf(b)).then((ok) => { if (ok) flipFrom(thumb); });
  });
  btnClose.addEventListener('click', close);
  dlg.querySelector('[data-close-x]')?.addEventListener('click', close);
  btnPrev.addEventListener('click', () => show(index - 1, -1));
  btnNext.addEventListener('click', () => show(index + 1, 1));
  dlg.addEventListener('close', cleanup);
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); }); // clic sur le fond
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowRight' && list.length > 1) { e.preventDefault(); show(index + 1, 1); }
    else if (e.key === 'ArrowLeft' && list.length > 1) { e.preventDefault(); show(index - 1, -1); }
    else if (e.key === 'Tab') {
      const f = [...dlg.querySelectorAll('button, a[href]')].filter((x) => x.offsetParent && !x.hidden);
      const k = f.indexOf(document.activeElement); e.preventDefault();
      f[(k + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  });

  // Glisser pour changer de photo (le défilement vertical et le pincement restent natifs).
  let drag = null;
  frame.addEventListener('pointerdown', (e) => {
    if (list.length < 2 || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, on: false };
  });
  frame.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.on) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { drag = null; return; } // geste vertical : on laisse faire
      if (Math.abs(dx) < 8) return;
      drag.on = true; frame.classList.add('is-dragging');
      try { frame.setPointerCapture(e.pointerId); } catch (_) {}
    }
    drag.dx = dx;
    if (!reduced()) img.style.transform = `translateX(${dx}px)`;
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { dx, on } = drag; drag = null; frame.classList.remove('is-dragging');
    if (!on) return;
    img.style.transform = '';
    if (Math.abs(dx) > 60) { stats.swipes++; dx < 0 ? show(index + 1, 1) : show(index - 1, -1); }
    else if (!reduced()) img.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: 200, easing: EASE });
  };
  frame.addEventListener('pointerup', end);
  frame.addEventListener('pointercancel', (e) => { if (drag && e.pointerId === drag.id) { drag = null; img.style.transform = ''; frame.classList.remove('is-dragging'); } });
}
