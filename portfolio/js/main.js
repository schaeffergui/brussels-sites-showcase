// Mostruário — módulos isolados: um erro em um não impede os outros.
const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
const mqFine = matchMedia('(hover: hover) and (pointer: fine)');
const reduced = () => mqReduce.matches;
window.__siteErrors = [];
const run = (n, f) => { try { f(); } catch (e) { console.error(n, e); window.__siteErrors.push(`${n}: ${e.message}`); } };

const SHOTS = {
  kanel:   { name: 'Kanel', url: '../kanel-landing/' },
  lion:    { name: 'Le Petit Lion', url: '../le-petit-lion/' },
  sabor:   { name: 'El Sabor', url: '../el-sabor/' },
  keufte:  { name: 'Keufté Ixelles', url: '../keufte-ixelles/' },
  liberty: { name: 'Le Petit Liberty', url: '../le-petit-liberty/' },
};
const VIEWS = [
  { key: 'desk', cap: 'Página inicial no computador' },
  { key: 'feat', cap: 'Seção em destaque no computador' },
  { key: 'mob', cap: 'Página inicial no celular' },
];
const srcFor = (p, v) => (v === 'mob' ? `img/shots/${p}-mob-375.webp` : `img/shots/${p}-${v}-${innerWidth * (devicePixelRatio || 1) > 1000 ? 1425 : 960}.webp`);

// ---- Revelações (títulos palavra por palavra + blocos), só com movimento permitido ----
function initReveal() {
  const root = document.documentElement;
  document.querySelectorAll('[data-split]').forEach((el) => {
    let k = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((c) => {
        if (c.nodeType === 3) {
          const frag = document.createDocumentFragment();
          c.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(part); return; }
            const w = document.createElement('span'); w.className = 'w';
            const i = document.createElement('span'); i.className = 'w__i'; i.textContent = part; i.style.setProperty('--wi', k++);
            w.append(i); frag.append(w);
          });
          c.replaceWith(frag);
        } else if (c.nodeType === 1 && c.tagName !== 'BR') walk(c);
      });
    };
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    walk(el);
    [...el.querySelectorAll('.w')].forEach((w) => w.setAttribute('aria-hidden', 'true'));
  });
  if (reduced() || !('IntersectionObserver' in window)) { root.classList.add('motion-ready'); return; }
  const items = [...document.querySelectorAll('[data-split], [data-reveal], .cover__stage .frame, .cover__stage .phone')];
  items.forEach((el) => el.classList.add('is-pending'));
  root.classList.add('motion-ready');
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.remove('is-pending'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  items.forEach((el) => io.observe(el));
  mqReduce.addEventListener('change', () => { if (reduced()) items.forEach((el) => el.classList.remove('is-pending')); });
}

// ---- Capa: leve profundidade ao mover o ponteiro (só ponteiro fino e movimento permitido) ----
function initStage() {
  const stage = document.querySelector('[data-stage]');
  if (!stage) return;
  const cover = document.querySelector('.cover');
  const layers = [...stage.querySelectorAll('[data-depth]')];
  let raf = 0, tx = 0, ty = 0, cx = 0, cy = 0, tp = 0, cp = 0;
  const progress = () => {
    const r = stage.getBoundingClientRect();
    return Math.max(0, Math.min(1, (innerHeight * .85 - r.top) / (innerHeight * .85 + r.height * .7)));
  };
  const frame = () => {
    raf = 0; cx += (tx - cx) * 0.12; cy += (ty - cy) * 0.12; cp += (tp - cp) * .12;
    stage.style.setProperty('--stage-progress', cp.toFixed(4));
    layers.forEach((l) => { const d = +l.dataset.depth; l.style.translate = `${(cx * d * 10).toFixed(2)}px ${(cy * d * 8).toFixed(2)}px`; });
    if (Math.abs(tx - cx) > .002 || Math.abs(ty - cy) > .002 || Math.abs(tp - cp) > .002) raf = requestAnimationFrame(frame);
  };
  const queue = () => { if (!raf) raf = requestAnimationFrame(frame); };
  const updateScroll = () => { if (reduced()) return; tp = progress(); queue(); };
  window.addEventListener('scroll', updateScroll, { passive: true });
  window.addEventListener('resize', updateScroll, { passive: true });
  updateScroll();
  cover.addEventListener('pointermove', (e) => {
    if (!mqFine.matches || reduced() || e.pointerType !== 'mouse') return;
    const r = stage.getBoundingClientRect();
    tx = Math.max(-1, Math.min(1, (e.clientX - r.left) / r.width * 2 - 1));
    ty = Math.max(-1, Math.min(1, (e.clientY - r.top) / r.height * 2 - 1));
    queue();
  }, { passive: true });
  cover.addEventListener('pointerleave', () => { tx = ty = 0; if (!reduced()) queue(); });
  mqReduce.addEventListener('change', () => {
    if (reduced()) {
      cancelAnimationFrame(raf); raf = 0; tx = ty = cx = cy = tp = cp = 0;
      stage.style.removeProperty('--stage-progress');
      layers.forEach((l) => { l.style.translate = ''; });
    } else updateScroll();
  });
}

