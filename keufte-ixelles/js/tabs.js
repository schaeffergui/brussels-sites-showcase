// Catégories de la carte : onglets accessibles (tablist/tab/tabpanel), tabindex itinérant,
// flèches avec bouclage, Origine/Fin. Géométrie stable (panneaux empilés), fondu court
// interruptible ; sans JS, toutes les catégories restent affichées.
import { reduced, onReducedChange } from './prefs.js?v=3';

export function initTabs() {
  const list = document.querySelector('[data-tabs] [role="tablist"]');
  if (!list) return;
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  const panel = (t) => document.getElementById(t.getAttribute('aria-controls'));
  let current = tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0];

  function select(tab, focus) {
    const changed = tab !== current; current = tab;
    tabs.forEach((t) => {
      const on = t === tab; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
      const p = panel(t); p.getAnimations().forEach((a) => a.cancel()); p.hidden = !on;
    });
    if (changed && !reduced()) panel(tab).animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
    if (focus) tab.focus();
  }
  tabs.forEach((t) => t.addEventListener('click', () => select(t)));
  list.addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement); if (i < 0) return; const n = tabs.length;
    const to = { ArrowRight: (i + 1) % n, ArrowDown: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, ArrowUp: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
    if (to === undefined) return; e.preventDefault(); select(tabs[to], true);
  });
  document.querySelector('[data-tabs]').classList.add('tabs-ready');
  select(current);
  onReducedChange((r) => { if (r) tabs.forEach((t) => panel(t).getAnimations().forEach((a) => a.finish())); });
}
