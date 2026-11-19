// Física da minissinuca — módulo puro (sem DOM), usado pelo jogo e pelos testes.
// Unidades da mesa: área jogável 2 × 1 (bordas das tabelas em x=0, x=2, y=0, y=1).
// - Passo fixo (1/600 s) com acumulador: a mesma tacada dá a mesma trajetória a 30, 60 ou 144 quadros/s.
//   A 4,2 un/s, uma bola anda 0,007 por passo (raio 0,055): sem atravessar bolas nem tabelas.
// - Bolas de massa igual: impulso só na normal do contato, só se as bolas se aproximam,
//   restituição 0,94; a sobreposição é corrigida por posição (sem mexer na velocidade, sem criar energia).
// - Tabelas: reflexão com perda (normal ×0,75, tangente ×0,96). Nas bocas das seis caçapas não há tabela;
//   as pontas das tabelas (mandíbulas) são pontos de contato. A bola cai quando o centro cruza a linha
//   da tabela dentro da boca, ou quando passa sobre o buraco — nunca é “puxada” de longe.
// - Atrito: desaceleração constante + arrasto leve, por tempo; abaixo de 0,012 un/s a bola para (sem tremor).
export const W = 2, H = 1, R = 0.055;
export const STEP = 1 / 600;
export const E_BALL = 0.94, E_RAIL_N = 0.75, E_RAIL_T = 0.96;
export const DECEL = 0.9, DRAG = 0.25, VSTOP = 0.012;
export const V_MIN = 0.5, V_MAX = 4.2;
const CORNER_MOUTH = 0.1, SIDE_MOUTH = 0.08;          // abertura das bocas ao longo da tabela
export const POCKETS = [                              // centro e raio do buraco (desenho = física)
  { x: 0, y: 0, r: 0.1 }, { x: 1, y: -0.014, r: 0.085 }, { x: 2, y: 0, r: 0.1 },
  { x: 0, y: 1, r: 0.1 }, { x: 1, y: 1.014, r: 0.085 }, { x: 2, y: 1, r: 0.1 },
];
// Pontas das tabelas (mandíbulas): onde cada trecho de tabela termina numa boca
export const JAWS = [
  [CORNER_MOUTH, 0], [1 - SIDE_MOUTH, 0], [1 + SIDE_MOUTH, 0], [W - CORNER_MOUTH, 0],
  [CORNER_MOUTH, H], [1 - SIDE_MOUTH, H], [1 + SIDE_MOUTH, H], [W - CORNER_MOUTH, H],
  [0, CORNER_MOUTH], [0, H - CORNER_MOUTH], [W, CORNER_MOUTH], [W, H - CORNER_MOUTH],
];
const inTopBottomMouth = (x) => x < CORNER_MOUTH || x > W - CORNER_MOUTH || Math.abs(x - 1) < SIDE_MOUTH;
const inSideMouth = (y) => y < CORNER_MOUTH || y > H - CORNER_MOUTH;

/** Curva força → velocidade (0,1..1 → 0,5..4,2 un/s), progressiva para dar controle fino nas tacadas fracas. */
export const speedFor = (p) => V_MIN + (V_MAX - V_MIN) * Math.pow(Math.max(0, Math.min(1, p)), 1.6);

export const energy = (balls) => balls.reduce((s, b) => s + (b.in ? 0 : 0.5 * (b.vx * b.vx + b.vy * b.vy)), 0);

function pocket(b, ev) { b.in = true; b.vx = b.vy = 0; ev.pocketed.push(b); }

