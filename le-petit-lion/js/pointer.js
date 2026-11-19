// Effets au pointeur fin (souris, trackpad) — désactivés en mouvement réduit et au toucher.
// • Lueur de filament qui suit le pointeur dans les sections sombres ([data-glow]).
// • Magnétisme : la « face » d'un bouton glisse de 6 px max quand le pointeur est à moins de 40 px ;
//   la zone cliquable et l'anneau de focus ne bougent pas ; remise à zéro immédiate au focus clavier.
// • Inclinaison ≤ 3° + reflet ambré, seulement sur une vraie photo (jamais un emplacement réservé).
// Lectures de géométrie groupées et espacées ; écritures dans la boucle partagée.
import { pointerFx, onReducedChange } from './prefs.js?v=3';
import { addTick } from './ticker.js?v=3';

const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, m) => Math.max(-m, Math.min(m, v));
const P = { x: -1e4, y: -1e4, moved: 0 };

/* ---------- Lueur ---------- */
const glows = [...document.querySelectorAll('[data-glow]')].map((sec) => ({ sec, el: sec.querySelector('.glow'), rect: null, x: 0, y: 0, tx: 0, ty: 0, on: false }));

/* ---------- Magnétisme ---------- */
const MAG = 6, ZONE = 40;
const mags = [...document.querySelectorAll('[data-magnetic]')].map((el) => ({ el, face: el.querySelector('.btn__face'), r: null, x: 0, y: 0, tx: 0, ty: 0, locked: false }));
let measuredAt = 0;
function measureMags(now) { // une lecture groupée, au plus toutes les 400 ms
  if (now - measuredAt < 400) return;
  measuredAt = now;
  const sy = window.scrollY;
  mags.forEach((m) => { const r = m.el.getBoundingClientRect(); m.r = { l: r.left, t: r.top + sy, w: r.width, h: r.height }; });
}

/* ---------- Inclinaison ---------- */
const TILT = 3;
const tilts = [...document.querySelectorAll('[data-tilt]')].map((el) => ({ el, rect: null, x: 0, y: 0, tx: 0, ty: 0, active: false }));
const isRealPhoto = (stage) => { const on = stage.querySelector('.is-on'); return !!on && !on.hasAttribute('data-placeholder') && !stage.classList.contains('is-missing'); };

function tick(now) {
  let busy = false;
  // Lueur
  glows.forEach((g) => {
    g.x = lerp(g.x, g.tx, 0.12); g.y = lerp(g.y, g.ty, 0.12);
    g.el.style.setProperty('--gx', `${g.x.toFixed(1)}px`); g.el.style.setProperty('--gy', `${g.y.toFixed(1)}px`);
    if (g.on && (Math.abs(g.x - g.tx) > 0.3 || Math.abs(g.y - g.ty) > 0.3)) busy = true;
  });
  // Magnétisme
  if (P.moved) measureMags(now);
  const sy = window.scrollY;
  mags.forEach((m) => {
    if (m.r && !m.locked) {
      const t = m.r.t - sy, cx = m.r.l + m.r.w / 2, cy = t + m.r.h / 2;
      const dx = Math.max(m.r.l - P.x, 0, P.x - (m.r.l + m.r.w)), dy = Math.max(t - P.y, 0, P.y - (t + m.r.h));
      const d = Math.hypot(dx, dy);
      const s = d < ZONE ? 1 - d / ZONE : 0;
      m.tx = clamp((P.x - cx) * 0.2, MAG) * s; m.ty = clamp((P.y - cy) * 0.35, MAG) * s;
    }
    m.x = lerp(m.x, m.tx, 0.2); m.y = lerp(m.y, m.ty, 0.2);
    const still = Math.abs(m.x) < 0.05 && Math.abs(m.y) < 0.05 && m.tx === 0 && m.ty === 0;
    m.face.style.transform = still ? '' : `translate3d(${m.x.toFixed(2)}px,${m.y.toFixed(2)}px,0)`;
    if (Math.abs(m.x - m.tx) > 0.05 || Math.abs(m.y - m.ty) > 0.05) busy = true;
  });
  // Inclinaison
  tilts.forEach((t) => {
    t.x = lerp(t.x, t.tx, 0.12); t.y = lerp(t.y, t.ty, 0.12);
    t.el.style.setProperty('--rx', `${t.y.toFixed(3)}deg`); t.el.style.setProperty('--ry', `${t.x.toFixed(3)}deg`);
    if (Math.abs(t.x - t.tx) > 0.01 || Math.abs(t.y - t.ty) > 0.01) busy = true;
  });
  if (P.moved) { P.moved = 0; busy = true; }
  return busy; // false → la boucle se désabonne : rien ne tourne au repos
}
const wake = () => addTick(tick);

