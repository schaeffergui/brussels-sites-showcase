// Minissinuca do Petit Lion — um minijogo curto, não um simulador de bilhar.
// Objetivo: encaçapar as três bolas coloridas (1 amarela, 3 vermelha, 8 preta) com poucas tacadas.
// - Mesa em Canvas 2D (DPR limitado a 2): madeira, tabelas internas, feltro levemente texturizado,
//   6 caçapas, bolas sombreadas e numeradas. Sem bibliotecas, sem foto de fundo.
// - Física em unidades da mesa (2 × 1): passo de tempo limitado e subdividido (sem atravessar
//   tabelas nem bolas), atrito que leva ao repouso, choques entre bolas, captura nas caçapas,
//   branca recolocada no ponto de saída se cair.
// - Interação: arrastar a partir da mesa (estilingue) mostra mira + força e solta para tacar;
//   um toque/clique sem arrastar só ajusta a mira. touch-action: pan-y → um gesto vertical rola a página.
// - Equivalente acessível: controles nativos (mira, força), botão Tacar, Reiniciar mesa;
//   mensagens curtas em aria-live só no início e no fim de cada tacada.
// - Movimento reduzido: a tacada é calculada na hora e só o resultado é desenhado.
// - O laço para quando as bolas param, fora da tela ou com a aba oculta.
import { reduced, onReducedChange } from './prefs.js?v=3';
import { addTick, removeTick } from './ticker.js?v=3';
import { W, H, R, POCKETS, JAWS, V_MAX, speedFor, advance, simulate, atRest, freeSpot, energy } from './physics.js?v=1';

const RAIL = 0.09;                            // largura da madeira em volta da mesa
const RX = 2 * R * 0.866 + 0.004, RY = R + 0.002;  // triângulo encostado, sem sobreposição
const START = { cue: [0.5, 0.5], 1: [1.42, 0.5], 3: [1.42 + RX, 0.5 - RY], 8: [1.42 + RX, 0.5 + RY] };
const BALLS = [
  { id: 'cue', name: 'a branca', color: '#F4EEE2', num: null },
  { id: 1, name: 'a 1 (amarela)', color: '#E9B824', num: '1' },
  { id: 3, name: 'a 3 (vermelha)', color: '#C8372D', num: '3' },
  { id: 8, name: 'a 8 (preta)', color: '#17120E', num: '8' },
];
const deg = (a) => ((Math.round(a) % 360) + 360) % 360;
const dirName = (d) => ['para a direita', 'para baixo e à direita', 'para baixo', 'para baixo e à esquerda', 'para a esquerda', 'para cima e à esquerda', 'para cima', 'para cima e à direita'][Math.round(d / 45) % 8];

