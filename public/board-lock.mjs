// leketia — ouverture d'un partage protégé par mot de passe, dans le navigateur du visiteur.
// Le serveur ne voit que du chiffré ; ici on déchiffre, on vérifie l'expiration et on affiche le board.
import { decodeLocked, openLockedPage, encode, toMarkdown, isExpired } from '/share-codec.mjs';
import { cardsHtml, initViewer } from '/board-render.mjs';

window.__moduleReady = true; // le module s'est bien chargé (voir la garde dans la page)
const data = JSON.parse(document.getElementById('lockData').textContent);
const form = document.getElementById('lockForm');
const err = document.getElementById('lockErr');
const mk = (tag, cls, text) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text != null) el.textContent = text; return el; };

async function show(board) {
  const root = document.getElementById('board');
  const n = board.links.length;
  root.append(mk('h1', '', board.name));
  const until = board.expires ? `, visible jusqu'au ${new Date(board.expires).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}` : '';
  root.append(mk('p', 'meta', `${n} lien${n > 1 ? 's' : ''}${until}. Déchiffré dans ton navigateur.`));
  const actions = mk('div', 'actions');
  const add = mk('a', 'btn primary', 'Ajouter à mon journal leketia');
  add.href = '/#import=' + await encode({ ...board, expires: undefined }); // après « # » : rien n'est envoyé au serveur
  const copy = mk('button', 'btn ghost', 'Copier le texte (pour une IA)');
  copy.type = 'button';
  copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(toMarkdown(board)); copy.textContent = 'Texte copié'; } catch { copy.textContent = 'Copie impossible'; } });
  actions.append(add, copy);
  root.append(actions);
  root.insertAdjacentHTML('beforeend', cardsHtml(board)); // texte échappé par le rendu partagé
  initViewer(root);
  document.getElementById('locked').hidden = true;
  root.hidden = false;
  document.title = `${board.name} — leketia`;
}

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const button = form.querySelector('button');
  button.disabled = true; err.textContent = '';
  try {
    const pw = document.getElementById('pw').value;
    const board = data.kind === 'page'
      ? await openLockedPage({ kind: 'leketia-page', v: 2, enc: data.sealed }, pw)
      : await decodeLocked(data.sealed, pw);
    if (isExpired(board)) { err.textContent = 'Ce partage a expiré.'; return; }
    await show(board);
  } catch (e) {
    err.textContent = e && e.message === 'Mot de passe incorrect' ? 'Mot de passe incorrect.' : 'Ce partage est illisible.';
  } finally { button.disabled = false; }
});
