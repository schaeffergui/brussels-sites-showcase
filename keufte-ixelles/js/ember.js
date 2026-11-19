// Braises décoratives (Canvas 2D) dans le bandeau « grill ». aria-hidden, pointer-events:none.
// Pointeur fin uniquement : la vitesse du pointeur (bornée) attise les braises, puis tout
// retombe par amortissement et la boucle s'arrête. ≤ 36 particules, DPR ≤ 1,5, pas ≤ 33 ms.
// Pause hors écran / onglet masqué ; désactivé si les images ralentissent ou en mouvement réduit.
import { reduced, pointerFx, onReducedChange } from './prefs.js?v=3';
import { addTick, removeTick } from './ticker.js?v=3';

const MAX_P = 36, DPR_CAP = 1.5, DT_MAX = 33, VMAX = 900, HEAT_DECAY = 2.2;

export function initEmber() {
  const box = document.querySelector('[data-ember]');
  const canvas = box?.querySelector('canvas');
  const ctx = canvas?.getContext('2d');
  if (!box || !ctx) return;
  let w = 0, h = 0, dpr = 1, visible = false, running = false, disabled = false, heat = 0;
  let parts = [];
  let last = { x: 0, t: 0 };
  let slow = 0, frames = 0;
  const stats = { steps: 0, wakes: 0, disabledForPerf: false };
  window.__ember = { stats, get running() { return running; }, get count() { return parts.length; }, get dpr() { return dpr; }, get heat() { return heat; } };

  const enabled = () => !disabled && !reduced();
  let puffed = false; // une bouffée de braises à la première apparition (tout pointeur), puis au pointeur fin seulement
  function layout() {
    const r = box.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, DPR_CAP);
    w = r.width; h = r.height; canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const spawn = () => ({ x: Math.random() * w, y: h + 4, vx: (Math.random() - .5) * 20, vy: -(30 + Math.random() * 60), life: 1, r: 1 + Math.random() * 2 });

  function step(t, dtMs) {
    if (!visible || !enabled()) { stop(); return false; }
    const dt = Math.min(dtMs, DT_MAX) / 1000; stats.steps++;
    frames++; if (dtMs > 28) slow++;
    if (frames >= 60) { if (slow > 20) { disabled = true; stats.disabledForPerf = true; stop(); return false; } frames = slow = 0; }
    heat = Math.max(0, heat - HEAT_DECAY * dt);
    const want = Math.min(MAX_P, Math.round(heat * MAX_P));
    while (parts.length < want) parts.push(spawn());
    ctx.clearRect(0, 0, w, h);
    parts = parts.filter((p) => {
      p.vx *= 1 - 1.5 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 0.8;
      if (p.life <= 0 || p.y < -6) return false;
      ctx.fillStyle = `rgba(255,${120 + Math.round(p.life * 80)},60,${(p.life * 0.85).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill(); return true;
    });
    if (heat === 0 && parts.length === 0) { ctx.clearRect(0, 0, w, h); running = false; return false; } // retombé : arrêt
    return true;
  }
  function wake() { if (running || !visible || !enabled()) return; running = true; stats.wakes++; addTick(step); }
  function stop() { running = false; removeTick(step); parts = []; ctx.clearRect(0, 0, w, h); }

  box.closest('section').addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !pointerFx() || !enabled()) return;
    const now = performance.now(); const dt = Math.max(8, now - last.t);
    const v = Math.min(VMAX, Math.abs(e.clientX - last.x) / dt * 1000); // vitesse bornée
    last = { x: e.clientX, t: now };
    heat = Math.min(1, heat + v / VMAX * 0.12);
    wake();
  }, { passive: true });
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting; if (!visible) { stop(); return; }
    if (!puffed && enabled()) { puffed = true; heat = 0.5; wake(); }
  }, { threshold: 0.4 }).observe(box);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  addEventListener('resize', layout);
  onReducedChange(() => { if (!enabled()) stop(); });
  layout();
}
