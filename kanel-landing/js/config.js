// Canaux de contact de Kanel.
// À REMPLIR UNIQUEMENT avec des informations confirmées par le café. Laissés vides, ils
// s'affichent comme « à confirmer » (texte non cliquable) ; seul l'itinéraire est actif.
export const CONTACT = Object.freeze({
  // Numéro WhatsApp au format international, ex. '+32 470 00 00 00'. Vide = non confirmé.
  whatsappNumber: '',
  // URL du profil Instagram vérifiée par Kanel, ex. 'https://www.instagram.com/compte/'. Vide = non confirmé.
  // Ne pas supposer qu'un compte existant (p. ex. @kanel.brussels) appartient au café.
  instagramUrl: '',
  // true seulement si Kanel confirme accepter les commandes. Active la formulation « Commander ».
  acceptsOrders: false,
});

export const MAPS_URL =
  'https://www.google.com/maps/search/?api=1&query=Kanel%2C%20497%20Rue%20Vanderkindere%2C%20Uccle';
