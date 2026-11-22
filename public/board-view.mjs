// leketia — page publique (/b, /p) : la grille est déjà écrite par le serveur ; ce module ouvre les lecteurs.
import { initViewer } from '/board-render.mjs';
window.__moduleReady = true;
initViewer(document);
