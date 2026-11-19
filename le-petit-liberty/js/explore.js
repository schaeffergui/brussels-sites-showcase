// Exploration éditoriale, sans détourner le défilement :
// 1) Repères sur la photo de la devanture : boutons (aria-pressed) reliés à la liste de notes,
//    qui reste lisible sans JS. Survol d'une note = repère mis en avant, et inversement.
// 2) Essai photo : sur grand écran, l'image collante change quand une étape passe au centre
//    (IntersectionObserver) ; sur mobile et sans JS, chaque étape garde sa propre photo.
// 3) <details> des boissons : ouverture/fermeture en douceur (hauteur animée), natif sinon.
import { reduced } from './prefs.js?v=3';

const EASE = 'cubic-bezier(.22,.8,.3,1)';

export function initSpots() {
  const root = document.querySelector('[data-spots]');
  if (!root) return;
  const spots = [...root.querySelectorAll('[data-spot]')];
  const notes = [...root.querySelectorAll('[data-note]')];
  const hint = root.querySelector('[data-spot-hint]');
  const stats = { picks: 0 };
  window.__spots = stats;
  let active = -1;
  const set = (i) => {
    active = i;
    spots.forEach((s, k) => s.setAttribute('aria-pressed', String(k === i)));
    notes.forEach((n, k) => n.classList.toggle('is-active', k === i));
  };
  spots.forEach((s, i) => {
    s.hidden = false;
    if (!reduced()) { s.classList.add('is-intro'); s.style.setProperty('--sd', `${300 + i * 140}ms`); }
    s.addEventListener('click', () => { stats.picks++; set(active === i ? -1 : i); });
    s.addEventListener('mouseenter', () => notes[i].classList.add('is-active'));
    s.addEventListener('mouseleave', () => { if (active !== i) notes[i].classList.remove('is-active'); });
  });
  notes.forEach((n, i) => {
    n.addEventListener('mouseenter', () => spots[i].classList.add('is-hot'));
    n.addEventListener('mouseleave', () => spots[i].classList.remove('is-hot'));
  });
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape' && active >= 0) { set(-1); } });
  if (hint) hint.hidden = false;
}

export function initEssay() {
  const root = document.querySelector('[data-essay]');
  if (!root || !('IntersectionObserver' in window)) return;
  const imgs = [...root.querySelectorAll('[data-essay-img]')];
  const steps = [...root.querySelectorAll('[data-essay-step]')];
  const stats = { changes: 0 };
  window.__essay = stats;
  let cur = 0;
  const show = (i) => {
    if (i === cur) return; cur = i; stats.changes++;
    imgs.forEach((im, k) => im.classList.toggle('is-on', k === i));
    steps.forEach((s, k) => s.classList.toggle('is-on', k === i));
  };
  steps[0].classList.add('is-on');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) show(steps.indexOf(e.target)); });
  }, { rootMargin: '-45% 0px -45% 0px' });
  steps.forEach((s) => io.observe(s));
  document.documentElement.classList.add('essay-ready');
}

export function initSmoothDetails() {
  document.querySelectorAll('details[data-smooth]').forEach((d) => {
    const sum = d.querySelector('summary'); const body = d.querySelector('.drink__body');
    if (!sum || !body || !body.animate) return;
    let anim = null, want = d.open;
    const stats = (window.__details ||= { toggles: 0 });
    sum.addEventListener('click', (e) => {
      if (reduced()) { want = !d.open; return; } // comportement natif
      e.preventDefault();
      want = !want; stats.toggles++;
      const start = d.open ? body.getBoundingClientRect().height : 0;
      if (anim) anim.cancel();
      d.open = true;
      const end = want ? body.scrollHeight : 0;
      const a = body.animate([{ height: `${start}px` }, { height: `${end}px` }], { duration: 300, easing: EASE });
      anim = a;
      stats.last = { want, start, end };
      a.onfinish = () => { if (anim === a) anim = null; d.open = want; stats.finished = (stats.finished || 0) + 1; };
    });
  });
}
