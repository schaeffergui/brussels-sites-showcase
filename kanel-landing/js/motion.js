// Révélations au défilement (titres mot à mot, blocs, spirales) et parallaxe légère.
// Le texte n'est jamais dupliqué : les mots sont simplement enveloppés, le nom accessible reste identique.
import { prefs } from './prefs.js?v=8';
import { addTick, removeTick } from './ticker.js?v=8';

const root = document.documentElement;
const EASE = 'cubic-bezier(.16,1,.3,1)';
let io = null;

/* ---------- Découpage en mots ---------- */
function splitWords(el) {
  if (el.dataset.splitDone) return;
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          const w = document.createElement('span'); w.className = 'w';
          const i = document.createElement('span'); i.className = 'w__i'; i.textContent = part;
          w.appendChild(i); frag.appendChild(w);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child);
      }
    });
  };
  walk(el);
  el.dataset.splitDone = '1';
}

/* ---------- Révélation ---------- */
function reveal(el) {
  if (!el.classList.contains('is-pending')) return;
  el.classList.remove('is-pending');
  if (el.hasAttribute('data-split') && !prefs.reduce) {
    el.querySelectorAll('.w__i').forEach((w, k) => {
      w.animate([{ transform: 'translateY(108%)' }, { transform: 'translateY(0)' }],
        { duration: 900, delay: k * 70, easing: EASE, fill: 'backwards' });
    });
  }
}

function revealAll() {
  document.querySelectorAll('.is-pending').forEach((el) => el.classList.remove('is-pending'));
  document.querySelectorAll('[data-split] .w__i').forEach((w) => w.getAnimations().forEach((a) => a.finish()));
}

function startReveals() {
  const targets = document.querySelectorAll('[data-split],[data-reveal],[data-draw]');
  if (!('IntersectionObserver' in window) || !Element.prototype.animate) return; // tout reste visible
  targets.forEach((el) => {
    if (el.hasAttribute('data-split')) splitWords(el);
    el.classList.add('is-pending');
  });
  io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { reveal(e.target); io.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  targets.forEach((el) => io.observe(el));
}

/* ---------- Parallaxe (mesures groupées, écriture de transforms seulement) ---------- */
const heroImg = document.querySelector('.hero__img');
const hero = document.querySelector('.hero');
const placeSpiral = document.querySelector('.place__spiral');
const place = document.querySelector('.place');
const topbar = document.querySelector('.topbar');
let geo = null;
let lastY = -1;
let idle = 0;

function measure() {
  const y = window.scrollY;
  const h = hero.getBoundingClientRect();
  const p = place.getBoundingClientRect();
  geo = { heroTop: h.top + y, heroH: h.height, placeTop: p.top + y, placeH: p.height, vh: window.innerHeight };
  lastY = -1;
}

function tick() {
  const y = window.scrollY;
  if (y === lastY) { if (++idle > 12) removeTick(tick); return; }
  idle = 0; lastY = y;
  if (!geo) measure();
  topbar.classList.toggle('is-scrolled', y > 8);
  if (prefs.reduce) return;
  // Ouverture : la photo glisse plus lentement que le texte (max ~5 % de sa hauteur)
  const hp = Math.min(Math.max((y - geo.heroTop) / geo.heroH, 0), 1);
  if (hp < 1) heroImg.style.transform = `translate3d(0, ${(hp * geo.heroH * 0.05).toFixed(1)}px, 0) scale(1.08)`;
  // Adresse : la grande spirale tourne doucement pendant la traversée de la section
  const pp = (y + geo.vh - geo.placeTop) / (geo.placeH + geo.vh);
  if (pp > -0.1 && pp < 1.1) placeSpiral.style.transform = `rotate(${(pp * 40).toFixed(2)}deg)`;
}

function wake() { idle = 0; addTick(tick); }

function resetParallax() {
  heroImg.style.transform = '';
  placeSpiral.style.transform = '';
}

export function initMotion() {
  if (!prefs.reduce) startReveals();
  root.classList.add('motion-ready');

  window.addEventListener('scroll', wake, { passive: true });
  let rq = 0;
  const remeasure = () => { cancelAnimationFrame(rq); rq = requestAnimationFrame(() => { measure(); wake(); }); };
  window.addEventListener('resize', remeasure);
  window.addEventListener('load', remeasure);
  if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(document.querySelector('main'));
  wake();

  prefs.onChange((p) => {
    if (p.reduce) {
      if (io) { io.disconnect(); io = null; }
      revealAll();
      resetParallax();
    } else {
      wake();
    }
  });
}