// ---- Cinco cenas guiadas pela rolagem nativa; sem animação em movimento reduzido ----
function initShowreel() {
  const section = document.querySelector('[data-showreel]');
  if (!section) return;
  const track = section.querySelector('[data-showreel-track]');
  const sticky = section.querySelector('.showreel__sticky');
  const scenes = [...section.querySelectorAll('[data-showreel-scene]')];
  const count = section.querySelector('[data-showreel-count]');
  const progressBar = section.querySelector('[data-showreel-progress]');
  let queued = false;

  const reset = () => {
    section.classList.remove('is-cinematic');
    scenes.forEach((scene) => {
      scene.classList.remove('is-active', 'is-visible');
      scene.style.opacity = '';
      scene.removeAttribute('aria-hidden');
      scene.querySelector('a').removeAttribute('tabindex');
      scene.querySelector('.showreel__visual').style.transform = '';
      scene.querySelector('.showreel__copy').style.transform = '';
    });
    count.textContent = '05 projetos';
    progressBar.style.width = '100%';
  };

  const paint = () => {
    queued = false;
    if (reduced()) return;
    const rect = track.getBoundingClientRect();
    const stickyTop = parseFloat(getComputedStyle(sticky).top) || 0;
    const range = Math.max(1, track.offsetHeight - sticky.offsetHeight);
    const progress = Math.max(0, Math.min(1, (stickyTop - rect.top) / range));
    const phase = progress * (scenes.length - 1);
    const active = Math.min(scenes.length - 1, Math.round(phase));
    scenes.forEach((scene, i) => {
      const distance = i - phase;
      scene.style.opacity = i === active ? '1' : '0';
      scene.classList.toggle('is-visible', i === active);
      scene.classList.toggle('is-active', i === active);
      scene.setAttribute('aria-hidden', String(i !== active));
      scene.querySelector('a').tabIndex = i === active ? 0 : -1;
      scene.querySelector('.showreel__visual').style.transform = `translate3d(${(distance * 8).toFixed(2)}%,0,0) scale(${(1.04 + Math.abs(distance) * .08).toFixed(3)}) rotate(${(distance * .8).toFixed(2)}deg)`;
      scene.querySelector('.showreel__copy').style.transform = `translate3d(${(-distance * 14).toFixed(2)}px,0,0)`;
    });
    count.textContent = `${String(active + 1).padStart(2, '0')} / ${String(scenes.length).padStart(2, '0')}`;
    progressBar.style.width = `${(20 + progress * 80).toFixed(1)}%`;
  };

  const requestPaint = () => {
    if (!queued && !reduced()) { queued = true; requestAnimationFrame(paint); }
  };
  const mode = () => {
    if (reduced()) reset();
    else { section.classList.add('is-cinematic'); requestPaint(); }
  };
  addEventListener('scroll', requestPaint, { passive: true });
  addEventListener('resize', requestPaint, { passive: true });
  mqReduce.addEventListener('change', mode);
  mode();
}

