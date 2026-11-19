// Canaux sociaux : rendus UNIQUEMENT si une valeur confirmée et valide est configurée.
// Vide ou invalide = rien dans le DOM (pas de lien, pas de mention « à confirmer »).
import { CONFIG } from './config.js?v=3';

/** URL de profil Instagram valide, sinon ''. */
export function instagramLink(url) {
  const u = String(url || '').trim();
  if (!/^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._]{1,30}\/?$/.test(u)) return '';
  return `<a class="btn btn--ghost" href="${u}" target="_blank" rel="noopener">Instagram do Petit Lion</a>`;
}

/** Numéro E.164 (+ et 8 à 15 chiffres, premier chiffre non nul), espaces/tirets/points tolérés. */
export function e164(raw) {
  const s = String(raw || '').trim().replace(/[\s.\-()]/g, '');
  return /^\+[1-9]\d{7,14}$/.test(s) ? s.slice(1) : '';
}

/** Lien WhatsApp (wa.me) avec message d'ouverture neutre, sinon ''. Aucune formulation de commande. */
export function whatsappLink(phone) {
  const digits = e164(phone);
  if (!digits) return '';
  const text = encodeURIComponent('Bonjour Le Petit Lion,');
  return `<a class="btn btn--ghost" href="https://wa.me/${digits}?text=${text}" target="_blank" rel="noopener">Escrever no WhatsApp</a>`;
}

export function buildSocial(cfg = CONFIG) {
  return [whatsappLink(cfg.whatsappPhone), instagramLink(cfg.instagramUrl)].filter(Boolean).join('');
}

export function initSocial() {
  const slot = document.querySelector('[data-social]');
  if (slot) slot.innerHTML = buildSocial(CONFIG);
}
