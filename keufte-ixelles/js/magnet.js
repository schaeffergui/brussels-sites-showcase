// Magnétisme discret (pointeur fin, mouvement permis) : seule la « face » intérieure bouge,
// ≤ 6 px dans une zone de 40 px ; la cible cliquable et l'anneau de focus restent fixes.
// Option : une lueur [data-glow] qui suit le pointeur dans une section sombre.
import { pointerFx, onReducedChange } from './prefs.js?v=3';
import { addTick } from './ticker.js?v=3';

const MAX = 6, ZONE = 40;
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, m) => Math.max(-m, Math.min(m, v));
const P = { x: -1e4, y: -1e4, moved: false };
const mags = [...document.querySelectorAll('[data-magnetic]')].map((el) => ({ el, face: el.querySelector('.btn__face'), r: null, x: 0, y: 0, tx: 0, ty: 0, locked: false }));
const glows = [...document.querySelectorAll('[data-glow]')].map((sec) => ({ sec, el: sec.querySelector('.glow'), r: null, x: 0, y: 0, tx: 0, ty: 0, on: false }));
let measuredAt = 0;

function measure(now) {
  if (now - measuredAt < 400) return;
  measuredAt = now;
  const sy = scrollY;
  mags.forEach((m) => { const r = m.el.getBoundingClientRect(); m.r = { l: r.left, t: r.top + sy, w: r.width, h: r.height }; });
}

function tick(now) {
  let busy = false;
  if (P.moved) { measure(now); P.moved = false; busy = true; }
  const sy = scrollY;
  for (const m of mags) {
    if (!m.face) continue;
    if (m.r && !m.locked && pointerFx()) {
      const t = m.r.t - sy;
      const dx = Math.max(m.r.l - P.x, 0, P.x - (m.r.l + m.r.w)), dy = Math.max(t - P.y, 0, P.y - (t + m.r.h));
      const s = Math.max(0, 1 - Math.hypot(dx, dy) / ZONE);
      m.tx = clamp((P.x - (m.r.l + m.r.w / 2)) * 0.2, MAX) * s; m.ty = clamp((P.y - (t + m.r.h / 2)) * 0.35, MAX) * s;
    } else { m.tx = m.ty = 0; }
    m.x = lerp(m.x, m.tx, 0.2); m.y = lerp(m.y, m.ty, 0.2);
    const still = Math.abs(m.x) < 0.05 && Math.abs(m.y) < 0.05 && !m.tx && !m.ty;
    m.face.style.transform = still ? '' : `translate3d(${m.x.toFixed(2)}px,${m.y.toFixed(2)}px,0)`;
    if (!still) busy = true;
  }
  for (const g of glows) {
    g.x = lerp(g.x, g.tx, 0.12); g.y = lerp(g.y, g.ty, 0.12);
    g.el.style.setProperty('--gx', `${g.x.toFixed(1)}px`); g.el.style.setProperty('--gy', `${g.y.toFixed(1)}px`);
    if (g.on && (Math.abs(g.x - g.tx) > 0.3 || Math.abs(g.y - g.ty) > 0.3)) busy = true;
  }
  return busy;
}
const wake = () => addTick(tick);
function resetAll() {
  P.x = P.y = -1e4;
  mags.forEach((m) => { m.tx = m.ty = m.x = m.y = 0; if (m.face) m.face.style.transform = ''; });
  glows.forEach((g) => { g.on = false; g.el.classList.remove('is-on'); });
}

export function initMagnet() {
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !pointerFx()) return;
    P.x = e.clientX; P.y = e.clientY; P.moved = true;
    glows.forEach((g) => { if (g.on && g.r) { g.tx = e.clientX - g.r.left; g.ty = e.clientY - (g.r.top - (scrollY - g.r.sy)); } });
    wake();
  }, { passive: true });
  glows.forEach((g) => {
    g.sec.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse' || !pointerFx()) return;
      const r = g.sec.getBoundingClientRect(); g.r = { left: r.left, top: r.top, sy: scrollY };
      g.x = g.tx = e.clientX - r.left; g.y = g.ty = e.clientY - r.top; g.on = true; g.el.classList.add('is-on'); wake();
    });
    g.sec.addEventListener('pointerleave', () => { g.on = false; g.el.classList.remove('is-on'); });
  });
  // Clavier : remise à zéro immédiate, le focus ne bouge jamais.
  document.addEventListener('focusin', (e) => mags.forEach((m) => { if (m.el === e.target) { m.locked = true; m.x = m.y = m.tx = m.ty = 0; if (m.face) m.face.style.transform = ''; } }));
  document.addEventListener('focusout', (e) => mags.forEach((m) => { if (m.el === e.target) m.locked = false; }));
  document.addEventListener('keydown', () => mags.forEach((m) => { m.x = m.y = m.tx = m.ty = 0; if (m.face) m.face.style.transform = ''; }));
  addEventListener('resize', () => { measuredAt = 0; });
  addEventListener('blur', resetAll);
  onReducedChange(() => { if (!pointerFx()) resetAll(); });
}
