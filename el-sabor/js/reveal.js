// Révélations : titres par masques de mots (un seul titre accessible, texte non dupliqué)
// et entrées décalées des blocs. Rien n'est caché sans JS ou si ce module échoue.
import { reduced, onReducedChange } from './prefs.js?v=3';

const root = document.documentElement;
const EASE = 'cubic-bezier(.16,1,.3,1)';
let io = null;

function split(el) {
  if (el.dataset.splitDone) return;
  const walk = (node) => [...node.childNodes].forEach((c) => {
    if (c.nodeType === 3) {
      const frag = document.createDocumentFragment();
      c.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.append(part); return; }
        const w = document.createElement('span'); w.className = 'w';
        const i = document.createElement('span'); i.className = 'w__i'; i.textContent = part;
        w.append(i); frag.append(w);
      });
      c.replaceWith(frag);
    } else if (c.nodeType === 1) walk(c);
  });
  walk(el);
  el.dataset.splitDone = '1';
}

function reveal(el) {
  if (!el.classList.contains('is-pending')) return;
  el.classList.remove('is-pending');
  if (el.hasAttribute('data-split') && !reduced()) {
    el.querySelectorAll('.w__i').forEach((w, k) => w.animate(
      [{ transform: 'translateY(108%)' }, { transform: 'translateY(0)' }],
      { duration: 720, delay: k * 65, easing: EASE, fill: 'backwards' }));
  }
}

function revealAll() {
  if (io) { io.disconnect(); io = null; }
  document.querySelectorAll('.is-pending').forEach((el) => el.classList.remove('is-pending'));
  document.querySelectorAll('[data-split] .w__i').forEach((w) => w.getAnimations().forEach((a) => a.finish()));
}

export function initReveal() {
  if (!reduced() && 'IntersectionObserver' in window && Element.prototype.animate) {
    const els = document.querySelectorAll('[data-split],[data-reveal]');
    els.forEach((el) => { if (el.hasAttribute('data-split')) split(el); el.classList.add('is-pending'); });
    io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { reveal(e.target); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -6% 0px', threshold: 0.1 });
    els.forEach((el) => io.observe(el));
  }
  root.classList.add('motion-ready');
  onReducedChange((r) => { if (r) revealAll(); });
}