export function initBilliard() {
  const box = document.querySelector('[data-billiard]');
  const canvas = box?.querySelector('canvas');
  const ctx = canvas?.getContext('2d');
  if (!box || !ctx) return;
  const root = box.closest('[data-pool]');
  const aimIn = root.querySelector('[data-aim]'), powIn = root.querySelector('[data-power]');
  const aimOut = root.querySelector('[data-aim-out]'), powOut = root.querySelector('[data-power-out]');
  const shotBtn = root.querySelector('[data-shot]'), resetBtn = root.querySelector('[data-reset]');
  const scoreEl = root.querySelector('[data-score]'), status = root.querySelector('[data-shot-status]');
  root.querySelector('[data-pool-help]').hidden = false;
  root.querySelector('[data-pool-controls]').hidden = false;
  box.classList.add('is-live');

  // ---- estado ----
  let balls = [], shots = 0, rolling = false, running = false, visible = false;
  let aim = 0, power = 0.6;                     // graus (0 = direita, sentido horário) e 0..1
  let drag = null, pocketedNow = [], scratch = false, felt = null, acc = 0, ev = null;
  let scale = 1, ox = 0, oy = 0, w = 0, h = 0, dpr = 1;
  const stats = { shots: 0, frames: 0, maxSub: 0, results: [] };
  window.__lionBilliard = { energy: () => energy(balls), stats, get balls() { return balls; }, get rolling() { return rolling; }, get running() { return running; }, get aim() { return aim; }, get power() { return power; } };

  const say = (t) => { if (status) status.textContent = t; };
  const onTable = () => balls.filter((b) => !b.in && b.id !== 'cue');
  const cue = () => balls.find((b) => b.id === 'cue');
  function reset(announce) {
    balls = BALLS.map((b) => ({ ...b, x: START[b.id][0], y: START[b.id][1], vx: 0, vy: 0, in: false }));
    shots = 0; rolling = false; aim = 0; power = 0.6; syncControls(); updateScore(); draw();
    if (announce) say('Mesa arrumada. Mire na bola amarela e tente encaçapar as três coloridas.');
  }
  function updateScore() {
    const n = onTable().length;
    scoreEl.textContent = `Tacadas: ${shots} · Na mesa: ${n} bola${n === 1 ? '' : 's'}`;
    shotBtn.setAttribute('aria-disabled', String(rolling || n === 0)); // sem disabled: o foco não se perde
  }
  function syncControls() {
    aimIn.value = String((Math.round(deg(aim) / 5) * 5) % 360);
    powIn.value = String(Math.round(power * 20) * 5);
    aimOut.textContent = `${deg(aim)}° (${dirName(deg(aim))})`;
    powOut.textContent = `${Math.round(power * 100)}%`;
  }

  // ---- geometria / desenho ----
  function layout() {
    const r = box.getBoundingClientRect();
    if (!r.width) return;
    dpr = Math.min(devicePixelRatio || 1, 2); w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    scale = w / (W + 2 * RAIL); ox = RAIL * scale; oy = RAIL * scale;
    felt = makeFelt(); draw();
  }
  const X = (x) => ox + x * scale, Y = (y) => oy + y * scale;
  function makeFelt() {   // textura leve de feltro (ruído fino, gerado uma vez por tamanho)
    const c = document.createElement('canvas'); const fw = Math.max(1, Math.round(W * scale * dpr)), fh = Math.max(1, Math.round(H * scale * dpr));
    c.width = fw; c.height = fh; const g = c.getContext('2d');
    g.fillStyle = '#1E6B44'; g.fillRect(0, 0, fw, fh);
    const img = g.getImageData(0, 0, fw, fh), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(img, 0, 0);
    const v = g.createRadialGradient(fw / 2, fh / 2, fh * 0.2, fw / 2, fh / 2, fw * 0.62);
    v.addColorStop(0, 'rgba(255,255,255,0.05)'); v.addColorStop(1, 'rgba(0,0,0,0.22)');
    g.fillStyle = v; g.fillRect(0, 0, fw, fh);
    return c;
  }
  function draw() {
    if (!w) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    // madeira (tabela externa)
    const wood = ctx.createLinearGradient(0, 0, 0, h);
    wood.addColorStop(0, '#6B4527'); wood.addColorStop(0.5, '#4E301B'); wood.addColorStop(1, '#3A2213');
    roundRect(0, 0, w, h, 14); ctx.fillStyle = wood; ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,170,0.18)'; ctx.lineWidth = 1; roundRect(1.5, 1.5, w - 3, h - 3, 12.5); ctx.stroke();
    // marcações (diamantes)
    ctx.fillStyle = '#E8D9B8';
    for (let i = 1; i < 8; i++) { if (i === 4) continue; diamond(X(i * W / 8), oy / 2); diamond(X(i * W / 8), h - oy / 2); }
    for (let i = 1; i < 4; i++) { diamond(ox / 2, Y(i * H / 4)); diamond(w - ox / 2, Y(i * H / 4)); }
    // tabelas internas (borracha) + feltro
    const cush = RAIL * 0.32 * scale;
    ctx.fillStyle = '#165834'; ctx.fillRect(ox - cush, oy - cush, W * scale + 2 * cush, H * scale + 2 * cush);
    ctx.drawImage(felt, ox, oy, W * scale, H * scale);
    // linha de saída e ponto
    ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(X(0.5), Y(0)); ctx.lineTo(X(0.5), Y(1)); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(X(1.42), Y(0.5), 2, 0, 6.283); ctx.fill();
    // caçapas
    for (const { x: px, y: py, r: pr } of POCKETS) {
      ctx.beginPath(); ctx.arc(X(px), Y(py), pr * scale, 0, 6.283); ctx.fillStyle = '#0A0705'; ctx.fill();
      ctx.lineWidth = Math.max(1.5, scale * 0.012); ctx.strokeStyle = '#2A1A0E'; ctx.stroke();
    }
    // mira (antes das bolas)
    const c = cue();
    if (c && !c.in && !rolling) drawAim(c);
    // sombras de contato, depois bolas
    for (const b of balls) if (!b.in) { ctx.beginPath(); ctx.ellipse(X(b.x) + R * scale * 0.18, Y(b.y) + R * scale * 0.32, R * scale * 0.95, R * scale * 0.6, 0, 0, 6.283); ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.fill(); }
    for (const b of balls) if (!b.in) drawBall(b);
  }
  function drawAim(c) {
    // guia, recuo do taco e arco seguem a velocidade real da tacada (speedFor), não o valor bruto do controle
    const sp = speedFor(power) / V_MAX;
    const a = aim * Math.PI / 180, cx = X(c.x), cy = Y(c.y), len = (0.3 + sp * 0.5) * scale;
    ctx.save(); ctx.setLineDash([5, 5]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(246,231,200,0.85)';
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R * scale * 1.3, cy + Math.sin(a) * R * scale * 1.3); ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len); ctx.stroke(); ctx.restore();
    // taco (atrás da branca) com recuo proporcional à força
    const back = (R * 1.4 + sp * 0.2) * scale, cueLen = 0.75 * scale;
    const bx = cx - Math.cos(a) * back, by = cy - Math.sin(a) * back;
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = '#C89A5B'; ctx.lineWidth = Math.max(3, scale * 0.022);
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - Math.cos(a) * cueLen, by - Math.sin(a) * cueLen); ctx.stroke();
    ctx.strokeStyle = '#F2ECE0'; ctx.lineWidth = Math.max(3, scale * 0.022);
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - Math.cos(a) * scale * 0.03, by - Math.sin(a) * scale * 0.03); ctx.stroke();
    ctx.restore();
    // indicador de força (arco em volta da branca)
    ctx.beginPath(); ctx.arc(cx, cy, R * scale * 1.75, -Math.PI / 2, -Math.PI / 2 + sp * Math.PI * 2);
    ctx.strokeStyle = sp > 0.7 ? '#F08A5D' : '#F6C77A'; ctx.lineWidth = 3; ctx.stroke();
  }
  function drawBall(b) {
    const x = X(b.x), y = Y(b.y), r = R * scale;
    const g = ctx.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.1, x, y, r * 1.05);
    g.addColorStop(0, shade(b.color, 0.45)); g.addColorStop(0.35, b.color); g.addColorStop(1, shade(b.color, -0.45));
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fillStyle = g; ctx.fill();
    if (b.num) {
      ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, 6.283); ctx.fillStyle = '#F7F2E8'; ctx.fill();
      ctx.fillStyle = '#17120E'; ctx.font = `700 ${Math.max(8, r * 0.72)}px ${getComputedStyle(document.body).fontFamily}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.num, x, y + r * 0.04);
    }
    ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.4, r * 0.18, 0, 6.283); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
  }
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const t = k > 0 ? 255 : 0, a = Math.abs(k); r = Math.round(r + (t - r) * a); g = Math.round(g + (t - g) * a); b = Math.round(b + (t - b) * a);
    return `rgb(${r},${g},${b})`;
  }
  function roundRect(x, y, ww, hh, rr) { ctx.beginPath(); ctx.moveTo(x + rr, y); ctx.arcTo(x + ww, y, x + ww, y + hh, rr); ctx.arcTo(x + ww, y + hh, x, y + hh, rr); ctx.arcTo(x, y + hh, x, y, rr); ctx.arcTo(x, y, x + ww, y, rr); ctx.closePath(); }
  function diamond(x, y) { const s = Math.max(2, scale * 0.012); ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath(); ctx.fill(); }

  // ---- física ----
  function newEvents() { return { pocketed: [], railHits: 0, ballHits: 0, firstHit: null }; }
  function collect() {
    for (const b of ev.pocketed) { if (b.id === 'cue') scratch = true; else if (!pocketedNow.includes(b)) pocketedNow.push(b); }
    ev.pocketed = [];
  }
  function stepPhysics(dt) { acc = advance(balls, dt, acc, ev); collect(); return atRest(balls); }
  function settle() {
    balls.forEach((b) => { b.vx = b.vy = 0; });
    rolling = false;
    const c = cue();
    if (scratch) {   // branca volta ao ponto de saída ou ao ponto livre mais próximo
      c.in = false; c.vx = c.vy = 0;
      [c.x, c.y] = freeSpot(balls, c, START.cue[0], START.cue[1]);   // ponto livre mais próximo, sem sobrepor
    }
    const left = onTable().length;
    const parts = [`Tacada ${shots}:`];
    parts.push(pocketedNow.length ? `${pocketedNow.map((b) => b.name).join(' e ')} ${pocketedNow.length > 1 ? 'caíram' : 'caiu'} na caçapa.` : 'nenhuma bola colorida caiu.');
    if (scratch) parts.push('A branca caiu e volta à mesa no ponto de saída (ou no lugar livre mais próximo).');
    if (left === 0) parts.push(`Mesa limpa em ${shots} tacada${shots > 1 ? 's' : ''}! Use “Reiniciar mesa” para jogar de novo.`);
    else parts.push(`Falta${left > 1 ? 'm' : ''} ${left} bola${left > 1 ? 's' : ''}.`);
    const msg = parts.join(' ');
    stats.results.push(msg); say(msg);
    root.dataset.state = left === 0 ? 'done' : 'aim';
    updateScore(); draw();
  }
  function tick(t, dtMs) {
    stats.frames++;
    if (!visible) { running = false; return false; }
    if (rolling) { if (stepPhysics(Math.min(dtMs, 100) / 1000)) settle(); }
    draw();
    if (!rolling && !drag) { running = false; return false; }
    return true;
  }
  function wake() { if (running || !visible) return; running = true; addTick(tick); }

  function shoot() {
    const c = cue();
    if (rolling || !c || c.in || onTable().length === 0) return;
    const a = aim * Math.PI / 180, v = speedFor(power);
    c.vx = Math.cos(a) * v; c.vy = Math.sin(a) * v;
    shots++; stats.shots++; pocketedNow = []; scratch = false; rolling = true; acc = 0; ev = newEvents();
    stats.lastShot = { aim, power, speed: +v.toFixed(3) };
    root.dataset.state = 'rolling'; updateScore();
    if (reduced()) {   // resultado imediato, sem animação
      simulate(balls, ev); collect();   // mesma física, resultado imediato
      settle(); return;
    }
    say(`Tacada ${shots} em andamento…`);
    wake();
  }

  // ---- controles acessíveis ----
  aimIn.addEventListener('input', () => { aim = +aimIn.value; syncControls(); draw(); });
  powIn.addEventListener('input', () => { power = +powIn.value / 100; syncControls(); draw(); });
  shotBtn.addEventListener('click', shoot);
  resetBtn.addEventListener('click', () => { removeTick(tick); running = false; drag = null; reset(true); root.dataset.state = 'aim'; });

  // ---- ponteiro: toque = mirar ; arrastar para trás = estilingue (mira + força), soltar = tacar ----
  const toTable = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left - ox) / scale, (e.clientY - r.top - oy) / scale]; };
  box.addEventListener('pointerdown', (e) => {
    if (rolling || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const [x, y] = toTable(e);
    drag = { id: e.pointerId, x0: x, y0: y, sx: e.clientX, sy: e.clientY, on: false, type: e.pointerType };
    if (e.pointerType === 'mouse') { try { box.setPointerCapture(e.pointerId); } catch (_) {} }
  });
  box.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dxp = e.clientX - drag.sx, dyp = e.clientY - drag.sy;
    if (!drag.on) {
      if (Math.hypot(dxp, dyp) < 8) return;
      drag.on = true; try { box.setPointerCapture(e.pointerId); } catch (_) {}
      wake();
    }
    const [x, y] = toTable(e), c = cue();
    const px = drag.x0 - x, py = drag.y0 - y, dist = Math.hypot(px, py);
    if (dist > 0.01) { aim = deg(Math.atan2(py, px) * 180 / Math.PI); power = Math.max(0.1, Math.min(1, dist / 0.6)); syncControls(); }
    if (!running) draw();
  });
  const endDrag = (e, cancelled) => {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const d = drag; drag = null;
    try { box.releasePointerCapture(d.id); } catch (_) {}
    if (cancelled) { draw(); return; }
    if (d.on) { if (power >= 0.12) shoot(); else draw(); return; }
    // toque/clique sem arrastar: mirar no ponto tocado
    const [x, y] = toTable(e), c = cue();
    if (c && !c.in) { aim = deg(Math.atan2(y - c.y, x - c.x) * 180 / Math.PI); syncControls(); draw(); say(`Mira ajustada: ${deg(aim)}° (${dirName(deg(aim))}). Toque em Tacar ou arraste para trás.`); }
  };
  box.addEventListener('pointerup', (e) => endDrag(e, false));
  box.addEventListener('pointercancel', (e) => endDrag(e, true));   // gesto vertical: a página rolou

  // ---- visibilidade, redimensionamento, movimento reduzido ----
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible && (rolling || drag)) wake(); if (!visible) { removeTick(tick); running = false; } }, { threshold: 0.2 }).observe(box);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && rolling && visible) { running = false; wake(); } });
  new ResizeObserver(() => layout()).observe(box);
  onReducedChange((r) => {
    if (!r || !rolling) return;
    removeTick(tick); running = false;
    simulate(balls, ev); collect();
    settle();
  });

  reset(false);
  root.dataset.state = 'aim';
  layout();
  say('');
}
