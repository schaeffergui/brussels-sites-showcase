// Effets au pointeur fin uniquement (souris, trackpad) : inclinaison des photos, boutons
// magnétiques et petit curseur décoratif. Le curseur natif reste toujours visible.
// Géométrie mesurée à l'entrée du pointeur (pas à chaque mouvement) ; écritures dans la boucle partagée.
import { prefs } from './prefs.js?v=8';
import { addTick, removeTick } from './ticker.js?v=8';

const root = document.documentElement;
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, m) => Math.max(-m, Math.min(m, v));
const enabled = () => prefs.finePointer && !prefs.reduce;

/* ---------- Inclinaison + reflet (≈ 3° max) ---------- */
const TILT_MAX = 3;
const tilts = [...document.querySelectorAll('[data-tilt]')].map((el) => ({ el, rect: null, tx: 0, ty: 0, x: 0, y: 0, sx: 50, sy: 50, active: false }));

function tiltTick() {
  let moving = false;
  tilts.forEach((t) => {
    t.x = lerp(t.x, t.tx, 0.12); t.y = lerp(t.y, t.ty, 0.12);
    if (Math.abs(t.x - t.tx) > 0.01 || Math.abs(t.y - t.ty) > 0.01 || t.active) moving = true;
    t.el.style.setProperty('--rx', `${t.y.toFixed(3)}deg`);
    t.el.style.setProperty('--ry', `${t.x.toFixed(3)}deg`);
    t.el.style.setProperty('--sx', `${t.sx.toFixed(1)}%`);
    t.el.style.setProperty('--sy', `${t.sy.toFixed(1)}%`);
  });
  if (!moving) removeTick(tiltTick);
}

function resetTilt(t) {
  t.active = false; t.tx = 0; t.ty = 0; t.el.classList.remove('is-tilting'); addTick(tiltTick);
}

tilts.forEach((t) => {
  t.el.addEventListener('pointerenter', (e) => {
    if (!enabled() || e.pointerType !== 'mouse') return;
    t.rect = t.el.getBoundingClientRect(); t.active = true; t.el.classList.add('is-tilting');
  });
  t.el.addEventListener('pointermove', (e) => {
    if (!t.active || !t.rect) return;
    const px = (e.clientX - t.rect.left) / t.rect.width; const py = (e.clientY - t.rect.top) / t.rect.height;
    t.tx = clamp((px - 0.5) * 2 * TILT_MAX, TILT_MAX);
    t.ty = clamp(-(py - 0.5) * 2 * TILT_MAX, TILT_MAX);
    t.sx = px * 100; t.sy = py * 100;
    addTick(tiltTick);
  });
  t.el.addEventListener('pointerleave', () => resetTilt(t));
});

/* ---------- Boutons magnétiques (≈ 6 px max, zone cliquable immobile) ---------- */
const MAG_MAX = 6;
const mags = [...document.querySelectorAll('[data-magnetic]')].map((el) => ({ el, face: el.querySelector('.btn__face'), rect: null, tx: 0, ty: 0, x: 0, y: 0, active: false }));

function magTick() {
  let moving = false;
  mags.forEach((m) => {
    m.x = lerp(m.x, m.tx, 0.18); m.y = lerp(m.y, m.ty, 0.18);
    if (Math.abs(m.x - m.tx) > 0.02 || Math.abs(m.y - m.ty) > 0.02) moving = true;
    m.face.style.transform = (Math.abs(m.x) < 0.02 && Math.abs(m.y) < 0.02 && !m.active) ? '' : `translate3d(${m.x.toFixed(2)}px, ${m.y.toFixed(2)}px, 0)`;
  });
  if (!moving) removeTick(magTick);
}
function resetMag(m, instant) {
  m.active = false; m.tx = 0; m.ty = 0;
  if (instant) { m.x = 0; m.y = 0; m.face.style.transform = ''; } else addTick(magTick);
}

mags.forEach((m) => {
  m.el.addEventListener('pointerenter', (e) => {
    if (!enabled() || e.pointerType !== 'mouse') return;
    m.rect = m.el.getBoundingClientRect(); m.active = true;
  });
  m.el.addEventListener('pointermove', (e) => {
    if (!m.active || !m.rect) return;
    const cx = m.rect.left + m.rect.width / 2; const cy = m.rect.top + m.rect.height / 2;
    m.tx = clamp((e.clientX - cx) * 0.22, MAG_MAX); m.ty = clamp((e.clientY - cy) * 0.35, MAG_MAX);
    addTick(magTick);
  });
  m.el.addEventListener('pointerleave', () => resetMag(m));
});

/* Le focus clavier n'est jamais déplacé par le magnétisme : remise à zéro immédiate. */
document.addEventListener('focusin', (e) => {
  mags.forEach((m) => { if (m.el === e.target || m.active) resetMag(m, true); });
  tilts.forEach((t) => { if (t.active) resetTilt(t); });
});
window.addEventListener('blur', () => { mags.forEach((m) => resetMag(m, true)); tilts.forEach(resetTilt); });

/* ---------- Curseur décoratif (bureau, pointeur fin, mouvement permis) ---------- */
const cursor = document.querySelector('.cursor');
const cur = { x: -100, y: -100, tx: -100, ty: -100, s: 1, ts: 1, on: false };

function cursorTick() {
  cur.x = lerp(cur.x, cur.tx, 0.22); cur.y = lerp(cur.y, cur.ty, 0.22); cur.s = lerp(cur.s, cur.ts, 0.2);
  cursor.style.setProperty('--cx', `${cur.x.toFixed(1)}px`);
  cursor.style.setProperty('--cy', `${cur.y.toFixed(1)}px`);
  cursor.style.setProperty('--cs', cur.s.toFixed(3));
  if (Math.abs(cur.x - cur.tx) < 0.1 && Math.abs(cur.y - cur.ty) < 0.1 && Math.abs(cur.s - cur.ts) < 0.01) removeTick(cursorTick);
}
function onMove(e) {
  if (e.pointerType !== 'mouse') return;
  cur.tx = e.clientX; cur.ty = e.clientY;
  if (!cur.on) { cur.x = cur.tx; cur.y = cur.ty; cur.on = true; cursor.classList.add('is-visible'); }
  addTick(cursorTick);
}
function onOver(e) {
  const link = e.target.closest('a,button,[role="tab"]');
  cursor.classList.toggle('is-link', !!link); cur.ts = link ? 1.5 : 1; addTick(cursorTick);
}
function onLeave() { cur.on = false; cursor.classList.remove('is-visible'); }

function setCursor() {
  const want = enabled() && prefs.desktop;
  root.classList.toggle('has-cursor', want);
  if (want) {
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerover', onOver, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
  } else {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerover', onOver);
    document.documentElement.removeEventListener('pointerleave', onLeave);
    onLeave(); removeTick(cursorTick);
  }
}

export function initPointer() {
  setCursor();
  prefs.onChange(() => {
    setCursor();
    if (!enabled()) {
      mags.forEach((m) => resetMag(m, true));
      tilts.forEach((t) => { resetTilt(t); t.x = t.y = 0; t.el.style.removeProperty('--rx'); t.el.style.removeProperty('--ry'); });
    }
  });
}
