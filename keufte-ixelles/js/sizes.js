// Choix « Normal / Géant » (sandwichs) et « Boulghour / Batata hara » (assiettes) :
// boutons radio natifs (flèches, Tab, Espace), prix qui « roulent » vers la nouvelle valeur.
// Sans JS : chaque ligne affiche les deux prix en texte. Annonce polie du choix pour lecteurs d'écran.
import { reduced } from './prefs.js?v=3';

const EASE = 'cubic-bezier(.2,.8,.2,1)';

export function initSizes() {
  const stats = { switches: 0 };
  window.__sizes = stats;
  document.querySelectorAll('[data-sizes]').forEach((panel) => {
    const seg = panel.querySelector('[data-seg]');
    const status = panel.querySelector('[data-seg-status]');
    const prices = [...panel.querySelectorAll('.pr[data-a]')];
    if (!seg || !prices.length) return;
    // Mise en place : un seul prix affiché, dans un span animable
    prices.forEach((p) => { p.textContent = ''; const r = document.createElement('span'); r.className = 'roll'; p.append(r, ' €'); });
    const render = (key, animate, dir) => {
      prices.forEach((p, i) => {
        const roll = p.firstChild; const val = p.dataset[key];
        if (roll.textContent === val) return;
        roll.getAnimations().forEach((a) => a.cancel());
        roll.textContent = val;
        if (animate) roll.animate([{ transform: `translateY(${dir * 60}%)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 220, delay: i * 25, easing: EASE, fill: 'backwards' });
      });
    };
    seg.hidden = false;
    render(seg.querySelector('input:checked').value, false, 0);
    seg.addEventListener('change', (e) => {
      const key = e.target.value; stats.switches++;
      render(key, !reduced(), key === 'b' ? 1 : -1);
      if (status) status.textContent = `Preços exibidos: ${e.target.parentElement.textContent.trim()}`;
    });
  });
}