/** Um passo fixo de simulação. ev = { pocketed: [], railHits: 0, ballHits: 0, firstHit: null } */
export function step(balls, h, ev) {
  for (const b of balls) {
    if (b.in) continue;
    const v = Math.hypot(b.vx, b.vy);
    if (v > 0) {
      const nv = Math.max(0, v - (DECEL + DRAG * v) * h);
      if (nv < VSTOP) { b.vx = b.vy = 0; } else { b.vx *= nv / v; b.vy *= nv / v; }
    }
    b.x += b.vx * h; b.y += b.vy * h;
    // Caçapa: centro sobre o buraco, ou centro além da linha da tabela dentro de uma boca
    if (POCKETS.some((p) => Math.hypot(b.x - p.x, b.y - p.y) < p.r - R * 0.25) ||
        ((b.y < 0 || b.y > H) && inTopBottomMouth(b.x)) || ((b.x < 0 || b.x > W) && inSideMouth(b.y))) { pocket(b, ev); continue; }
    // Tabelas fora das bocas
    if (b.y < R && !inTopBottomMouth(b.x)) { b.y = R; if (b.vy < 0) { b.vy = -b.vy * E_RAIL_N; b.vx *= E_RAIL_T; ev.railHits++; } }
    if (b.y > H - R && !inTopBottomMouth(b.x)) { b.y = H - R; if (b.vy > 0) { b.vy = -b.vy * E_RAIL_N; b.vx *= E_RAIL_T; ev.railHits++; } }
    if (b.x < R && !inSideMouth(b.y)) { b.x = R; if (b.vx < 0) { b.vx = -b.vx * E_RAIL_N; b.vy *= E_RAIL_T; ev.railHits++; } }
    if (b.x > W - R && !inSideMouth(b.y)) { b.x = W - R; if (b.vx > 0) { b.vx = -b.vx * E_RAIL_N; b.vy *= E_RAIL_T; ev.railHits++; } }
    // Mandíbulas (pontas das tabelas): contato bola–ponto
    for (const [jx, jy] of JAWS) {
      const dx = b.x - jx, dy = b.y - jy, d = Math.hypot(dx, dy);
      if (d >= R || d === 0) continue;
      const nx = dx / d, ny = dy / d; b.x = jx + nx * R; b.y = jy + ny * R;
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) { const tx = b.vx - vn * nx, ty = b.vy - vn * ny; b.vx = tx * E_RAIL_T - vn * E_RAIL_N * nx; b.vy = ty * E_RAIL_T - vn * E_RAIL_N * ny; ev.railHits++; }
    }
  }
  // Choques entre bolas (massa igual)
  for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
    const a = balls[i], b = balls[j]; if (a.in || b.in) continue;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d >= 2 * R) continue;
    const nx = d ? dx / d : 1, ny = d ? dy / d : 0, o = (2 * R - d) / 2;
    a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o;           // correção de posição apenas
    const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (rel < 0) {                                                         // só se estão se aproximando
      const jn = -(1 + E_BALL) / 2 * rel;
      a.vx -= jn * nx; a.vy -= jn * ny; b.vx += jn * nx; b.vy += jn * ny;
      ev.ballHits++;
      if (ev.firstHit === null) { if (a.id === 'cue') ev.firstHit = b.id; else if (b.id === 'cue') ev.firstHit = a.id; }
    }
  }
}

export const atRest = (balls) => balls.every((b) => b.in || (b.vx === 0 && b.vy === 0));

/** Avança dt segundos em passos fixos; acc guarda o resto entre chamadas. Devolve o novo acc. */
export function advance(balls, dt, acc, ev) {
  acc += Math.min(dt, 0.1);
  let n = 0;
  while (acc >= STEP && n < 400) { step(balls, STEP, ev); acc -= STEP; n++; if (atRest(balls)) { acc = 0; break; } }
  return acc;
}

/** Simulação completa até o repouso (movimento reduzido e testes). */
export function simulate(balls, ev, maxSeconds = 30) {
  for (let t = 0; t < maxSeconds && !atRest(balls); t += STEP) step(balls, STEP, ev);
}

/** Ponto livre mais próximo do ponto de saída para recolocar a branca. */
export function freeSpot(balls, cue, sx, sy) {
  const free = (x, y) => x >= R && x <= W - R && y >= R && y <= H - R && balls.every((b) => b === cue || b.in || Math.hypot(b.x - x, b.y - y) >= 2 * R + 0.004);
  if (free(sx, sy)) return [sx, sy];
  for (let ring = 1; ring < 40; ring++) {
    const rr = ring * R * 0.6;
    for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, x = sx + Math.cos(a) * rr, y = sy + Math.sin(a) * rr; if (free(x, y)) return [x, y]; }
  }
  return [sx, sy];
}
