// Carrousel « Sur le comptoir » — défilement continu, lent et fluide.
// Sans JS : liste à défilement horizontal natif ; chaque photo est un lien vers l'image agrandie.
// Avec JS :
// - La liste est placée dans une fenêtre (overflow:hidden) et translatée (transform) : vitesse en
//   px/s indépendante du nombre d'images par seconde (pas de temps borné), une seule boucle rAF
//   partagée (ticker.js), arrêtée dès que rien ne bouge.
// - Boucle sans saut : une copie des 6 photos suit les originales ; la position est ramenée modulo
//   la largeur d'une série (l'image affichée est identique au même endroit).
// - Glisser direct (souris, doigt, stylet) avec inertie amortie ; seuil de 8 px horizontal avant de
//   « prendre » le geste (un geste vertical laisse défiler la page : touch-action pan-y pinch-zoom).
//   Le clic n'est annulé qu'après un vrai glisser.
// - Chaque photo (originale ou copie visible) s'ouvre dans une visionneuse <dialog> ; les copies
//   délèguent à l'originale (pas de tabindex, pas d'id, aria-hidden, mais cliquables).
// - Arrêt doux au survol, au focus dans la section et visionneuse ouverte ; arrêt hors écran /
//   onglet masqué ; interrupteur « Défilement automatique » (mémorisé pour la session).
// - Mouvement réduit : pas de défilement automatique au départ, arrêt immédiat si activé en cours,
//   navigation (flèches) instantanée.
import { reduced, onReducedChange } from './prefs.js?v=3';
import { addTick, removeTick } from './ticker.js?v=3';

const SPEED = 34;          // px/s en défilement automatique
const EASE_IN = 2.2;       // 1/s : montée progressive vers la vitesse automatique
const EASE_STOP = 9;       // 1/s : arrêt doux (survol, focus)
const FRICTION = 4.2;      // 1/s : amortissement de l'inertie après glisser
const VMAX = 2600;         // px/s : inertie maximale
const KEY = 'keufte-strip-auto';