// ---- Filtro por segmento ----
function initFilter() {
  const bar = document.querySelector('[data-filters]');
  const status = document.querySelector('[data-filter-status]');
  const cards = [...document.querySelectorAll('.card')];
  if (!bar) return;
  bar.hidden = false;
  const chips = [...bar.querySelectorAll('[data-seg]')];
  chips.forEach((c) => c.addEventListener('click', () => {
    const seg = c.dataset.seg;
    chips.forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
    let n = 0;
    cards.forEach((card) => {
      const on = seg === 'todos' || card.dataset.segs.split(' ').includes(seg);
      card.hidden = !on;
      if (on) {
        n++;
        card.querySelectorAll('.is-pending').forEach((el) => el.classList.remove('is-pending'));
        if (!reduced()) card.animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: (n - 1) * 70, easing: 'cubic-bezier(.22,.8,.3,1)', fill: 'backwards' });
      }
    });
    if (status) status.textContent = `${n} projeto${n > 1 ? 's' : ''} exibido${n > 1 ? 's' : ''}`;
  }));
}

// ---- Visualizador de capturas (diálogo nativo) ----
function initViewer() {
  const dlg = document.querySelector('[data-viewer]');
  if (!dlg || typeof dlg.showModal !== 'function') return;
  const img = dlg.querySelector('.viewer__img'), frame = dlg.querySelector('[data-viewer-frame]');
  const title = dlg.querySelector('#viewer-title'), pos = dlg.querySelector('[data-viewer-pos]'), cap = dlg.querySelector('[data-viewer-cap]');
  const demo = dlg.querySelector('[data-viewer-demo]');
  const prev = dlg.querySelector('[data-viewer-prev]'), next = dlg.querySelector('[data-viewer-next]'), close = dlg.querySelector('[data-viewer-close]');
  let project = null, i = 0, opener = null, token = 0;
  const stats = { opens: 0 }; window.__viewer = stats;
  const cache = new Map();
  const load = (u) => { if (!cache.has(u)) cache.set(u, new Promise((res) => { const im = new Image(); im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => res(true)); im.onerror = () => { cache.delete(u); res(false); }; im.src = u; })); return cache.get(u); };
  function show(k, dir = 0) {
    i = (k + VIEWS.length) % VIEWS.length; const my = ++token;
    const v = VIEWS[i], p = SHOTS[project], u = srcFor(project, v.key);
    pos.textContent = `${i + 1} / ${VIEWS.length}`;
    cap.textContent = `${v.cap} · captura da demonstração local.`;
    img.alt = `${p.name}: ${v.cap.toLowerCase()}.`;
    frame.classList.remove('is-missing');
    load(u).then((ok) => {
      if (my !== token) return;
      if (ok) { img.src = u; if (dir && !reduced()) img.animate([{ opacity: 0, transform: `translateX(${dir * 30}px)` }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' }); }
      else frame.classList.add('is-missing');
    });
    VIEWS.forEach((x) => load(srcFor(project, x.key)));
  }
  function open(p, from) {
    project = p; opener = from; stats.opens++;
    title.textContent = SHOTS[p].name;
    demo.href = SHOTS[p].url; demo.setAttribute('aria-label', `Ver demonstração do ${SHOTS[p].name} (abre em nova aba)`);
    document.body.classList.add('has-viewer');
    dlg.showModal(); show(0); close.focus();
  }
  function cleanup() { if (!document.body.classList.contains('has-viewer')) return; document.body.classList.remove('has-viewer'); token++; if (opener) opener.focus(); }
  const shut = () => { if (dlg.open) dlg.close(); cleanup(); };
  document.querySelectorAll('[data-gallery]').forEach((b) => b.addEventListener('click', () => open(b.dataset.gallery, b)));
  prev.addEventListener('click', () => show(i - 1, -1));
  next.addEventListener('click', () => show(i + 1, 1));
  close.addEventListener('click', shut);
  dlg.addEventListener('close', cleanup);
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); shut(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) shut(); });
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); show(i + 1, 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); show(i - 1, -1); }
    else if (e.key === 'Tab') {
      const f = [...dlg.querySelectorAll('button, a[href]')]; const k = f.indexOf(document.activeElement);
      e.preventDefault(); f[(k + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  });
  // Deslizar com o dedo (horizontal); o vertical e o pinça continuam nativos
  let sx = null, sy = 0;
  frame.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
  frame.addEventListener('pointerup', (e) => {
    if (sx === null) return; const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) show(i + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  });
  frame.addEventListener('pointercancel', () => { sx = null; });
}

run('reveal', initReveal);
run('stage', initStage);
run('showreel', initShowreel);
run('filter', initFilter);
run('viewer', initViewer);
document.querySelectorAll('main img').forEach((im) => im.addEventListener('error', () => im.closest('figure')?.classList.add('is-missing')));
