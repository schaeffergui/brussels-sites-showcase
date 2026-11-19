// Carte : onglets accessibles (tablist/tab/tabpanel, tabindex itinérant, flèches avec bouclage,
// Origine/Fin), fondu enchaîné des photos, détails dépliables (aria-expanded).
// Les changements rapides annulent ou réorientent proprement les animations en cours.
import { prefs } from './prefs.js?v=8';

const EASE = 'cubic-bezier(.16,1,.3,1)';
const XFADE_MS = 560;

const tablist = document.querySelector('[role="tablist"]');
const tabs = [...tablist.querySelectorAll('[role="tab"]')];
const ink = tablist.querySelector('.tabs__ink');
const imgs = [...document.querySelectorAll('.xfade__img')];
const panelOf = (tab) => document.getElementById(tab.getAttribute('aria-controls'));
let current = tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0];
let xfadeAnim = null;

/* ---------- Pastille sous l'onglet actif (mesures groupées) ---------- */
let inkGeo = [];
function measureInk() {
  const base = tablist.getBoundingClientRect();
  inkGeo = tabs.map((t) => { const r = t.getBoundingClientRect(); return { x: r.left - base.left, w: r.width }; });
  placeInk();
}
function placeInk() {
  const g = inkGeo[tabs.indexOf(current)];
  if (!g) return;
  tablist.style.setProperty('--ink-x', `${g.x}px`);
  tablist.style.setProperty('--ink-w', `${g.w}px`);
}

/* ---------- Fondu enchaîné des photos ---------- */
function showMedia(key, animate) {
  const next = imgs.find((i) => i.dataset.media === key);
  // Une seule lecture groupée de l'état visuel actuel, puis écritures.
  const opac = imgs.map((i) => parseFloat(getComputedStyle(i).opacity) || 0);
  imgs.forEach((i) => i.getAnimations().forEach((a) => a.cancel()));
  if (xfadeAnim) { xfadeAnim.onfinish = null; xfadeAnim = null; }

  imgs.forEach((i) => i.classList.toggle('is-on', i === next));

  if (!animate) {
    imgs.forEach((i) => { i.style.opacity = ''; i.style.zIndex = ''; i.style.transform = ''; });
    return;
  }
  // Les couches déjà visibles restent figées dessous : jamais d'image vide pendant la transition.
  const order = imgs.map((i, k) => ({ i, o: opac[k] })).filter((x) => x.i !== next).sort((a, b) => a.o - b.o);
  order.forEach((x, k) => { x.i.style.opacity = String(x.o); x.i.style.zIndex = String(k + 1); x.i.style.transform = ''; });
  const from = opac[imgs.indexOf(next)];
  next.style.zIndex = String(imgs.length + 1);
  next.style.opacity = '1';
  xfadeAnim = next.animate(
    [{ opacity: from, transform: `scale(${(1.05 - from * 0.05).toFixed(3)})` }, { opacity: 1, transform: 'scale(1)' }],
    { duration: XFADE_MS, easing: EASE },
  );
  const anim = xfadeAnim;
  anim.onfinish = () => {
    if (anim !== xfadeAnim) return;
    imgs.forEach((i) => { i.style.opacity = ''; i.style.zIndex = ''; i.style.transform = ''; });
    xfadeAnim = null;
  };
}

/* ---------- Sélection ---------- */
function select(tab, { focus = false, animate = !prefs.reduce } = {}) {
  const changed = tab !== current;
  current = tab;
  tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    const panel = panelOf(t);
    panel.hidden = !on;
    panel.querySelectorAll('.item').forEach((it) => it.getAnimations().forEach((a) => a.cancel()));
  });
  placeInk();
  showMedia(tab.dataset.media, animate && changed);
  if (animate && changed) {
    panelOf(tab).querySelectorAll('.item, .panel__intro').forEach((it, k) => {
      it.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
        { duration: 420, delay: k * 45, easing: EASE, fill: 'backwards' });
    });
  }
  if (focus) tab.focus();
}

function onKey(e) {
  const i = tabs.indexOf(document.activeElement);
  if (i < 0) return;
  const map = {
    ArrowRight: (i + 1) % tabs.length, ArrowDown: (i + 1) % tabs.length,
    ArrowLeft: (i - 1 + tabs.length) % tabs.length, ArrowUp: (i - 1 + tabs.length) % tabs.length,
    Home: 0, End: tabs.length - 1,
  };
  if (!(e.key in map)) return;
  e.preventDefault();
  select(tabs[map[e.key]], { focus: true });
}

/* ---------- Détails dépliables ---------- */
function toggleDetails(btn) {
  const region = document.getElementById(btn.getAttribute('aria-controls'));
  const open = btn.getAttribute('aria-expanded') !== 'true';
  btn.setAttribute('aria-expanded', String(open));
  const running = region.getAnimations();
  const startH = running.length ? region.getBoundingClientRect().height : null;
  running.forEach((a) => a.cancel());

  if (prefs.reduce) { region.hidden = !open; return; }
  if (open) {
    region.hidden = false;
    const h = region.scrollHeight;
    region.animate([{ height: `${startH ?? 0}px`, opacity: startH ? 1 : 0 }, { height: `${h}px`, opacity: 1 }],
      { duration: 420, easing: EASE });
  } else {
    const h = startH ?? region.getBoundingClientRect().height;
    const a = region.animate([{ height: `${h}px`, opacity: 1 }, { height: '0px', opacity: 0 }],
      { duration: 320, easing: EASE });
    a.onfinish = () => { if (btn.getAttribute('aria-expanded') === 'false') region.hidden = true; };
  }
}

export function initMenu() {
  tabs.forEach((t) => t.addEventListener('click', () => select(t)));
  tablist.addEventListener('keydown', onKey);
  select(current, { animate: false });

  document.querySelector('.menu').classList.add('menu-ready');
  tablist.classList.add('tabs--ink');
  measureInk();
  if ('ResizeObserver' in window) new ResizeObserver(() => requestAnimationFrame(measureInk)).observe(tablist);
  document.fonts?.ready.then(measureInk);

  document.querySelectorAll('.item__toggle').forEach((b) => {
    document.getElementById(b.getAttribute('aria-controls')).hidden = b.getAttribute('aria-expanded') !== 'true';
    b.addEventListener('click', () => toggleDetails(b));
  });

  prefs.onChange((p) => {
    if (!p.reduce) return;
    // Passage au mouvement réduit : état final immédiat partout.
    showMedia(current.dataset.media, false);
    document.querySelectorAll('.item, .panel__intro, .item__details').forEach((el) => el.getAnimations().forEach((a) => a.finish()));
  });
}
