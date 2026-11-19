// Sélecteur de scènes : onglets accessibles (Le bar / Billard / Baby-foot).
// Fondu enchaîné 560 ms avec une petite variation d'échelle (1,04 → 1).
// La dernière image affichée reste dessous jusqu'à ce que la suivante soit décodée ;
// une sélection plus récente annule la précédente (jeton), sans accumuler d'animations.
// Distorsion locale : non retenue (voir README), fondu net uniquement.
import { reduced, onReducedChange } from './prefs.js?v=3';

const EASE = 'cubic-bezier(.22,.8,.3,1)';
const XFADE_MS = 560;

export function initScenes() {
  const root = document.querySelector('[data-scenes]');
  if (!root) return;
  const tablist = root.querySelector('[role="tablist"]');
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];
  const imgs = [...root.querySelectorAll('[data-scene-img]')];
  const stage = root.querySelector('.stage');
  const panelOf = (t) => document.getElementById(t.getAttribute('aria-controls'));
  let current = tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0];
  let fade = null;
  let token = 0;
  const stats = { started: 0, completed: 0, superseded: 0, decodeFailures: 0 };
  window.__lionScenes = stats;

  imgs.forEach((img) => img.addEventListener('error', () => { img.dataset.missing = '1'; syncMissing(); }));
  const imgOf = (key) => imgs.find((i) => i.dataset.sceneImg === key);
  function syncMissing() {
    const on = imgOf(current.dataset.scene);
    stage.classList.toggle('is-missing', !!(on && on.dataset.missing));
  }

  function clearInline() { imgs.forEach((i) => { i.style.opacity = ''; i.style.zIndex = ''; i.style.transform = ''; }); }

  async function showImage(key, animate) {
    const next = imgOf(key);
    const my = ++token;
    if (!animate) {
      imgs.forEach((i) => i.getAnimations().forEach((a) => a.cancel()));
      if (fade) { fade.onfinish = null; fade = null; }
      imgs.forEach((i) => i.classList.toggle('is-on', i === next));
      clearInline(); syncMissing(); return;
    }
    // Attendre le décodage : rien ne change à l'écran tant que l'image suivante n'est pas prête.
    try { if (next.decode) await next.decode(); } catch (_) { next.dataset.missing = '1'; stats.decodeFailures++; }
    if (my !== token) { stats.superseded++; return; } // une sélection plus récente a pris la main
    const opac = imgs.map((i) => parseFloat(getComputedStyle(i).opacity) || 0); // lecture groupée
    imgs.forEach((i) => i.getAnimations().forEach((a) => a.cancel()));
    if (fade) { fade.onfinish = null; fade = null; }
    imgs.forEach((i) => i.classList.toggle('is-on', i === next));
    syncMissing();
    // Couches déjà visibles figées dessous : jamais d'image vide pendant le fondu.
    imgs.filter((i) => i !== next).map((i) => ({ i, o: opac[imgs.indexOf(i)] }))
      .sort((a, b) => a.o - b.o)
      .forEach((x, k) => { x.i.style.opacity = String(x.o); x.i.style.zIndex = String(k + 1); x.i.style.transform = ''; });
    const from = opac[imgs.indexOf(next)];
    next.style.zIndex = String(imgs.length + 1);
    next.style.opacity = '1';
    stats.started++;
    const a = next.animate(
      [{ opacity: from, transform: `scale(${(1.04 - from * 0.04).toFixed(3)})` }, { opacity: 1, transform: 'scale(1)' }],
      { duration: XFADE_MS, easing: EASE });
    fade = a;
    a.onfinish = () => { if (a !== fade) return; clearInline(); fade = null; stats.completed++; };
  }

  // Crédit de la photo affichée (auteur visible sur Google Maps)
  const creditEl = root.querySelector('[data-scene-credit]');
  const CREDITS = { bar: 'O balcão. Imagem placeholder demonstrativo.' };
  function select(tab, { focus = false } = {}) {
    const changed = tab !== current;
    current = tab;
    if (creditEl && CREDITS[tab.dataset.scene]) creditEl.textContent = CREDITS[tab.dataset.scene];
    const animate = changed && !reduced();
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const p = panelOf(t);
      p.getAnimations().forEach((x) => x.cancel());
      p.hidden = !on;
    });
    showImage(tab.dataset.scene, animate);
    if (animate) panelOf(tab).animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: EASE });
    if (focus) tab.focus();
  }

  tabs.forEach((t) => t.addEventListener('click', () => select(t)));
  tablist.addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const n = tabs.length;
    const to = { ArrowRight: (i + 1) % n, ArrowDown: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, ArrowUp: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    select(tabs[to], { focus: true });
  });

  select(current);
  root.classList.add('scenes-ready');
  onReducedChange((r) => {
    if (!r) return;
    showImage(current.dataset.scene, false);
    tabs.forEach((t) => panelOf(t).getAnimations().forEach((x) => x.finish()));
  });
}