export function initStrip() {
  const track = document.querySelector('[data-strip]');
  if (!track || !track.animate) return;
  const section = track.closest('section');
  const nav = section.querySelector('[data-strip-nav]');
  const prev = section.querySelector('[data-strip-prev]');
  const next = section.querySelector('[data-strip-next]');
  const status = section.querySelector('[data-strip-status]');
  const autoBox = section.querySelector('[data-strip-auto]');
  const autoInput = autoBox?.querySelector('input');
  const originals = [...track.children];
  const N = originals.length;
  if (N < 2) return;

  // ---- mise en place ----
  const viewport = document.createElement('div');
  viewport.className = 'strip__viewport';
  track.before(viewport); viewport.append(track);
  originals.forEach((li, i) => {
    li.querySelector('.shot__open').dataset.index = i;
    li.classList.remove('is-pending');
    const img = li.querySelector('img'); img.loading = 'eager'; img.draggable = false;
  });
  originals.forEach((li) => {
    const c = li.cloneNode(true);
    c.classList.add('is-clone'); c.setAttribute('aria-hidden', 'true');
    c.querySelectorAll('[id]').forEach((e) => e.removeAttribute('id'));
    c.querySelectorAll('a').forEach((a) => a.setAttribute('tabindex', '-1'));
    c.querySelectorAll('img').forEach((im) => { im.alt = ''; });
    track.append(c);
  });
  const links = originals.map((li) => li.querySelector('.shot__open'));

  let step = 0, setW = 0, vw = 0;
  const measure = () => {
    step = track.children[1].offsetLeft - track.children[0].offsetLeft;
    setW = track.children[N].offsetLeft - track.children[0].offsetLeft; // = N × pas
    vw = viewport.clientWidth;
  };
  measure();

  // ---- état ----
  let x = 0, v = 0, running = false, visible = false, hover = false, focusIn = false, dialogOpen = false;
  let tween = null, drag = null, suppressClick = false, manualUntil = 0, manualT = 0;
  let autoOn = !reduced() && sessionStorage.getItem(KEY) !== '0';
  const stats = { frames: 0, wraps: 0, drags: 0, clicks: 0, maxDt: 0 };
  window.__strip = { stats, get x() { return x; }, get v() { return v; }, get running() { return running; }, get auto() { return autoOn; },
    index: () => Math.round(wrap(x) / step) % N, get setW() { return setW; }, get step() { return step; } };

  function wrap(val) { return ((val % setW) + setW) % setW; }
  function render() { track.style.transform = `translate3d(${-x}px,0,0)`; }
  const held = () => hover || focusIn || dialogOpen || !visible || document.hidden;
  const wantAuto = () => autoOn && !reduced() && !held() && performance.now() >= manualUntil;
  // Après une action manuelle (flèche, glisser), le défilement auto attend 5 s avant de repartir doucement
  const holdManual = () => { manualUntil = performance.now() + 5000; clearTimeout(manualT); manualT = setTimeout(sync, 5050); };

  // ---- boucle (une seule, via le planificateur partagé) ----
  function tick(t, dtMs) {
    const dt = Math.min(dtMs, 50) / 1000; stats.frames++; if (dtMs > stats.maxDt) stats.maxDt = dtMs;
    if (drag && drag.on) { render(); return true; }
    if (tween) {
      const k = Math.min(1, (performance.now() - tween.t0) / tween.d), e = 1 - Math.pow(1 - k, 3); // temps réel
      x = tween.from + (tween.to - tween.from) * e;
      if (k >= 1) { tween = null; v = 0; }
    } else {
      const goal = wantAuto() ? SPEED : 0;
      if (Math.abs(v) > SPEED * 1.05) v *= Math.exp(-FRICTION * dt);                 // inertie qui s'amortit
      else v += (goal - v) * (1 - Math.exp(-(goal > Math.abs(v) ? EASE_IN : EASE_STOP) * dt));
      if (Math.abs(v) < 0.5 && goal === 0) v = 0;
      x += v * dt;
    }
    if (x < 0 || x >= setW) { const w = wrap(x); stats.wraps++; if (tween) { tween.from += w - x; tween.to += w - x; } x = w; }
    render();
    if (!tween && v === 0 && !wantAuto()) { running = false; return false; }
    return true;
  }
  function wake() { if (running) return; running = true; addTick(tick); }
  // Outil de test : simule `seconds` de défilement à `dtMs` par image (vérifie la boucle et
  // l'indépendance vis-à-vis du nombre d'images par seconde). N'est pas utilisé par la page.
  window.__strip.simulate = (seconds, dtMs) => {
    const w0 = stats.wraps, x0 = x; let dist = 0, prevX = x, maxStep = 0;
    for (let t = 0; t < seconds * 1000; t += dtMs) {
      tick(0, dtMs); let d = x - prevX; if (d < -setW / 2) d += setW; dist += d; maxStep = Math.max(maxStep, Math.abs(d)); prevX = x;
    }
    return { dist: Math.round(dist), wraps: stats.wraps - w0, maxStepPx: +maxStep.toFixed(2), from: Math.round(x0), to: Math.round(x) };
  };
  function sync() { if (wantAuto() || v !== 0 || tween) wake(); }

  // ---- navigation ----
  function goTo(target, instant) {
    if (instant || reduced()) { tween = null; v = 0; x = wrap(target); render(); return; }
    v = 0; tween = { from: x, to: target, t0: performance.now(), d: 480 }; wake();
  }
  const announce = () => { if (status) status.textContent = `Foto ${window.__strip.index() + 1} de ${N}`; };
  function stepBy(dir) {
    const base = tween ? tween.to : x;
    const k = Math.round(base / step) + (dir > 0 ? 1 : -1);   // photo voisine de la plus proche
    holdManual(); goTo(k * step); setTimeout(announce, reduced() ? 0 : 500);
  }
  nav.hidden = false;
  prev.addEventListener('click', () => stepBy(-1));
  next.addEventListener('click', () => stepBy(1));

  // ---- glisser + inertie ----
  viewport.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x0: x, on: false, samples: [[e.timeStamp, e.clientX]] };
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.on) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { drag = null; return; } // geste vertical : page
      if (Math.abs(dx) < 8) return;                                                  // seuil d'intention
      drag.on = true; stats.drags++; tween = null; v = 0;
      viewport.classList.add('is-dragging');
      try { viewport.setPointerCapture(e.pointerId); } catch (_) {}
      wake();
    }
    x = drag.x0 - dx; if (x < 0 || x >= setW) { const w = wrap(x); drag.x0 += w - x; x = w; stats.wraps++; }
    drag.samples.push([e.timeStamp, e.clientX]); if (drag.samples.length > 6) drag.samples.shift();
  });
  function endDrag(e, cancelled) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const d = drag; drag = null;
    viewport.classList.remove('is-dragging');
    try { viewport.releasePointerCapture(d.id); } catch (_) {}
    if (!d.on) return;
    holdManual();
    suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);           // seulement après un vrai glisser
    if (!cancelled && !reduced()) {
      const [t0, x0] = d.samples[0], [t1, x1] = d.samples[d.samples.length - 1];
      const vel = t1 > t0 ? -(x1 - x0) / ((t1 - t0) / 1000) : 0;
      v = Math.max(-VMAX, Math.min(VMAX, vel));
    }
    wake();
  }
  viewport.addEventListener('pointerup', (e) => endDrag(e, false));
  viewport.addEventListener('pointercancel', (e) => endDrag(e, true));
  viewport.addEventListener('lostpointercapture', (e) => { if (drag && drag.on && e.pointerId === drag.id) endDrag(e, false); });
  viewport.addEventListener('dragstart', (e) => e.preventDefault());

  // ---- sélection (clic, toucher, Entrée) → visionneuse ----
  viewport.addEventListener('click', (e) => {
    const a = e.target.closest('.shot__open'); if (!a) return;
    if (suppressClick) { e.preventDefault(); e.stopPropagation(); return; }
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return; // ouvrir dans un onglet reste possible
    e.preventDefault(); stats.clicks++;
    openViewer(+a.dataset.index);
  }, true);

  // ---- focus : arrêt + photo amenée dans la fenêtre (sans que le défilement auto déplace le focus) ----
  viewport.addEventListener('scroll', () => { viewport.scrollLeft = 0; });       // jamais de défilement natif caché
  section.addEventListener('focusin', (e) => {
    focusIn = true;
    const a = e.target.closest?.('.shot__open');
    if (a && !a.closest('.is-clone')) {
      viewport.scrollLeft = 0;
      const i = +a.dataset.index, left = i * step, cardW = a.offsetWidth;
      const cur = tween ? tween.to : x;
      const inView = left >= cur + 4 && left + cardW <= cur + vw - 4;
      if (!inView) goTo(Math.max(0, left - Math.max(0, (vw - cardW) / 2)));
    }
    sync();
  });
  section.addEventListener('focusout', (e) => { if (!section.contains(e.relatedTarget)) { focusIn = false; sync(); } });
  section.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { hover = true; } });
  viewport.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hover = true; });
  viewport.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { hover = false; sync(); } });
  section.addEventListener('pointerleave', () => { hover = false; sync(); });

  // ---- visibilité ----
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; sync(); }, { threshold: 0.15 }).observe(viewport);
  document.addEventListener('visibilitychange', sync);
  addEventListener('resize', () => { const i = Math.round(x / step); measure(); x = wrap(i * step); render(); });

  // ---- interrupteur ----
  if (autoBox && autoInput) {
    autoBox.hidden = false; autoInput.checked = autoOn;
    autoInput.addEventListener('change', () => {
      autoOn = autoInput.checked; sessionStorage.setItem(KEY, autoOn ? '1' : '0');
      if (status) status.textContent = autoOn ? 'Rolagem automática ativada' : 'Rolagem automática desativada';
      sync();
    });
  }
  onReducedChange((r) => {
    if (!r) return;
    autoOn = false; if (autoInput) autoInput.checked = false;
    tween = null; v = 0; if (drag) drag = null; viewport.classList.remove('is-dragging');
    removeTick(tick); running = false; render();
  });

  // ---- visionneuse ----
  const dlg = document.querySelector('[data-viewer]');
  let vIndex = 0, opener = null, token = 0;
  const vImg = dlg?.querySelector('.viewer__img'), vFrame = dlg?.querySelector('.viewer__frame');
  const vCap = dlg?.querySelector('[data-viewer-cap]'), vPos = dlg?.querySelector('[data-viewer-pos]');
  const cache = new Map();
  const load = (url) => {
    if (!cache.has(url)) cache.set(url, new Promise((res) => { const im = new Image(); im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => res(true)); im.onerror = () => { cache.delete(url); res(false); }; im.src = url; }));
    return cache.get(url);
  };
  function show(i) {
    vIndex = ((i % N) + N) % N; const a = links[vIndex], my = ++token;
    vCap.textContent = a.dataset.caption; vPos.textContent = `${vIndex + 1} / ${N}`;
    vImg.alt = a.querySelector('img').alt; vFrame.classList.remove('is-missing');
    load(a.href).then((ok) => { if (my !== token) return; if (ok) vImg.src = a.href; else vFrame.classList.add('is-missing'); });
    [vIndex - 1, vIndex + 1].forEach((k) => load(links[((k % N) + N) % N].href));
  }
  function openViewer(i) {
    if (!dlg || typeof dlg.showModal !== 'function') { location.href = links[i].href; return; }
    opener = links[i]; dialogOpen = true; sync();
    document.body.classList.add('has-viewer');
    dlg.showModal(); show(i); dlg.querySelector('[data-viewer-close]').focus();
  }
  function cleanup() {
    if (!dialogOpen) return;
    dialogOpen = false; token++; document.body.classList.remove('has-viewer');
    if (opener) opener.focus({ preventScroll: true }); // le focus revient sur la photo d'origine (amenée en vue)
    sync();
  }
  function closeViewer() { if (dlg.open) dlg.close(); cleanup(); }
  if (dlg) {
    dlg.addEventListener('close', cleanup);
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); closeViewer(); });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) closeViewer(); });
    dlg.querySelector('[data-viewer-close]').addEventListener('click', closeViewer);
    dlg.querySelector('[data-viewer-prev]').addEventListener('click', () => show(vIndex - 1));
    dlg.querySelector('[data-viewer-next]').addEventListener('click', () => show(vIndex + 1));
    dlg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); show(vIndex + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); show(vIndex - 1); }
      else if (e.key === 'Tab') {
        const f = [...dlg.querySelectorAll('button')]; const k = f.indexOf(document.activeElement);
        e.preventDefault(); f[(k + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    });
    window.__strip.viewer = { get open() { return dlg.open; }, get index() { return vIndex; } };
  }

  // ---- départ : après décodage des images visibles (ou 2 s au plus) ----
  render();
  const imgs = [...track.querySelectorAll('img')];
  Promise.race([Promise.all(imgs.map((im) => (im.decode ? im.decode().catch(() => {}) : null))), new Promise((r) => setTimeout(r, 2000))])
    .then(() => { measure(); sync(); });
}
