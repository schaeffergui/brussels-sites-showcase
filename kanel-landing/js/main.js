// Point d'entrée. Chaque module est isolé : une erreur dans un effet décoratif
// n'empêche ni la carte, ni l'itinéraire, ni la lecture du contenu.
import { initContact } from './contact.js?v=9';
import { initMenu } from './menu.js?v=8';
import { initMotion } from './motion.js?v=8';
import { initPointer } from './pointer.js?v=8';
import { initDust } from './dust.js?v=8';

const run = (name, fn) => { try { fn(); } catch (e) { console.error(`[kanel] ${name}`, e); } };

run('contact', initContact);
run('menu', initMenu);
run('motion', initMotion);   // ajoute .motion-ready (sinon le filet de sécurité affiche tout)
run('pointer', initPointer);
run('dust', initDust);