function onMove(e) {
  if (e.pointerType !== 'mouse' || !pointerFx()) return;
  P.x = e.clientX; P.y = e.clientY; P.moved = 1;
  glows.forEach((g) => { if (g.on && g.rect) { g.tx = e.clientX - g.rect.left; g.ty = e.clientY - g.rect.top + (window.scrollY - g.rect.sy); } });
  tilts.forEach((t) => {
    if (!t.active || !t.rect) return;
    const px = (e.clientX - t.rect.left) / t.rect.width, py = (e.clientY - t.rect.top) / t.rect.height;
    t.tx = clamp((px - 0.5) * 2 * TILT, TILT); t.ty = clamp(-(py - 0.5) * 2 * TILT, TILT);
    t.el.style.setProperty('--sx', `${(px * 100).toFixed(1)}%`); t.el.style.setProperty('--sy', `${(py * 100).toFixed(1)}%`);
  });
  wake();
}

function resetAll(instant) {
  P.x = P.y = -1e4;
  mags.forEach((m) => { m.tx = m.ty = 0; if (instant) { m.x = m.y = 0; m.face.style.transform = ''; } });
  tilts.forEach((t) => { t.active = false; t.tx = t.ty = 0; t.el.classList.remove('is-tilting'); if (instant) { t.x = t.y = 0; t.el.style.removeProperty('--rx'); t.el.style.removeProperty('--ry'); } });
  glows.forEach((g) => { g.on = false; g.el.classList.remove('is-on'); });
  if (!instant) wake();
}

export function initPointer() {
  document.addEventListener('pointermove', onMove, { passive: true });
  glows.forEach((g) => {
    g.sec.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse' || !pointerFx()) return;
      const r = g.sec.getBoundingClientRect(); g.rect = { left: r.left, top: r.top, sy: window.scrollY };
      g.x = g.tx = e.clientX - r.left; g.y = g.ty = e.clientY - r.top;
      g.on = true; g.el.classList.add('is-on'); wake();
    });
    g.sec.addEventListener('pointerleave', () => { g.on = false; g.el.classList.remove('is-on'); });
  });
  tilts.forEach((t) => {
    t.el.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse' || !pointerFx() || !isRealPhoto(t.el)) return;
      t.rect = t.el.getBoundingClientRect(); t.active = true; t.el.classList.add('is-tilting');
    });
    t.el.addEventListener('pointerleave', () => { t.active = false; t.tx = t.ty = 0; t.el.classList.remove('is-tilting'); wake(); });
  });
  // Clavier : le focus n'est jamais déplacé par le magnétisme ; l'inclinaison revient à plat.
  document.addEventListener('focusin', (e) => {
    mags.forEach((m) => { if (m.el === e.target) { m.locked = true; m.tx = m.ty = m.x = m.y = 0; m.face.style.transform = ''; } });
    tilts.forEach((t) => { t.active = false; t.tx = t.ty = 0; t.el.classList.remove('is-tilting'); });
    wake();
  });
  document.addEventListener('focusout', (e) => mags.forEach((m) => { if (m.el === e.target) m.locked = false; }));
  document.addEventListener('keydown', () => mags.forEach((m) => { m.tx = m.ty = m.x = m.y = 0; m.face.style.transform = ''; }));
  window.addEventListener('blur', () => resetAll(true));
  window.addEventListener('resize', () => { measuredAt = 0; });
  onReducedChange(() => { if (!pointerFx()) resetAll(true); });
  window.__lionPointer = { mags, tilts, glows };
}
