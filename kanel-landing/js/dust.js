// Couche décorative : poussière de cannelle / vapeur de café derrière le texte de l'ouverture.
// aria-hidden + pointer-events:none. Omise si mouvement réduit ou pointeur grossier (tactile).
// En pause hors écran ou onglet masqué ; nombre de particules réduit si les images ralentissent.
import { prefs } from './prefs.js?v=8';
import { addTick, removeTick } from './ticker.js?v=8';

const canvas = document.querySelector('[data-dust]');
const host = canvas?.closest('section');
const ctx = canvas?.getContext('2d', { alpha: true });
const DPR_CAP = 1.5;
const COLORS = ['231,185,140', '247,238,225', '196,128,74'];

let parts = [];
let w = 0, h = 0, dpr = 1;
let running = false, inView = false, active = false;
let pointer = { x: -1e4, y: -1e4 };
let rect = null;
let slowFrames = 0, frames = 0, budgetCut = 0;

const shouldRun = () => !prefs.reduce && prefs.finePointer;

function resize() {
  const r = host.getBoundingClientRect();
  rect = { left: r.left, docTop: r.top + window.scrollY };
  dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
  w = Math.round(r.width); h = Math.round(r.height);
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const target = Math.max(18, Math.min(80, Math.round((w * h) / 16000))) >> budgetCut;
  while (parts.length < target) parts.push(spawn(true));
  parts.length = Math.max(12, target);
}

function spawn(anywhere) {
  return {
    x: Math.random() * w, y: anywhere ? Math.random() * h : h + 10,
    r: 0.6 + Math.random() * 1.8, vy: 6 + Math.random() * 14, sway: 6 + Math.random() * 14,
    ph: Math.random() * Math.PI * 2, a: 0.15 + Math.random() * 0.45,
    c: COLORS[(Math.random() * COLORS.length) | 0], ox: 0, oy: 0,
  };
}

function draw(t, dt) {
  // Surveillance du coût : si les images dépassent ~24 ms trop souvent, on divise les particules.
  frames++; if (dt > 24) slowFrames++;
  if (frames >= 90) {
    if (slowFrames > 20) {
      if (budgetCut < 2) { budgetCut++; resize(); } else { stop(); return; }
    }
    frames = 0; slowFrames = 0;
  }
  const s = dt / 1000;
  ctx.clearRect(0, 0, w, h);
  for (const p of parts) {
    p.y -= p.vy * s;
    p.ph += s * 0.6;
    const x = p.x + Math.sin(p.ph) * p.sway;
    // Influence bornée du pointeur (rayon 140 px, décalage max 18 px)
    const dx = x - pointer.x, dy = p.y - pointer.y; const d2 = dx * dx + dy * dy;
    if (d2 < 19600) { const f = (1 - Math.sqrt(d2) / 140) * 18; const d = Math.sqrt(d2) || 1; p.ox += ((dx / d) * f - p.ox) * 0.08; p.oy += ((dy / d) * f - p.oy) * 0.08; }
    else { p.ox *= 0.94; p.oy *= 0.94; }
    if (p.y < -12) Object.assign(p, spawn(false));
    const fade = Math.min(1, p.y / (h * 0.35));
    ctx.fillStyle = `rgba(${p.c},${(p.a * fade).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(x + p.ox, p.y + p.oy, p.r, 0, 6.2832); ctx.fill();
  }
}

function start() {
  if (running || !inView || document.hidden || !active) return;
  running = true; addTick(draw);
}
function stop() { running = false; removeTick(draw); }

function onPointer(e) {
  if (!rect) return;
  // Pas de lecture de mise en page ici : position du document mise en cache au redimensionnement.
  pointer.x = e.clientX - rect.left; pointer.y = e.clientY - (rect.docTop - window.scrollY);
}

function setActive() {
  const want = shouldRun();
  if (want === active) return;
  active = want;
  canvas.classList.toggle('is-on', want);
  if (want) {
    resize(); start();
    host.addEventListener('pointermove', onPointer, { passive: true });
  } else {
    stop(); parts = []; ctx.clearRect(0, 0, w, h);
    host.removeEventListener('pointermove', onPointer);
  }
}

export function initDust() {
  if (!canvas || !ctx) return;
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; inView ? start() : stop(); }).observe(host);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  window.addEventListener('resize', () => { if (active) resize(); });
  setActive();
  prefs.onChange(setActive);
  window.__kanelDust = { get count() { return parts.length; }, get running() { return running; }, get active() { return active; }, get dpr() { return dpr; } };
}
