// Horaires et statut d'ouverture, en heure civile de Bruxelles (Europe/Brussels) via
// Intl.DateTimeFormat — jamais le fuseau de l'ordinateur ni un décalage UTC fixe.
// Intervalles qui passent minuit, intervalle de la veille pour le petit matin, plusieurs
// intervalles par jour et jours fermés. Fonctions pures, testées dans tests/hours-tests.js.

export const TZ = 'Europe/Brussels';
export const DAYS = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];

// Horaires publiés sur la fiche Google Maps, consultée le 11/11/2026 (non confirmés par Keufté).
// Index 0 = lundi. Chaque intervalle : [ouverture, fermeture] en "HH:MM" ; fermeture <= ouverture = après minuit.
export const SCHEDULE = [
  [['11:30', '02:00']], // lundi
  [['11:30', '02:00']], // mardi
  [['11:30', '02:00']], // mercredi
  [['11:30', '03:00']], // jeudi
  [['11:30', '04:00']], // vendredi
  [['11:30', '04:00']], // samedi
  [['11:30', '02:00']], // dimanche
];
// L'indicateur « ouvert / fermé » n'est activé que si les horaires sont confirmés par une source fiable.
// Une seule source agrégée (Google Maps) : désactivé → « Horaires à confirmer ».
export const LIVE_STATUS = false;

const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const WD = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

/** Jour (0 = lundi) et minutes depuis minuit, à Bruxelles, pour un instant donné. */
export function brusselsParts(date) {
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return { day: WD[p.weekday], minutes: (+p.hour) * 60 + (+p.minute) };
}
const toMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

/** { open, closesAt?, opensAt? } pour l'instant donné. */
export function statusAt(date, schedule = SCHEDULE) {
  const { day, minutes } = brusselsParts(date);
  const prev = (day + 6) % 7;
  // Intervalle de la veille qui déborde après minuit
  for (const [o, c] of schedule[prev] || []) {
    const om = toMin(o), cm = toMin(c);
    if (cm <= om && minutes < cm) return { open: true, closesAt: c, day, minutes };
  }
  for (const [o, c] of schedule[day] || []) {
    const om = toMin(o), cm = toMin(c);
    if (cm > om ? minutes >= om && minutes < cm : minutes >= om) return { open: true, closesAt: c, day, minutes };
  }
  // Prochaine ouverture (aujourd'hui ou jours suivants)
  for (let k = 0; k < 7; k++) {
    const d = (day + k) % 7;
    for (const [o] of schedule[d] || []) { if (k > 0 || toMin(o) > minutes) return { open: false, opensAt: o, opensDay: k === 0 ? null : DAYS[d], day, minutes }; }
  }
  return { open: false, day, minutes };
}

export function label(st) {
  const h = (s) => { const [hh, mm] = s.split(':'); return `${+hh} h${mm === '00' ? '' : ' ' + mm}`; };
  if (st.open) return `Aberto agora · até ${h(st.closesAt)}`;
  if (st.opensAt) return `Fechado · abre ${st.opensDay ? st.opensDay + ' ' : ''}às ${h(st.opensAt)}`;
  return 'Fechado';
}

/** Met à jour l'indicateur à chaque minute ronde et au retour sur l'onglet (sans région live intrusive). */
export function initHours() {
  const el = document.querySelector('[data-open-status]');
  if (!el) return;
  if (!LIVE_STATUS) { el.textContent = 'Horários a confirmar'; el.dataset.state = 'unknown'; return; }
  let timer = 0;
  const render = () => { const st = statusAt(new Date()); el.textContent = label(st); el.dataset.state = st.open ? 'open' : 'closed'; };
  const schedule = () => { clearTimeout(timer); render(); const now = Date.now(); timer = setTimeout(schedule, 60000 - (now % 60000) + 50); };
  schedule();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(); else clearTimeout(timer); });
}
