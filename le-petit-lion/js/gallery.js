// Galerie : vignettes (liens vers l'image pleine taille, utilisables sans JS) + visionneuse
// <dialog> modale. Fermer (bouton libellé, Échap), précédent/suivant (boutons, ←/→, Origine/Fin),
// focus contenu dans la visionneuse, focus rendu à la vignette d'origine, position « n / total ».
// Seules l'image affichée et ses deux voisines sont préchargées en grande taille.
import { reduced } from './prefs.js?v=3';

// Image transparente 1×1 : la visionneuse n'a jamais de src vide.
const BLANK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E";

export function initGallery() {
  const list = document.querySelector('[data-gallery]');
  const dialog = document.querySelector('[data-viewer]');
  if (!list || !dialog || typeof dialog.showModal !== 'function') return; // sans <dialog> : liens normaux

  const thumbs = [...list.querySelectorAll('.thumb')];
  const img = dialog.querySelector('.viewer__img');
  const frame = dialog.querySelector('.viewer__frame');
  const altEl = dialog.querySelector('.viewer__alt');
  const posEl = dialog.querySelector('.viewer__pos');
  const btnPrev = dialog.querySelector('[data-prev]');
  const btnNext = dialog.querySelector('[data-next]');
  const btnClose = dialog.querySelector('[data-close]');
  let index = 0, opener = null, token = 0;
  const cache = new Map(); // url -> Promise<boolean>
  const stats = { requested: [], shown: [] };
  window.__lionGallery = stats;

  const srcFor = (t) => (window.innerWidth * (window.devicePixelRatio || 1) > 1100 ? t.dataset.full : t.dataset.mid);
  const altFor = (t) => t.querySelector('img').alt;

  function load(url) {
    if (!cache.has(url)) {
      stats.requested.push(url.split('/').pop());
      cache.set(url, new Promise((res) => {
        const im = new Image();
        im.decoding = 'async';
        im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => res(true));
        im.onerror = () => { cache.delete(url); res(false); };
        im.src = url;
      }));
    }
    return cache.get(url);
  }

  function show(i) {
    const n = thumbs.length;
    index = (i + n) % n;
    const t = thumbs[index];
    const url = srcFor(t);
    const my = ++token;
    altEl.textContent = altFor(t) + (t.dataset.credit ? ` — ${t.dataset.credit}.` : '');
    posEl.textContent = `${index + 1} / ${n}`;
    img.alt = altFor(t);
    frame.classList.remove('is-missing');
    if (!reduced()) img.classList.add('is-loading');
    load(url).then((ok) => {
      if (my !== token) return; // une navigation plus récente a pris la main
      img.classList.remove('is-loading');
      if (ok) { img.src = url; stats.shown.push(url.split('/').pop()); } else { img.src = BLANK; frame.classList.add('is-missing'); }
    });
    // Préchargement des seules voisines
    [index - 1, index + 1].forEach((k) => load(srcFor(thumbs[(k + n) % n])));
  }

  function open(i, from) {
    opener = from;
    document.body.classList.add('has-viewer');
    dialog.showModal();
    show(i);
    btnClose.focus();
  }

  // Nettoyage idempotent : appelé tout de suite par « Fermer » et par l'événement natif « close »
  // (Échap). Le défilement de la page est rendu et le focus revient à la vignette d'origine.
  function cleanup() {
    if (!document.body.classList.contains('has-viewer')) return;
    document.body.classList.remove('has-viewer');
    token++;
    if (opener) opener.focus();
  }
  function close() {
    if (dialog.open) dialog.close();
    cleanup();
  }

  dialog.addEventListener('close', cleanup);
  // Échap (ou retour système) : on ferme nous-mêmes, de façon synchrone, avec le même nettoyage.
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(); });

  thumbs.forEach((t, i) => t.addEventListener('click', (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return; // ouvrir dans un onglet reste possible
    e.preventDefault();
    open(i, t);
  }));
  btnPrev.addEventListener('click', () => show(index - 1));
  btnNext.addEventListener('click', () => show(index + 1));
  btnClose.addEventListener('click', close);

  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
    else if (e.key === 'Home') { e.preventDefault(); show(0); }
    else if (e.key === 'End') { e.preventDefault(); show(thumbs.length - 1); }
    else if (e.key === 'Tab') {
      // focus contenu : boucle entre les trois boutons de la visionneuse
      const f = [btnPrev, btnNext, btnClose];
      const k = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(k + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  });
  // Échap : comportement natif du <dialog> (événement « cancel » puis « close »).

  // Galerie tactile : la photo suit le doigt (ou la souris) comme un tirage papier — elle glisse
  // et s'incline un peu ; au-delà de 70 px elle part et la suivante arrive de l'autre côté,
  // sinon elle revient avec un léger rebond. Geste vertical : on laisse défiler/pincer (natif).
  const swipe = { count: 0 };
  window.__lionSwipeStats = swipe;
  let g = null;
  img.draggable = false;
  frame.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    g = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, on: false };
  });
  frame.addEventListener('pointermove', (e) => {
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.on) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { g = null; return; }
      if (Math.abs(dx) < 8) return;
      g.on = true; frame.classList.add('is-dragging');
      try { frame.setPointerCapture(e.pointerId); } catch (_) {}
    }
    g.dx = dx;
    if (!reduced()) img.style.transform = `translateX(${dx}px) rotate(${dx * 0.025}deg)`;
  });
  const release = (e) => {
    if (!g || e.pointerId !== g.id) return;
    const { dx, on } = g; g = null; frame.classList.remove('is-dragging');
    if (!on) return;
    const from = img.style.transform; img.style.transform = '';
    if (Math.abs(dx) > 70) {
      swipe.count++;
      const dir = dx < 0 ? 1 : -1;
      if (!reduced() && img.animate) {
        img.animate([{ transform: from }, { transform: `translateX(${-dir * 60}vw) rotate(${-dir * 6}deg)`, opacity: 0 }], { duration: 180, easing: 'cubic-bezier(.4,0,1,1)' })
          .onfinish = () => { if (!dialog.open) return; show(index + dir); img.animate([{ transform: `translateX(${dir * 40}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.22,.8,.3,1)' }); };
      } else show(index + dir);
    } else if (!reduced() && img.animate) {
      img.animate([{ transform: from }, { transform: 'translateX(0) rotate(0)' }], { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    }
  };
  frame.addEventListener('pointerup', release);
  frame.addEventListener('pointercancel', (e) => { if (g && e.pointerId === g.id) { g = null; img.style.transform = ''; frame.classList.remove('is-dragging'); } });
  window.__lionSwipe = true;
}
