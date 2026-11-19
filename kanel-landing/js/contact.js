// Canaux du dock de contact, construits à partir de la configuration confirmée.
// Aucun lien n'est créé sans donnée confirmée : pas de wa.me vide, pas de href="#".
import { CONTACT } from './config.js?v=8';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Renvoie uniquement les chiffres d'un numéro international plausible (8 à 15 chiffres), sinon ''. */
export function waDigits(raw) {
  const digits = String(raw || '').replace(/[^\d]/g, '');
  return digits.length >= 8 && digits.length <= 15 ? digits : '';
}

/** URL Instagram de profil, sinon ''. */
export function igProfile(raw) {
  const url = String(raw || '').trim();
  return /^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._]{1,30}\/?$/.test(url) ? url : '';
}

/** Construit le HTML des canaux (fonction pure, testable). */
export function buildChannels(cfg = CONTACT) {
  const parts = [];
  const wa = waDigits(cfg.whatsappNumber);
  if (wa) {
    // Mensagem pré-preenchida enviada ao café (em Bruxelas): mantida em francês de propósito.
    const text = cfg.acceptsOrders ? 'Bonjour Kanel, je souhaite passer une commande.' : 'Bonjour Kanel,';
    const label = cfg.acceptsOrders ? 'Pedir pelo WhatsApp' : 'WhatsApp';
    parts.push(`<a class="dock__chan" href="https://wa.me/${wa}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">${label}</a>`);
  } else {
    parts.push('<span class="dock__chan dock__chan--pending"><span class="visually-hidden">Prévia: </span>WhatsApp <em>a confirmar</em></span>');
  }
  const ig = igProfile(cfg.instagramUrl);
  if (ig) {
    parts.push(`<a class="dock__chan" href="${esc(ig)}" target="_blank" rel="noopener">Instagram</a>`);
  } else {
    parts.push('<span class="dock__chan dock__chan--pending"><span class="visually-hidden">Prévia: </span>Instagram <em>a confirmar</em></span>');
  }
  return parts.join('');
}

export function initContact() {
  const slot = document.querySelector('[data-channels]');
  if (slot) slot.innerHTML = buildChannels(CONTACT);
}
