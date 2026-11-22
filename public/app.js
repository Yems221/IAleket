// ===== leketia — interface reprise de HomeBoard, données sur l'appareil =====
const App = (() => {
  let currentUser = null;
  let spaces = [];
  let items = [];
  let activeSpace = 'all';
  let activeFilter = '';      // statut neutralisé : le statut reste une propriété d'item, plus de filtre global
  let activeTag = '';         // filtre par tag (plateforme ou #hashtag) — cf. tagsOf()
  let lastAutoFetched = '';   // dernière URL auto-récupérée (évite les doublons)
  let _linkDebounce = null;
  let activeModalTab = 'link';
  let mediaFile = null; // File choisi (image ou vidéo) — uploadé en streaming, pas de base64
  let mediaKind = 'image';
  let linkCanonicalUrl = ''; // URL résolue par le serveur (liens courts TikTok → URL embarquable)
  let linkImageUrl = '';
  let addVia = 'manuel'; // pour la mesure : partage depuis une autre appli, collage, ou saisie // image d'aperçu trouvée par le serveur, gardée pour la carte même quand le lecteur l'a remplacée
  let sharedMediaUrl = null;      // média déjà stocké en R2 via /share-target (partage natif) → pas de ré-upload
  let sharedMediaKind = 'image';  // 'image' | 'video' du média partagé
  let sharedIntentHandled = false; // un seul traitement du partage par chargement de page
  let confirmResolve = null;
  let editingId = null;
  let dragSession = null;      // session de réorganisation d'onglets d'espaces (drag)
  let lastPointer = { x: 0, y: 0 };
  let gridShownOnce = false;   // l'entrée animée des cartes ne joue qu'une fois
  let renderedSpace = null, renderedTag = null, renderedSig = new Map(); // ce que la grille affiche (rafraîchissement sans clignotement)

  // ===== API =====
  // Mêmes appels que dans HomeBoard, servis par le stockage local (store.js).
  const api = (path, opts) => Store.api(path, opts);

  const whenShareCodec = () => new Promise((resolve) => {
    const check = () => (window.ShareCodec ? resolve() : setTimeout(check, 30));
    check();
  });

  // ===== Démarrage (pas de compte : les données restent sur l'appareil) =====
  async function start() {
    currentUser = { id: 'local' };
    document.getElementById('app').classList.add('active');
    try {
      await Store.housekeeping();
      await loadSpaces();
      refreshBackupHint();
      await whenShareCodec();
      handleImportLink();
      cleanupExpired().catch(() => {});
      Sync.start(); // sans fenêtre : ne fait rien tant que la synchronisation n'est pas activée sur cet appareil
      refreshSyncButton();
      Telemetry.start(((document.querySelector('script[src*="/app.js"]') || {}).src || '').split('v=')[1] || '');
    } catch (e) {
      document.getElementById('grid').innerHTML = '';
      toast('Le stockage de ce navigateur est indisponible (navigation privée ?)', 'error');
    }
  }

  // ===== Spaces =====
  // Journal entièrement vide (nouvel appareil, app réinstallée, mémoire effacée) : on propose la sauvegarde Drive.
  let journalEmpty = false;
  let driveReady = false;
  let syncReady = false;
  async function loadSpaces() {
    const data = await api('/api/spaces');
    spaces = data.spaces || [];
    journalEmpty = !spaces.some(s => s.item_count > 0) && !(await api('/api/items?trash=1')).items.length;
    if (journalEmpty && !driveReady) driveReady = await Drive.available();
    syncReady = journalEmpty && driveReady && (await Drive.syncSupported()) && !(await Drive.syncLinked());
    renderSpacesTabs();
    await loadItems();
    await handleSharedIntent(); // partage reçu d'une autre appli → fenêtre d'ajout pré-remplie (une fois)
  }

  function renderSpacesTabs() {
    const bar = document.getElementById('spacesBar');
    bar.querySelectorAll('.space-tab').forEach(el => el.remove());

    const allTab = mk('button', 'space-tab' + (activeSpace === 'all' ? ' active' : ''));
    allTab.setAttribute('role', 'tab');
    allTab.setAttribute('aria-selected', activeSpace === 'all' ? 'true' : 'false');
    allTab.dataset.space = 'all';
    allTab.textContent = 'Tous';
    allTab.onclick = () => setSpace('all');
    bar.appendChild(allTab);

    orderedSpaces().forEach(s => {
      const tab = mk('button', 'space-tab' + (activeSpace === s.id ? ' active' : ''));
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', activeSpace === s.id ? 'true' : 'false');
      tab.dataset.space = s.id;
      tab.innerHTML = `${esc(s.name)} <span class="count">${s.item_count || 0}</span>`;
      tab.onclick = () => setSpace(s.id);
      // Appui long → réorganisation (drag). pointerdown mémorise la position de départ.
      tab.addEventListener('pointerdown', (e) => { lastPointer.x = e.clientX; lastPointer.y = e.clientY; });
      attachLongPress(tab, () => startReorder(tab, s.id));
      bar.appendChild(tab);
    });

    const trashTab = mk('button', 'space-tab space-tab-trash' + (activeSpace === 'trash' ? ' active' : ''));
    trashTab.setAttribute('role', 'tab');
    trashTab.dataset.space = 'trash';
    trashTab.textContent = 'Corbeille';
    trashTab.onclick = () => setSpace('trash');
    bar.appendChild(trashTab);
  }

  function setSpace(id) { activeSpace = id; activeTag = ''; renderSpacesTabs(); loadItems(); }

  async function createSpace() {
    const name = document.getElementById('spaceName').value.trim();
    if (!name) return;
    try {
      await api('/api/spaces', { method: 'POST', body: { name } });
      document.getElementById('spaceName').value = '';
      closeAddSpace();
      await loadSpaces();
      Telemetry.track('collection_created', { from: 'fenetre' });
      toast('Collection créée');
    } catch (e) { toast(e.message, 'error'); }
  }

  function showAddSpace() {
    document.getElementById('addSpaceModal').classList.add('active');
    setTimeout(() => document.getElementById('spaceName').focus(), 100);
  }
  function closeAddSpace() { document.getElementById('addSpaceModal').classList.remove('active'); document.getElementById('spaceName').value = ''; }

  // ===== Items =====
  async function loadItems() {
    const grid = document.getElementById('grid');
    // Cartes grises de chargement seulement quand on change de vue : un simple rafraîchissement
    // (synchro, image arrivée, ajout) garde les cartes affichées et ne remplace que ce qui change.
    const sameView = renderedSpace === activeSpace && grid.querySelector(':scope > .card');
    if (!sameView) {
      grid.innerHTML = '';
      for (let i = 0; i < 8; i++) { grid.appendChild(mk('div', 'skeleton-card')); }
      renderTagBar(); // réserve la barre de tags pendant le chargement (évite un saut de layout)
    }

    try {
      let u;
      if (activeSpace === 'trash') {
        u = '/api/items?trash=1';
      } else if (activeSpace === 'all') {
        u = '/api/items';
      } else {
        u = '/api/spaces/' + activeSpace + '/items';
      }
      const d = await api(u);
      items = d.items || [];
      if (sameView) { renderTagBar(); refreshGrid(); } else renderGrid();
    } catch { grid.innerHTML = emptyStateHtml(); renderedSpace = null; }
  }

  // Détecte une plateforme embarquable à partir de l'URL de l'item.
  // Retourne { platform, src } ou null. L'iframe est construite à la demande (au clic).
  function getEmbed(url) {
    if (!url) return null;
    let u; try { u = new URL(url); } catch { return null; }
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    let m;
    if (host.endsWith('tiktok.com') && (m = u.pathname.match(/\/(?:video|photo)\/(\d+)/)))
      return { platform: 'tiktok', src: `https://www.tiktok.com/player/v1/${m[1]}` };
    if (host.endsWith('instagram.com') && (m = u.pathname.match(/\/(p|reel|tv)\/([A-Za-z0-9_-]+)/)))
      return { platform: 'instagram', src: `https://www.instagram.com/${m[1]}/${m[2]}/embed/` };
    if ((host === 'x.com' || host.endsWith('twitter.com')) && (m = u.pathname.match(/\/status\/(\d+)/)))
      return { platform: 'twitter', src: `https://platform.twitter.com/embed/Tweet.html?id=${m[1]}&theme=light&dnt=true` };
    if (host.endsWith('youtube.com') && u.searchParams.get('v'))
      return { platform: 'youtube', src: `https://www.youtube.com/embed/${u.searchParams.get('v')}` };
    if (host === 'youtu.be' && u.pathname.length > 1)
      return { platform: 'youtube', src: `https://www.youtube.com/embed/${u.pathname.slice(1)}` };
    if (host.endsWith('youtube.com') && (m = u.pathname.match(/^\/shorts\/([A-Za-z0-9_-]+)/)))
      return { platform: 'youtube', src: `https://www.youtube.com/embed/${m[1]}` };
    if (/(^|\.)pinterest\.[a-z.]+$/.test(host) && (m = u.pathname.match(/\/pin\/(\d+)/)))
      return { platform: 'pinterest', src: `https://assets.pinterest.com/ext/embed.html?id=${m[1]}` };
    return null;
  }

  function openEmbed(id) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const emb = getEmbed(item.url);
    if (!emb) { window.open(item.url, '_blank', 'noopener'); return; }
    const box = document.getElementById('embedBox');
    box.className = 'embed-box embed-' + emb.platform;
    box.innerHTML = `<iframe src="${esc(emb.src)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin" title="${esc(item.title || emb.platform)}"></iframe>`;
    document.getElementById('embedTitle').textContent = item.title || '';
    document.getElementById('embedOpenLink').href = item.url;
    document.getElementById('embedModal').classList.add('active');
  }

  function closeEmbed() {
    document.getElementById('embedModal').classList.remove('active');
    document.getElementById('embedBox').innerHTML = ''; // stoppe la lecture (embed OU vidéo locale)
  }

  // Un média enregistré sur l'appareil est une image ou une vidéo : le stockage local le sait.
  const isVideoUrl = (u) => !!u && Store.kindOf(u) === 'video';

  // Lecteur in-app (médias uploadés) — image OU vidéo, réutilise la lightbox des embeds
  function openMedia(url, title) {
    if (!url) return;
    const isVid = isVideoUrl(url);
    const box = document.getElementById('embedBox');
    box.className = 'embed-box ' + (isVid ? 'embed-video' : 'embed-image');
    // Construction par DOM (.src) plutôt qu'innerHTML : aucun contexte HTML injectable.
    box.textContent = '';
    const el = document.createElement(isVid ? 'video' : 'img');
    el.src = url;
    if (isVid) { el.controls = true; el.autoplay = true; el.playsInline = true; el.preload = 'metadata'; }
    else { el.alt = title || 'Média'; }
    box.appendChild(el);
    document.getElementById('embedTitle').textContent = title || (isVid ? 'Vidéo' : 'Photo');
    document.getElementById('embedOpenLink').href = url;
    document.getElementById('embedModal').classList.add('active');
  }

  // ===== Catégories (cases à cocher) =====
  function renderCatChecks(containerId, selectedIds) {
    const sel = new Set(selectedIds || []);
    document.getElementById(containerId).innerHTML = spaces.map(s =>
      `<label class="cat-check"><input type="checkbox" value="${s.id}"${sel.has(s.id) ? ' checked' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg><span>${esc(s.name)}</span></label>`
    ).join('') + `<button type="button" class="cat-new" onclick="App.newCatInline('${containerId}')">+ Nouvelle collection</button>`;
  }
  // Créer une collection sans quitter la fenêtre d'ajout : la pastille devient un champ, Entrée crée et coche.
  function newCatInline(containerId) {
    const box = document.getElementById(containerId);
    const btn = box.querySelector('.cat-new');
    if (!btn) return;
    const input = mk('input', 'cat-new-input');
    input.type = 'text'; input.maxLength = 60; input.placeholder = 'Nom de la collection';
    input.setAttribute('aria-label', 'Nom de la nouvelle collection');
    btn.replaceWith(input);
    input.focus();
    let done = false;
    const finish = async (save) => {
      if (done) return;
      done = true;
      const keep = getCheckedCats(containerId);
      const name = input.value.trim();
      if (save && name) {
        try {
          const r = await api('/api/spaces', { method: 'POST', body: { name } });
          await loadSpaces();
          renderCatChecks(containerId, r.space ? [...keep, r.space.id] : keep);
          Telemetry.track('collection_created', { from: 'ajout' });
          toast('Collection créée');
          return;
        } catch (e) { toast(e.message, 'error'); }
      }
      renderCatChecks(containerId, keep);
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));
  }
  function getCheckedCats(containerId) {
    return [...document.querySelectorAll('#' + containerId + ' input:checked')].map(i => i.value);
  }

  // ===== Édition d'un item =====
  function openEdit(id) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    editingId = id;
    document.getElementById('actions-' + id)?.classList.remove('active');
    document.getElementById('editTitle').value = item.title || '';
    document.getElementById('editDesc').value = item.description || '';
    document.getElementById('editUrl').value = item.url || '';
    document.getElementById('editUrlGroup').style.display = item.type === 'link' ? '' : 'none';
    renderCatChecks('editItemCats', item.space_ids || []);
    document.getElementById('editItemModal').classList.add('active');
  }
  function closeEdit() { document.getElementById('editItemModal').classList.remove('active'); editingId = null; }
  async function submitEdit() {
    if (!editingId) return;
    const cats = getCheckedCats('editItemCats');
    if (cats.length === 0) { toast('Choisis au moins une catégorie', 'error'); return; }
    const btn = document.querySelector('#editItemModal .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = 'Enregistrement…'; }
    try {
      await api('/api/items/' + editingId, { method: 'PUT', body: {
        title: document.getElementById('editTitle').value.trim(),
        description: document.getElementById('editDesc').value.trim(),
        url: document.getElementById('editUrl').value.trim(),
        space_ids: cats,
      }});
      closeEdit();
      toast('Modifié');
      await loadItems(); await loadSpaces();
    } catch (e) { toast(e.message, 'error'); }
    finally { if (btn) { btn.disabled = false; btn.textContent = 'Enregistrer'; } }
  }

  // ===== Corbeille =====
  async function restoreItem(id) {
    try {
      await api('/api/items/' + id, { method: 'PUT', body: { restore: true } });
      toast('Restauré'); await loadItems(); await loadSpaces();
    } catch (e) { toast(e.message, 'error'); }
  }
  async function deleteForever(id) {
    const ok = await showConfirm('Supprimer définitivement ? Action irréversible.');
    if (!ok) return;
    try {
      await api('/api/items/' + id + '?permanent=1', { method: 'DELETE' });
      toast('Supprimé définitivement'); await loadItems(); await loadSpaces();
    } catch (e) { toast(e.message, 'error'); }
  }

  // Appui long (mobile + souris) → callback, en neutralisant le clic qui suit
  function attachLongPress(el, cb) {
    let timer = null, fired = false;
    const start = () => { fired = false; timer = setTimeout(() => { fired = true; cb(); }, 500); };
    const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
    el.addEventListener('pointerdown', start);
    el.addEventListener('pointerup', cancel);
    el.addEventListener('pointerleave', cancel);
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('click', (e) => { if (fired) { e.stopImmediatePropagation(); e.preventDefault(); fired = false; } }, true);
  }

  function renderGrid() {
    renderTagBar(); // les tags dépendent des items chargés — on rafraîchit la barre à chaque rendu
    const grid = document.getElementById('grid');
    grid.innerHTML = '';
    grid.classList.toggle('reveal', !gridShownOnce);
    gridShownOnce = true;
    const visible = activeTag ? items.filter(it => tagsOf(it).includes(activeTag)) : items;
    if (visible.length === 0) { grid.innerHTML = emptyStateHtml(activeTag); renderedSpace = null; renderedSig = new Map(); return; }

    visible.forEach((item, idx) => grid.appendChild(buildCard(item, idx)));
    renderedSpace = activeSpace;
    renderedTag = activeTag;
    renderedSig = new Map(visible.map((it) => [it.id, cardSig(it)]));
  }

  // Ce qui change l'apparence d'une carte : si rien de cela ne bouge, la carte reste telle quelle à l'écran.
  const cardSig = (it) => JSON.stringify([it.title, it.description, it.url, it.image_url, it.status, it.space_ids, it.price, it.deleted_at, selecting && selected.has(it.id)]);

  // Rafraîchissement sans clignotement : même vue et mêmes cartes dans le même ordre → seules les cartes
  // modifiées sont remplacées (une image arrivée du Drive, un titre changé). Sinon, rendu complet.
  function refreshGrid() {
    const grid = document.getElementById('grid');
    const visible = activeTag ? items.filter(it => tagsOf(it).includes(activeTag)) : items;
    const ids = visible.map((it) => it.id);
    const same = renderedSpace === activeSpace && renderedTag === activeTag && !selecting
      && ids.length === renderedSig.size && ids.every((id) => renderedSig.has(id))
      && grid.querySelectorAll(':scope > .card').length === ids.length;
    if (!same) { renderGrid(); return; }
    const cards = grid.querySelectorAll(':scope > .card');
    visible.forEach((item, idx) => {
      const sig = cardSig(item);
      if (renderedSig.get(item.id) === sig) return;
      cards[idx].replaceWith(buildCard(item, idx));
      renderedSig.set(item.id, sig);
    });
  }

  function buildCard(item, idx) {
      const card = mk('div', 'card');
      card.style.setProperty('--card-index', idx);
      // Posée comme une note épinglée : inclinaison, décalage et épingle tirés de l'identifiant (stables d'un affichage à l'autre).
      const pinSeed = [...String(item.id)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
      card.style.setProperty('--tilt', `${(((pinSeed % 37) / 36) * 3.6 - 1.8).toFixed(2)}deg`);
      card.style.setProperty('--nx', `${((pinSeed >> 6) % 7) - 3}px`);
      card.style.setProperty('--gap-extra', `${(pinSeed >> 9) % 13}px`);
      card.dataset.pin = String((pinSeed >> 13) % 3);
      if (selecting) {
        card.classList.toggle('is-selected', selected.has(item.id));
        card.setAttribute('aria-pressed', selected.has(item.id) ? 'true' : 'false');
        // Mode sélection : un toucher choisit le lien au lieu de l'ouvrir.
        card.addEventListener('click', (e) => { e.stopImmediatePropagation(); e.preventDefault(); if (item.url) toggleSelected(item.id, card); }, true);
      }
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'article');
      const spaceName = spaces.find(s => s.id === item.space_id)?.name || '';

      // Lecteur intégré possible ? (TikTok, Instagram, X, YouTube)
      const emb = item.type === 'link' ? getEmbed(item.url) : null;
      const playSvg = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
      const embedBadge = emb
        ? `<div class="embed-badge embed-badge-${emb.platform}">${playSvg}<span>${emb.platform === 'twitter' ? 'X' : emb.platform}</span></div>`
        : '';

      // Média : image ou vidéo (les vidéos uploadées ont une extension vidéo)
      const isVideo = item.type === 'photo' && isVideoUrl(item.image_url);
      const isTrash = activeSpace === 'trash';
      let mediaHtml = '';
      if (item.image_url) {
        mediaHtml = isVideo
          ? `<video class="card-video" src="${esc(item.image_url)}#t=0.1" muted playsinline preload="metadata" onerror="var w=this.closest('.card-image-wrap'); if(w) w.remove()"></video>`
          : `<img class="card-image" src="${esc(item.image_url)}" alt="${esc(item.title)}" loading="lazy" width="400" height="300" onerror="this.style.display='none'; var w=this.closest('.card-image-wrap'); var f=w&&w.querySelector('.card-play-facade'); if(f){f.style.display='flex'} else if(w){w.remove()}">`;
      }
      // Facade "play" quand un lecteur est possible mais sans miniature (pas de zone grise)
      const bigPlay = '<svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
      const facade = emb
        ? `<div class="card-play-facade embed-badge-${emb.platform}"${item.image_url ? ' style="display:none"' : ''}>${bigPlay}</div>`
        : '';
      const videoBadge = isVideo ? `<div class="embed-badge embed-badge-video">${playSvg}<span>vidéo</span></div>` : '';
      const hasVisual = !!(item.image_url || emb);

      // Status
      const st = item.status;
      const statusLabels = { a_voir: 'À voir', vu: 'Vu', favori: 'Favori' };
      const sc = { a_voir: 'status-a-voir', vu: 'status-vu', favori: 'status-favori' };

      const buyer = '';

      let priceHtml = item.price ? `<div class="card-price">${esc(item.price)}</div>` : '';

      // Catégories multiples → puces
      const catNames = (item.space_ids || []).map(sid => spaces.find(s => s.id === sid)?.name).filter(Boolean);
      const catChips = catNames.length && spaces.length > 1
        ? `<div class="card-cats">${catNames.map(n => `<span class="cat-chip">${esc(n)}</span>`).join('')}</div>` : '';


      const dotsSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';

      let menuHtml;
      if (isTrash) {
        const dl = item.deleted_at
          ? Math.max(0, 30 - Math.floor((Date.now() - new Date(item.deleted_at.replace(' ', 'T') + 'Z').getTime()) / 86400000))
          : 30;
        menuHtml = `<div class="trash-bar">
          <span class="trash-note">Purge dans ${dl} j</span>
          <button class="btn btn-xs btn-ghost" onclick="App.restoreItem('${item.id}')">Restaurer</button>
          <button class="btn btn-xs btn-danger" onclick="App.deleteForever('${item.id}')">Supprimer</button>
        </div>`;
      } else {
        menuHtml = `
        <button class="card-menu-btn" onclick="App.showItemActions(event, '${item.id}')" aria-label="Actions pour ${esc(item.title)}" aria-haspopup="true">${dotsSvg}</button>
        <div class="actions-dropdown" id="actions-${item.id}" role="menu" aria-label="Actions">
          <button role="menuitem" onclick="App.openEdit('${item.id}')">Modifier</button>
          <div class="divider"></div>
          <button role="menuitem" onclick="App.changeStatus('${item.id}', 'a_voir')">À voir</button>
          <button role="menuitem" onclick="App.changeStatus('${item.id}', 'vu')">Marquer vu</button>
          <button role="menuitem" onclick="App.changeStatus('${item.id}', 'favori')">Favori</button>
          <div class="divider"></div>
          <button role="menuitem" class="danger" onclick="App.deleteItem('${item.id}')">Mettre à la corbeille</button>
        </div>`;
      }

      const imageWrapHtml = hasVisual
        ? `<div class="card-image-wrap">${mediaHtml}${facade}${item.image_url && emb ? embedBadge : ''}${videoBadge}</div>`
        : '';

      const footerHtml = isTrash ? '' : `<div class="card-footer">
            <span class="status-pill ${sc[st] || sc.a_voir}">${statusLabels[st] || statusLabels.a_voir}</span>
            ${buyer}
          </div>`;

      card.innerHTML = `
        ${imageWrapHtml}
        ${menuHtml}
        <div class="card-body">
          ${catChips}
          <div class="card-title">${esc(item.title)}</div>
          <div class="card-desc">${esc(item.description)}</div>
          ${priceHtml}
          ${footerHtml}
        </div>
      `;

      // Interactions (désactivées en corbeille)
      if (!isTrash) {
        // Média local (photo ou vidéo uploadée) → lightbox ; lien → embed sinon nouvel onglet.
        const isLocalMedia = item.type === 'photo' && !!item.image_url;
        if (isLocalMedia || (item.type === 'link' && item.url)) {
          if (emb || isLocalMedia) card.classList.add('is-embeddable');
          card.addEventListener('click', (e) => {
            if (e.target.closest('.card-menu-btn') || e.target.closest('.actions-dropdown')) return;
            if (isLocalMedia) openMedia(item.image_url, item.title);
            else if (emb) openEmbed(item.id);
            else window.open(item.url, '_blank', 'noopener');
          });
        }
        // Appui long → panneau d'édition (mobile + souris)
        attachLongPress(card, () => { if (!selecting) openEdit(item.id); });
      }

      return card;
  }

  function emptyStateHtml(filtered) {
    const mark = '<img src="/brand/leketia-mark.webp" alt="" width="96" height="96"><span class="bitline" aria-hidden="true">' + '1101100'.split('').map(b => `<i class="${b === '1' ? '' : 'o'}"></i>`).join('') + '</span>';
    if (activeSpace === 'trash') return `<div class="empty-state"><div class="illustration">${mark}</div><h3>La corbeille est vide</h3><p>Les éléments supprimés restent ici 30 jours.</p></div>`;
    // Première synchro d'un appareil vide : le journal arrive du Drive, on l'attend au milieu de la page.
    if (!filtered && journalEmpty && Sync.state().status === 'syncing') {
      return '<div class="empty-state sync-loading" role="status"><div class="spinner"></div><h3>Ton journal arrive</h3><p>Récupération depuis ton Google Drive. Les liens s’affichent dès qu’ils sont là.</p></div>';
    }
    const heading = filtered ? 'Aucun élément pour ce filtre' : 'Ton journal est vide';
    const hint = filtered ? 'Choisis un autre tag ou ajoute un lien.' : 'Partage un lien depuis une autre appli, ou ajoute-le ici.';
    if (!filtered && journalEmpty && syncReady) {
      return `<div class="empty-state"><div class="illustration">${mark}</div><h3>Ton journal est vide</h3><p>Tu utilises leketia sur un autre appareil ? Connecte le même compte Google : ton journal arrive ici et reste à jour tout seul.</p><div class="empty-actions"><button class="btn btn-cta" onclick="App.syncConnect(this)">Synchroniser mes appareils</button><button class="btn btn-ghost" onclick="App.showAddItem()">Commencer un nouveau journal</button><button class="btn btn-ghost" onclick="App.showBackup()">Restaurer depuis un fichier</button></div></div>`;
    }
    if (!filtered && journalEmpty && driveReady) {
      return `<div class="empty-state"><div class="illustration">${mark}</div><h3>Ton journal est vide</h3><p>Tu avais sauvegardé ton journal dans Google Drive ? Récupère la dernière sauvegarde en un toucher.</p><div class="empty-actions"><button class="btn btn-primary" onclick="App.restoreLatest(this)">Restaurer depuis Google Drive</button><button class="btn btn-ghost" onclick="App.showAddItem()">Commencer un nouveau journal</button><button class="btn btn-ghost" onclick="App.showBackup()">Restaurer depuis un fichier</button></div></div>`;
    }
    const restore = filtered ? '' : '<button class="btn btn-ghost empty-restore" onclick="App.showBackup()">Retrouver mon journal (Google Drive ou fichier)</button>';
    return `<div class="empty-state"><div class="illustration">${mark}</div><h3>${heading}</h3><p>${hint}</p><button class="btn btn-primary" onclick="App.showAddItem()">Ajouter un lien</button>${restore}</div>`;
  }

  function showItemActions(e, id) {
    e.stopPropagation();
    document.querySelectorAll('.actions-dropdown.active').forEach(d => d.classList.remove('active'));
    document.getElementById('actions-' + id)?.classList.add('active');
  }

  async function changeStatus(id, newStatus) {
    try {
      await api('/api/items/' + id + '/status', { method: 'PATCH', body: { status: newStatus } });
      document.getElementById('actions-' + id)?.classList.remove('active');
      toast('Statut mis à jour');
      await loadItems();
    } catch (e) { toast(e.message, 'error'); }
  }

  // Designed confirm dialog (replaces native confirm())
  function showConfirm(msg, okLabel = 'Supprimer', { danger = okLabel === 'Supprimer' } = {}) {
    return new Promise((resolve) => {
      confirmResolve = resolve;
      const ok = document.getElementById('confirmOk');
      ok.textContent = okLabel;
      ok.className = 'btn btn-sm ' + (danger ? 'btn-danger' : 'btn-primary');
      document.getElementById('confirmMessage').textContent = msg;
      document.getElementById('confirmDialog').classList.add('active');
      document.getElementById('confirmCancel').focus();
    });
  }

  function _closeConfirm(result) {
    document.getElementById('confirmDialog').classList.remove('active');
    if (confirmResolve) { confirmResolve(result); confirmResolve = null; }
  }

  async function deleteItem(id) {
    try {
      await api('/api/items/' + id, { method: 'DELETE' }); // suppression douce → corbeille
      document.getElementById('actions-' + id)?.classList.remove('active');
      toast('Déplacé dans la corbeille');
      await loadItems(); await loadSpaces();
    } catch (e) { toast(e.message, 'error'); }
  }

  // ===== Add Item Modal =====
  // Comment faire arriver un lien ici depuis une autre appli, selon le téléphone.
  function shareHintText() {
    const p = Install.parcours, installed = Install.ouverteInstallee();
    if (p.startsWith('ios')) return 'Sur iPhone : dans l’appli (Instagram, X, YouTube…), touche Partager puis Copier le lien, reviens ici et touche Coller le lien.';
    if (p === 'android' || p === 'android-autre') return installed
      ? 'Depuis une autre appli : touche Partager, puis choisis leketia.'
      : 'Installe leketia depuis Chrome : elle apparaîtra dans le menu Partager de tes applis.';
    if (p === 'integre') return 'Ouvre cette page dans ton navigateur pour installer leketia.';
    return '';
  }
  function showAddItem() {
    const hint = document.getElementById('shareHint');
    hint.textContent = shareHintText();
    hint.hidden = !hint.textContent;
    if (spaces.length === 0) { toast('Crée d\'abord une collection', 'error'); showAddSpace(); return; }
    const s = activeSpace !== 'all' ? spaces.find(x => x.id === activeSpace) : spaces[0];
    document.getElementById('addItemTitle').textContent = 'Ajouter au journal';
    document.getElementById('addItemModal').classList.add('active');
    resetAddItemForm();
    const pre = (activeSpace !== 'all' && activeSpace !== 'trash') ? [activeSpace] : (s ? [s.id] : []);
    renderCatChecks('addItemCats', pre);
    refreshInboxButton();
  }
  // iPhone, app installée, Drive déjà relié : « Recevoir depuis Safari » relève la boîte d'arrivée du Drive.
  function refreshInboxButton() {
    const b = inboxButton();
    if (b) b.hidden = !(Install.ouverteInstallee() && /^ios/.test(InstallParcours.parcours(navigator.userAgent, navigator.maxTouchPoints || 0)) && Drive.linked());
  }
  function closeAddItem() { document.getElementById('addItemModal').classList.remove('active'); resetAddItemForm(); addVia = 'manuel'; }

  // Partage reçu d'une autre appli. Android : le service worker lit le partage, garde un éventuel
  // fichier sur l'appareil, puis ouvre /?share_... . iPhone : un Raccourci ouvre /add?u=<lien>.
  // Dans les deux cas on ouvre la fenêtre d'ajout pré-remplie.
  async function handleSharedIntent() {
    if (sharedIntentHandled) return;
    const p = new URLSearchParams(location.search);
    const shareUrl = p.get('share_url') || (location.pathname === '/add' ? p.get('u') : '') || '';
    const shareTitle = p.get('share_title') || '';
    const shareText = p.get('share_text') || '';
    const shareMedia = p.get('share_media') || '';
    const shareKind = p.get('share_kind') || '';
    if (!shareUrl && !shareText && !shareMedia) return;
    // Sécurité : share_media vient de l'adresse (forgeable) → seul un identifiant de fichier local est accepté.
    if (shareMedia && !/^[A-Za-z0-9-]{8,64}$/.test(shareMedia)) return;
    sharedIntentHandled = true;
    addVia = 'partage';

    if (shareMedia) {
      // Fichier déjà gardé sur l'appareil par le service worker → aperçu, sans le réenregistrer.
      const localUrl = await Store.urlForMedia(shareMedia);
      history.replaceState({}, '', '/');
      if (!localUrl) { toast('Le fichier partagé est introuvable', 'error'); return; }
      showAddItem();
      switchModalTab('photo');
      sharedMediaUrl = localUrl;
      sharedMediaKind = Store.kindOf(localUrl) === 'video' ? 'video' : 'image';
      const box = document.getElementById('photoPreview');
      // Construction par DOM (.src) plutôt qu'innerHTML : aucun contexte HTML injectable.
      box.textContent = '';
      const el = document.createElement(sharedMediaKind === 'video' ? 'video' : 'img');
      el.src = sharedMediaUrl;
      if (sharedMediaKind === 'video') { el.muted = true; el.playsInline = true; el.controls = true; el.preload = 'metadata'; }
      else { el.alt = 'Aperçu du média partagé'; }
      box.appendChild(el);
      box.style.display = 'block';
      setTimeout(() => document.getElementById('photoTitle').focus(), 100); // titre requis
    } else {
      // Lien (ou texte) → onglet lien, URL pré-remplie, auto-fetch de l'aperçu.
      showAddItem();
      switchModalTab('link');
      let url = shareUrl;
      if (!url && shareText) { const m = shareText.match(/https?:\/\/\S+/); if (m) url = m[0]; }
      url = Store.safeLink(url); // seuls les liens http(s) sont acceptés
      if (url) document.getElementById('linkUrl').value = url;
      if (shareTitle) document.getElementById('linkTitle').value = shareTitle;
      else if (!url && shareText) document.getElementById('linkTitle').value = shareText;
      if (url) fetchLinkPreview();
    }
    history.replaceState({}, '', '/'); // nettoie l'URL → pas de re-déclenchement au refresh
  }

  function resetAddItemForm() {
    ['linkUrl','linkTitle','linkDesc','linkPrice','photoTitle','photoDesc','photoUrl','photoPrice'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('linkPreview').style.display = 'none';
    document.getElementById('linkPreview').innerHTML = '';
    document.getElementById('photoFile').value = '';
    document.getElementById('photoPreview').style.display = 'none';
    mediaFile = null;
    mediaKind = 'image';
    sharedMediaUrl = null;
    sharedMediaKind = 'image';
    linkCanonicalUrl = '';
    linkImageUrl = '';
    lastAutoFetched = '';
    if (_linkDebounce) { clearTimeout(_linkDebounce); _linkDebounce = null; }
    switchModalTab('link');
  }

  function switchModalTab(tab) {
    activeModalTab = tab;
    document.getElementById('tabLink').style.display = tab === 'link' ? '' : 'none';
    document.getElementById('tabPhoto').style.display = tab === 'photo' ? '' : 'none';
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  }

  // Le lecteur de X annonce la hauteur réelle du tweet : l'aperçu prend cette hauteur, sans vide dessous.
  window.addEventListener('message', (e) => {
    if (e.origin !== 'https://platform.twitter.com') return;
    let d = e.data;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch { return; } }
    const m = d && d['twttr.embed'];
    const h = m && m.method === 'twttr.private.resize' && m.params && m.params[0] && Number(m.params[0].height);
    if (!h) return;
    const frame = [...document.querySelectorAll('.link-preview-embed')].find((f) => f.contentWindow === e.source);
    if (frame) frame.style.height = Math.min(Math.max(h + 4, 120), 900) + 'px';
  });

  async function fetchLinkPreview() {
    const url = document.getElementById('linkUrl').value.trim();
    if (!url) return;
    const boardRef = leketiaBoardRef(url); // une page leketia collée dans le champ : on l'importe au lieu d'en faire un lien
    if (boardRef) { closeAddItem(); try { await importBoard(boardRef); } catch (e) { toast(e.message, 'error'); } return; }
    // Annule un éventuel auto-fetch en attente pour éviter un double POST identique
    if (_linkDebounce) { clearTimeout(_linkDebounce); _linkDebounce = null; }
    lastAutoFetched = /^https?:\/\//i.test(url) ? url : 'https://' + url;
    const preview = document.getElementById('linkPreview');
    preview.style.display = 'block';
    preview.innerHTML = '<div style="text-align:center"><div class="spinner"></div></div>';
    try {
      const data = await api('/api/fetch-link', { method: 'POST', body: { url } });
      const p = data.preview;
      linkCanonicalUrl = data.canonical_url || '';
      document.getElementById('linkTitle').value = p.title || '';
      document.getElementById('linkDesc').value = p.description || '';
      // Instagram, TikTok et X : le post lui-même sert d'aperçu (lecteur intégré), comme dans la carte.
      // L'image éventuelle (miniature, photo de profil sur X) est gardée à part pour la carte.
      // Autres liens : le lecteur seulement s'il n'y a pas d'image.
      linkImageUrl = p.image_url || '';
      const e0 = getEmbed(linkCanonicalUrl || lastAutoFetched);
      const emb = e0 && (['instagram', 'tiktok', 'twitter'].includes(e0.platform) || !p.image_url) ? e0 : null;
      if (emb) {
        preview.replaceChildren();
        const frame = mk('iframe', 'link-preview-embed embed-' + emb.platform);
        frame.src = emb.src;
        frame.title = 'Aperçu du post';
        frame.loading = 'lazy';
        frame.allow = 'encrypted-media; picture-in-picture; fullscreen';
        frame.referrerPolicy = 'strict-origin-when-cross-origin';
        preview.append(frame);
        if (!p.title || /^(instagram|tiktok|vidéo tiktok|x)$/i.test(p.title)) document.getElementById('linkTitle').value = '';
        return;
      }
      let imgHtml = p.image_url ? `<img src="${esc(p.image_url)}" alt="preview" onerror="this.style.display='none'">` : '';
      let noteHtml = data.note ? `<div class="desc">${esc(data.note)}</div>` : '';
      preview.innerHTML = imgHtml + (p.title ? `<div class="desc">${esc(p.title)}</div>` : '') + noteHtml;
      if (!p.title && !p.image_url && !data.note) preview.innerHTML = '<div class="desc">Aucune info trouvée. Remplissez manuellement.</div>';
    } catch (e) { preview.innerHTML = `<div class="desc" style="color:var(--danger)">${esc(e.message)}</div>`; }
  }

  function previewPhoto() {
    const file = document.getElementById('photoFile').files[0];
    if (!file) return;
    mediaFile = file;
    mediaKind = file.type.startsWith('video/') ? 'video' : 'image';
    sharedMediaUrl = null; // l'utilisateur choisit son propre fichier → prime sur un média partagé
    const box = document.getElementById('photoPreview');
    // Aperçu local via un blob URL (léger, pas de base64 en mémoire)
    const objUrl = URL.createObjectURL(file);
    box.innerHTML = mediaKind === 'video'
      ? `<video src="${objUrl}" muted playsinline controls preload="metadata"></video>`
      : `<img src="${objUrl}" alt="Aperçu">`;
    box.style.display = 'block';
  }

  let submitting = false;
  async function submitItem() {
    if (submitting) return; // garde anti double-soumission
    const cats = getCheckedCats('addItemCats');
    if (cats.length === 0) { toast('Choisis au moins une catégorie', 'error'); return; }

    const btn = document.querySelector('#addItemModal .btn-primary');
    submitting = true;
    if (btn) { btn.disabled = true; btn.textContent = 'Ajout…'; }
    try {
      if (activeModalTab === 'link') {
        const url = document.getElementById('linkUrl').value.trim();
        if (!url) { toast('URL requise', 'error'); return; }
        await api('/api/spaces/' + cats[0] + '/items', {
          method: 'POST', body: {
            type: 'link', url: linkCanonicalUrl || url, space_ids: cats,
            title: document.getElementById('linkTitle').value.trim(),
            description: document.getElementById('linkDesc').value.trim(),
            image_url: linkImageUrl || document.getElementById('linkPreview').querySelector('img')?.src || '',
          }
        });
      } else {
        const title = document.getElementById('photoTitle').value.trim();
        if (!title) { toast('Titre requis', 'error'); return; }
        // Fichier partagé : déjà sur l'appareil. Sinon : on enregistre le fichier choisi.
        let imageUrl = sharedMediaUrl;
        if (!imageUrl) {
          if (!mediaFile) { toast('Photo ou vidéo requise', 'error'); return; }
          const media = await uploadMedia(mediaFile);
          imageUrl = media.media_url;
        }
        await api('/api/spaces/' + cats[0] + '/items', {
          method: 'POST', body: {
            type: 'photo', title, space_ids: cats,
            description: document.getElementById('photoDesc').value.trim(),
            url: document.getElementById('photoUrl').value.trim(),
            image_url: imageUrl,
          }
        });
      }
      if (activeModalTab === 'link') Telemetry.track('link_added', { rs: Telemetry.rsOf(linkCanonicalUrl || document.getElementById('linkUrl').value.trim()), via: addVia, image: !!(linkImageUrl || document.getElementById('linkPreview').querySelector('img')), collections: cats.length });
      else Telemetry.track('photo_added', { kind: sharedMediaKind === 'video' || mediaKind === 'video' ? 'video' : 'image', via: addVia });
      addVia = 'manuel';
      closeAddItem();
      toast('Ajouté au journal');
      await loadItems(); await loadSpaces();
    } catch (e) { toast(e.message, 'error'); }
    finally {
      submitting = false;
      if (btn) { btn.disabled = false; btn.textContent = 'Ajouter'; }
    }
  }

  // Enregistre un média (image ou vidéo) sur l'appareil. Renvoie { media_url, kind }.
  async function uploadMedia(file) {
    const kind = file.type.startsWith('video/') ? 'video' : 'image';
    if (kind === 'video' && file.size > 100 * 1024 * 1024) throw new Error('Vidéo trop lourde (100 Mo maximum)');
    const m = await Store.saveMedia(file, kind);
    return { media_url: m.url, kind: m.kind };
  }

  // ===== Coller un lien (voie universelle, la seule sans réglage sur iPhone) =====
  async function pasteLink() {
    try {
      const clip = (await navigator.clipboard.readText()).trim();
      const m = clip.match(/https?:\/\/\S+/);
      const url = Store.safeLink(m ? m[0] : clip);
      if (!url) { toast('Le presse-papiers ne contient pas de lien', 'error'); return; }
      const ref = leketiaBoardRef(url);
      if (ref) { closeAddItem(); try { await importBoard(ref); } catch (e) { toast(e.message, 'error'); } return; } // page leketia : on l'importe
      document.getElementById('linkUrl').value = url;
      addVia = 'collage';
      fetchLinkPreview();
    } catch { toast('Lecture du presse-papiers refusée : colle le lien dans le champ', 'error'); }
  }

  // ===== Partager : QR code, lien autoporteur, texte pour une IA (aucun stockage) =====
  const QR_MAX = 1500;     // au-delà, un QR affiché sur un écran se scanne mal
  const LINK_MAX = 15000;  // longueur d'adresse acceptée par l'hébergeur (≈ 16 000 caractères)
  let shareTab = 'qr';
  let shareRun = 0;

  // Une page publiée a une source : une collection (src, '' pour tout le journal) ou des liens choisis (ids).
  // Clés : « pg-… » (pages actuelles, plusieurs par source possibles) ; anciennes : « all », id de collection, « sel-… ».
  const isPageKey = (v) => !!v && (v.startsWith('sel-') || v.startsWith('pg-'));
  const pubSource = (key, pub) => (pub && pub.ids ? { ids: pub.ids } : { src: pub && pub.src !== undefined ? pub.src : (key === 'all' ? '' : key) });

  async function boardFor(scope, { thumbs = false } = {}) {
    if (isPageKey(scope)) {
      const pub = (await Store.publications())[scope];
      return pub ? pubBoard(scope, pub, { thumbs }) : boardOf([], 'Ma sélection', false);
    }
    let its, name;
    if (scope === 'sel') {
      // Partage personnalisé : les liens choisis au clic.
      const all = (await api('/api/items')).items;
      its = [...selected].map(id => all.find(it => it.id === id)).filter(it => it && it.url);
      name = document.getElementById('shareName').value.trim() || 'Ma sélection';
    } else {
      const path = scope ? '/api/spaces/' + encodeURIComponent(scope) + '/items' : '/api/items';
      its = (await api(path)).items.filter(it => it.url);
      name = scope ? (spaces.find(s => s.id === scope) || {}).name : 'Mon journal';
    }
    return boardOf(its, name, thumbs);
  }
  // Le contenu actuel d'une page publiée.
  async function pubBoard(key, pub, { thumbs = false } = {}) {
    const s = pubSource(key, pub);
    if (!s.ids) return boardFor(s.src || null, { thumbs });
    const all = (await api('/api/items')).items;
    return boardOf(s.ids.map(id => all.find(it => it.id === id)).filter(it => it && it.url), pub.name || 'Ma sélection', thumbs);
  }
  async function boardOf(its, name, thumbs) {
    const links = its.map(it => ({ title: it.title, url: it.url, note: it.description }));
    if (thumbs) { // page publiée : petites miniatures intégrées au fichier, dans la limite du budget
      let budget = THUMB_BUDGET;
      for (let i = 0; i < its.length; i++) {
        if (!its[i].image_url || its[i].media_kind === 'video') continue;
        const img = await thumbData(its[i].image_url);
        if (img && img.length <= budget) { links[i].img = img; budget -= img.length; }
      }
    }
    return { name: name || 'Mon journal', date: new Date().toISOString().slice(0, 10), links };
  }

  // Miniature réduite (240 px de large, JPEG) en texte data:, mémorisée pendant la session.
  const THUMB_BUDGET = 700 * 1024;
  const thumbCache = new Map();
  async function thumbData(blobUrl) {
    if (thumbCache.has(blobUrl)) return thumbCache.get(blobUrl);
    let out = '';
    try {
      const bmp = new Image(); // pas de fetch() : la politique de sécurité de l'app refuse fetch sur blob:
      bmp.src = blobUrl;
      await bmp.decode();
      const scale = Math.min(1, 240 / bmp.naturalWidth);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bmp.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(bmp.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); // JPEG n'a pas de transparence
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      out = canvas.toDataURL('image/jpeg', 0.7);
      if (!out.startsWith('data:image/jpeg') || out.length > ShareCodec.MAX_IMG_CHARS) out = '';
    } catch { out = ''; }
    thumbCache.set(blobUrl, out);
    return out;
  }
  // Le plus grand début du board dont le lien tient dans la limite (recherche par dichotomie).
  async function fitBoard(board, max, lock = null) {
    const url = async (n) => {
      const d = await ShareCodec.encode({ ...board, links: board.links.slice(0, n) });
      return lock ? `${location.origin}/b?e=${await ShareCodec.sealWithKey(lock.key, lock.salt, d)}` : `${location.origin}/b?d=${d}`;
    };
    let full = await url(board.links.length);
    if (full.length <= max) return { url: full, count: board.links.length };
    let lo = 0, hi = board.links.length;
    while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if ((await url(mid)).length <= max) lo = mid; else hi = mid - 1; }
    return { url: await url(lo), count: lo };
  }
  // Options de protection : mot de passe (chiffrement dans le navigateur) et date limite.
  function shareExpires() {
    const v = document.getElementById('shareExp').value;
    if (!v) return '';
    if (v === 'custom') {
      const d = document.getElementById('shareExpDate').value;
      return d ? new Date(d + 'T23:59:59').toISOString() : '';
    }
    return new Date(Date.now() + Number(v) * 86400000).toISOString();
  }
  const sharePassword = () => document.getElementById('sharePw').value;
  let lockCache = { pw: '', lock: null };
  async function shareLock() { // une seule dérivation de clé par mot de passe (elle est volontairement lente)
    const pw = sharePassword();
    if (!pw) return null;
    if (lockCache.pw !== pw) lockCache = { pw, lock: await ShareCodec.newKey(pw) };
    return lockCache.lock;
  }
  let optionsTimer = null;
  function shareOptionsChanged() {
    document.getElementById('shareExpDate').hidden = document.getElementById('shareExp').value !== 'custom';
    clearTimeout(optionsTimer);
    optionsTimer = setTimeout(renderShare, 450);
  }
  function scopeChanged() {
    const v = document.getElementById('shareScope').value;
    if (v === '__pick') { closeShare(); startSelecting(); return; }
    document.getElementById('shareNameGroup').hidden = v !== 'sel';
    renderShare();
  }

  async function showShare(preset) {
    const sel = document.getElementById('shareScope');
    const opts = [new Option('Tout le journal', ''), ...orderedSpaces().map(s => new Option(`Collection « ${s.name} »`, s.id))];
    if (selected.size) opts.push(new Option(`Ma sélection (${selected.size} lien${selected.size > 1 ? 's' : ''})`, 'sel'));
    const pubs = await Store.publications();
    for (const [k, p] of Object.entries(pubs)) if (p.ids) opts.push(new Option(`Sélection publiée « ${p.name || 'Ma sélection'} »`, k));
    opts.push(new Option('Choisir les liens au clic…', '__pick'));
    sel.replaceChildren(...opts);
    // Chaque ouverture repart sans protection : un ancien mot de passe ou une ancienne date ne s'appliquent jamais en douce.
    document.getElementById('sharePw').value = '';
    document.getElementById('shareExp').value = '';
    document.getElementById('shareExpDate').value = '';
    document.getElementById('shareExpDate').hidden = true;
    lockCache = { pw: '', lock: null };
    qrTracked = false;
    if (preset) sel.value = preset;
    else if (activeSpace !== 'all' && activeSpace !== 'trash') sel.value = activeSpace;
    document.getElementById('shareNameGroup').hidden = sel.value !== 'sel';
    document.getElementById('shareModal').classList.add('active');
    setShareTab(shareTab);
  }

  // ===== Sélection au clic (partage personnalisé) =====
  let selecting = false;
  const selected = new Set();
  function startSelecting() {
    selecting = true;
    document.body.classList.add('selecting');
    document.getElementById('selectBar').hidden = false;
    if (activeSpace === 'trash') setSpace('all'); else renderGrid();
    updateSelectBar();
    toast('Touche les liens à partager');
  }
  function stopSelecting(keep = false) {
    selecting = false;
    if (!keep) selected.clear();
    document.body.classList.remove('selecting');
    document.getElementById('selectBar').hidden = true;
    renderGrid();
  }
  function toggleSelected(id, card) {
    if (selected.has(id)) selected.delete(id); else selected.add(id);
    card.classList.toggle('is-selected', selected.has(id));
    card.setAttribute('aria-pressed', selected.has(id) ? 'true' : 'false');
    updateSelectBar();
  }
  function updateSelectBar() {
    const n = selected.size;
    document.getElementById('selectCount').textContent = n ? `${n} lien${n > 1 ? 's' : ''} choisi${n > 1 ? 's' : ''}` : 'Touche les liens à partager';
    const go = document.getElementById('selectGo');
    go.disabled = !n;
    go.textContent = n ? `Partager (${n})` : 'Partager';
  }
  function shareSelection() {
    if (!selected.size) return;
    stopSelecting(true);
    showShare('sel');
  }
  function closeShare() { document.getElementById('shareModal').classList.remove('active'); }
  function setShareTab(tab) {
    shareTab = tab;
    document.querySelectorAll('.share-tabs .modal-tab').forEach(t => { const on = t.dataset.share === tab; t.classList.toggle('active', on); t.setAttribute('aria-selected', on ? 'true' : 'false'); });
    renderShare();
  }
  let qrTracked = false; // un QR affiché compte une fois par ouverture de Partager
  const shareScopeKind = (v) => (!v ? 'journal' : v === 'sel' || isPageKey(v) ? 'selection' : 'collection');
  async function renderShare() {
    const run = ++shareRun;
    const pane = document.getElementById('sharePane');
    // Garder la hauteur pendant le calcul, et n'afficher le chargement que s'il dure : la fenêtre ne saute pas.
    if (pane.offsetHeight) pane.style.minHeight = pane.offsetHeight + 'px';
    const wait = setTimeout(() => { if (run === shareRun) pane.replaceChildren(mk('div', 'spinner')); }, 150);
    const scopeValue = document.getElementById('shareScope').value || null;
    const board = await boardFor(scopeValue);
    const expires = shareExpires();
    if (expires) board.expires = expires;
    const lock = shareTab === 'qr' || shareTab === 'lien' ? await shareLock() : null;
    clearTimeout(wait);
    if (run !== shareRun) return; // un autre choix a été fait entre-temps
    pane.replaceChildren();
    requestAnimationFrame(() => { if (run === shareRun) pane.style.minHeight = ''; });
    const total = board.links.length;
    const note = (t) => { const p = mk('p', 'hint share-note'); p.textContent = t; pane.append(p); };
    if (!total) { note('Aucun lien à partager ici.'); return; }
    const button = (label, cls, fn) => { const b = mk('button', 'btn ' + cls); b.type = 'button'; b.textContent = label; b.addEventListener('click', fn); pane.append(b); return b; };

    if (shareTab === 'qr') {
      const { url, count } = await fitBoard(board, QR_MAX, lock);
      if (run !== shareRun) return;
      if (!count) { note('Le premier lien est trop long pour un QR code. Utilise l’onglet Lien.'); return; }
      const qr = qrcode(0, 'L');
      qr.addData(url, 'Byte');
      qr.make();
      const box = mk('div', 'share-qr');
      box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
      box.querySelector('svg').setAttribute('aria-label', `QR code : ${board.name}, ${count} liens`);
      pane.append(box);
      if (!qrTracked) { qrTracked = true; Telemetry.track('share_made', { tab: 'qr', how: 'affiche', scope: shareScopeKind(scopeValue), mdp: !!lock, limite: !!expires, liens: count }); }
      note(count < total
        ? `${count} lien${count > 1 ? 's' : ''} sur ${total} tiennent dans le QR code. Pour tout partager, choisis une collection plus petite ou l’onglet Lien.`
        : `${count} lien${count > 1 ? 's' : ''}. À scanner avec l’appareil photo : la personne ouvre le board et peut l’ajouter à son leketia.${lock ? ' Mot de passe demandé à l’ouverture.' : ''}`);
      if (expires && !lock) note('Date limite inscrite dans le lien : la page la respecte, mais une personne très technique pourrait la retirer. Ajoute un mot de passe, ou utilise Publier, pour une limite garantie.');
    } else if (shareTab === 'lien') {
      const { url, count } = await fitBoard(board, LINK_MAX, lock);
      if (run !== shareRun) return;
      note(count < total ? `${count} liens sur ${total} tiennent dans un lien. Pour le reste, partage collection par collection.`
        : lock ? `${count} lien${count > 1 ? 's' : ''}, chiffré${count > 1 ? 's' : ''} : il faudra le mot de passe pour l'ouvrir. Envoie le mot de passe par un autre moyen que le lien.`
        : `${count} lien${count > 1 ? 's' : ''} dans le lien. Lisible par une personne et par un agent IA, sans compte.`);
      const shared = (how) => Telemetry.track('share_made', { tab: 'lien', how, scope: shareScopeKind(scopeValue), mdp: !!lock, limite: !!expires, liens: count });
      if (navigator.share) button('Envoyer le lien', 'btn-primary', async () => { try { await navigator.share({ title: board.name, url }); shared('envoi'); } catch { /* annulé */ } });
      button('Copier le lien', navigator.share ? 'btn-ghost' : 'btn-primary', async () => { try { await navigator.clipboard.writeText(url); toast('Lien copié'); shared('copie'); } catch { toast('Copie impossible', 'error'); } });
    } else if (shareTab === 'publier') {
      await renderPublish(pane, board, scopeValue || '', run);
    } else {
      const md = ShareCodec.toMarkdown(board);
      const pre = mk('pre', 'share-md'); pre.textContent = md.length > 1200 ? md.slice(0, 1200) + '…' : md; pane.append(pre);
      note(`${total} lien${total > 1 ? 's' : ''} en texte structuré (Markdown). Colle-le dans Claude ou un autre assistant.`);
      button('Copier pour une IA', 'btn-primary', async () => { try { await navigator.clipboard.writeText(md); toast('Texte copié'); Telemetry.track('share_made', { tab: 'ia', how: 'copie', scope: shareScopeKind(scopeValue), liens: total }); } catch { toast('Copie impossible', 'error'); } });
    }
  }

  // ===== Publier : des pages publiques servies depuis le Google Drive de leur auteur =====
  // Chaque page est un fichier du Drive de la personne ; /p/<id> l'affiche. Une même collection (ou sélection)
  // peut avoir plusieurs pages, chacune avec son mot de passe et sa date limite, modifiables sans changer de lien.
  // La liste des pages reste sur l'appareil qui les a publiées. Rien n'est stocké sur le serveur de leketia.
  const pageUrl = (id) => `${location.origin}/p/${id}`;
  const frDate = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  const isExpired = (pub) => !!pub.expires && Date.parse(pub.expires) <= Date.now();

  // Les pages publiées pour ce qui est choisi dans « Quoi partager ? ».
  function pagesOf(all, scope) {
    if (isPageKey(scope)) return all[scope] ? [[scope, all[scope]]] : [];
    if (scope === 'sel') return [];
    return Object.entries(all).filter(([k, p]) => !p.ids && pubSource(k, p).src === scope);
  }
  function pubLabel(key, pub) {
    const s = pubSource(key, pub);
    if (s.ids) return `Sélection « ${pub.name || 'Ma sélection'} »`;
    if (!s.src) return 'Tout le journal';
    const sp = spaces.find(x => x.id === s.src);
    return sp ? `Collection « ${sp.name} »` : 'Collection supprimée';
  }
  function pubSettings(pub) {
    return [pub.keyRaw ? 'Mot de passe' : 'Sans mot de passe',
      isExpired(pub) ? 'Expirée' : pub.expires ? `Jusqu'au ${frDate(pub.expires)}` : 'Sans limite',
      `Publiée le ${frDate(pub.publishedAt)}`].join(' · ');
  }

  // Une page publiée : son lien, ses réglages, et ce qu'on peut en faire.
  function pageCard(key, pub, { withSource = false, onChange } = {}) {
    const box = mk('div', 'pub-card');
    if (withSource) { const t = mk('p', 'pub-source'); t.textContent = pubLabel(key, pub); box.append(t); }
    const url = pageUrl(pub.fileId);
    const link = mk('a', 'share-url'); link.href = url; link.target = '_blank'; link.rel = 'noopener'; link.textContent = url.replace(/^https?:\/\//, '');
    const meta = mk('p', 'hint pub-meta'); meta.textContent = pubSettings(pub);
    const row = mk('div', 'pub-actions');
    const act = (label, cls, fn) => { const b = mk('button', 'btn btn-sm ' + cls); b.type = 'button'; b.textContent = label; b.addEventListener('click', async () => { b.disabled = true; try { await fn(); } finally { b.disabled = false; } }); row.append(b); return b; };
    act('Copier le lien', 'btn-ghost', async () => { try { await navigator.clipboard.writeText(url); toast('Lien copié'); } catch { toast('Copie impossible', 'error'); } });
    if (navigator.share) act('Envoyer', 'btn-ghost', async () => { try { await navigator.share({ title: pub.name || 'leketia', url }); } catch { /* annulé */ } });
    act('Modifier', 'btn-ghost', async () => { box.querySelector('.pub-edit') ? box.querySelector('.pub-edit').remove() : box.append(pageEditor(key, pub, onChange)); });
    act('Retirer', 'btn-ghost share-danger', async () => {
      if (!(await showConfirm('Retirer cette page ? Son lien ne marchera plus et le fichier sera supprimé de ton Google Drive.', 'Retirer', { danger: true }))) return;
      try { await unpublishPage(key); toast('Page retirée'); onChange && onChange(); } catch (e) { toast(e.message, 'error'); }
    });
    box.append(link, meta, row);
    return box;
  }

  // Modifier le mot de passe ou la date limite d'une page : même lien, contenu réécrit dans le Drive.
  function pageEditor(key, pub, onChange) {
    const ed = mk('div', 'pub-edit');
    const uid = key.replace(/[^a-z0-9]/gi, '');
    ed.innerHTML = `
      <div class="form-group"><label for="pw-mode-${uid}">Mot de passe</label>
        <select id="pw-mode-${uid}" class="pw-mode">
          ${pub.keyRaw ? '<option value="keep">Garder le mot de passe actuel</option>' : '<option value="none">Sans mot de passe</option>'}
          <option value="new">${pub.keyRaw ? 'Changer le mot de passe' : 'Ajouter un mot de passe'}</option>
          ${pub.keyRaw ? '<option value="none">Retirer le mot de passe</option>' : ''}
        </select>
        <input type="password" class="pw-new" autocomplete="new-password" placeholder="Nouveau mot de passe" hidden aria-label="Nouveau mot de passe">
      </div>
      <div class="form-group"><label for="exp-${uid}">Visible jusqu'au</label>
        <select id="exp-${uid}" class="exp-mode">
          ${pub.expires && !isExpired(pub) ? `<option value="keep">Garder : ${frDate(pub.expires)}</option>` : ''}
          <option value="">Sans limite</option><option value="1">24 heures</option><option value="7">7 jours</option><option value="30">30 jours</option><option value="custom">Choisir une date…</option>
        </select>
        <input type="date" class="exp-date" hidden aria-label="Date limite">
      </div>`;
    const mode = ed.querySelector('.pw-mode'), pwIn = ed.querySelector('.pw-new'), expSel = ed.querySelector('.exp-mode'), expDate = ed.querySelector('.exp-date');
    mode.addEventListener('change', () => { pwIn.hidden = mode.value !== 'new'; if (!pwIn.hidden) pwIn.focus(); });
    expSel.addEventListener('change', () => { expDate.hidden = expSel.value !== 'custom'; });
    const save = mk('button', 'btn btn-sm btn-primary'); save.type = 'button'; save.textContent = 'Enregistrer';
    save.addEventListener('click', async () => {
      // Valeurs lues au moment du toucher, jamais à l'affichage.
      if (mode.value === 'new' && !pwIn.value) { toast('Écris le nouveau mot de passe', 'error'); pwIn.focus(); return; }
      let expires;
      if (expSel.value === 'keep') expires = pub.expires;
      else if (expSel.value === 'custom') { if (!expDate.value) { toast('Choisis une date', 'error'); return; } expires = new Date(expDate.value + 'T23:59:59').toISOString(); }
      else expires = expSel.value ? new Date(Date.now() + Number(expSel.value) * 86400000).toISOString() : '';
      save.disabled = true;
      try {
        await editPage(key, { password: mode.value === 'new' ? pwIn.value : mode.value === 'none' ? '' : null, expires });
        toast('Page modifiée : même lien, nouveaux réglages');
        onChange && onChange();
      } catch (e) { toast(e.message, 'error'); save.disabled = false; }
    });
    ed.append(save);
    return ed;
  }

  async function renderPublish(pane, board, scope, run) {
    const note = (t, cls = 'hint share-note') => { const p = mk('p', cls); p.textContent = t; pane.append(p); return p; };
    if (!(await Drive.available())) { note('La publication passe par Google Drive, qui n’est pas configuré sur cette instance.'); return; }
    const all = await Store.publications();
    if (run !== shareRun) return;
    const refresh = () => renderShare();

    // Nouvelle page pour ce choix (une sélection déjà publiée se modifie dans sa carte, plus bas).
    if (!isPageKey(scope)) {
      const pw = sharePassword(), exp = shareExpires();
      const prot = [pw && 'protégée par mot de passe', exp && `visible jusqu'au ${frDate(exp)}`].filter(Boolean).join(', ');
      note(`Nouvelle page pour « ${board.name} »${prot ? ` (${prot})` : ''}. Le fichier est rangé dans ton Google Drive : toute personne qui a le lien peut l'ouvrir, et elle se met à jour quand tu modifies ${scope === 'sel' ? 'ces liens' : 'la collection'}. Mot de passe et date limite : dans « Protection » ci-dessus.`);
      const b = mk('button', 'btn btn-primary'); b.type = 'button'; b.textContent = 'Publier une nouvelle page';
      b.addEventListener('click', async () => {
        b.disabled = true;
        try {
          // Protection lue au moment du toucher : c'est ce qui est écrit à cet instant qui s'applique.
          const key = await publishPage(scope, { password: sharePassword(), expires: shareExpires(), name: board.name });
          toast('Page publiée');
          if (scope === 'sel') { selected.clear(); await showShare(key); } else renderShare();
        } catch (e) { toast(e.message, 'error'); b.disabled = false; }
      });
      pane.append(b);
    }

    const mine = pagesOf(all, scope).sort((a, b) => b[1].publishedAt - a[1].publishedAt);
    if (mine.length) {
      const h = mk('h3', 'pub-title'); h.textContent = mine.length > 1 ? `${mine.length} pages publiées ici` : 'Page publiée ici'; pane.append(h);
      for (const [k, p] of mine) pane.append(pageCard(k, p, { onChange: refresh }));
    }
    const total = Object.keys(all).length;
    if (total) {
      const more = mk('button', 'btn btn-ghost pub-all'); more.type = 'button';
      more.textContent = `Toutes mes pages publiées (${total})`;
      more.addEventListener('click', showPages);
      pane.append(more);
    }
  }

  // Toutes les pages publiées depuis cet appareil, quelle que soit leur source.
  async function showPages() {
    const list = document.getElementById('pagesList');
    const draw = async () => {
      const all = Object.entries(await Store.publications()).sort((a, b) => b[1].publishedAt - a[1].publishedAt);
      list.replaceChildren();
      if (!all.length) { const p = mk('p', 'hint'); p.textContent = 'Aucune page publiée depuis cet appareil.'; list.append(p); return; }
      for (const [k, p] of all) list.append(pageCard(k, p, { withSource: true, onChange: draw }));
    };
    closeShare();
    await draw();
    document.getElementById('pagesModal').classList.add('active');
  }
  function closePages() { document.getElementById('pagesModal').classList.remove('active'); }

  // Publie une nouvelle page ; renvoie sa clé.
  async function publishPage(scope, { password = '', expires = '', name = '' } = {}) {
    const key = 'pg-' + crypto.randomUUID().slice(0, 8);
    const pub = scope === 'sel' ? { ids: [...selected], name: name || 'Ma sélection' } : { src: scope || '', name };
    const board = await pubBoard(key, pub, { thumbs: true });
    if (expires) { board.expires = expires; pub.expires = expires; }
    let page = ShareCodec.toPage(board);
    if (password) {
      const k = await ShareCodec.newKey(password);
      page = await ShareCodec.toLockedPage(board, k.key, k.salt);
      pub.keyRaw = k.raw; pub.salt = k.saltB64; // la clé (pas le mot de passe) reste sur l'appareil pour les mises à jour
    }
    const fileId = await Drive.publish(page, board.name);
    const all = await Store.publications();
    all[key] = { ...pub, fileId, hash: await ShareCodec.pageHash(board), publishedAt: Date.now(), updatedAt: Date.now() };
    await Store.savePublications(all);
    Telemetry.track('page_published', { scope: scope === 'sel' ? 'selection' : scope ? 'collection' : 'journal', mdp: !!password, limite: !!expires, liens: board.links.length });
    return key;
  }

  // Nouveaux réglages d'une page existante : password null = garder, '' = retirer ; même fichier, même lien.
  async function editPage(key, { password = null, expires }) {
    const all = await Store.publications();
    const pub = all[key];
    if (!pub) throw new Error('Page introuvable');
    const next = { ...pub };
    if (expires) next.expires = expires; else delete next.expires;
    if (password === '') { delete next.keyRaw; delete next.salt; }
    else if (password) { const k = await ShareCodec.newKey(password); next.keyRaw = k.raw; next.salt = k.saltB64; }
    const board = await pubBoard(key, next, { thumbs: true });
    try { await Drive.update(next.fileId, await pageFor(next, board)); }
    catch (e) {
      if (e.status === 404) { delete all[key]; await Store.savePublications(all); throw new Error('Le fichier de la page a été supprimé du Drive : la page n’est plus publiée'); }
      throw e;
    }
    all[key] = { ...next, hash: await ShareCodec.pageHash(board), updatedAt: Date.now() };
    await Store.savePublications(all);
    Telemetry.track('page_edited', { mdp: !!next.keyRaw, limite: !!next.expires, mdp_change: password !== null });
  }

  async function pageFor(pub, board) {
    if (pub.expires) board.expires = pub.expires;
    if (!pub.keyRaw) return ShareCodec.toPage(board);
    return ShareCodec.toLockedPage(board, await ShareCodec.importKey(pub.keyRaw), ShareCodec.saltFrom(pub.salt));
  }
  // Pages expirées : le fichier est retiré du Drive dès que l'app peut le faire sans fenêtre.
  async function cleanupExpired() {
    const all = await Store.publications();
    const dead = Object.entries(all).filter(([, p]) => isExpired(p));
    if (!dead.length || !(await Drive.canPublishSilently())) return;
    for (const [k, p] of dead) { try { await Drive.unpublish(p.fileId); delete all[k]; } catch { /* au prochain passage */ } }
    await Store.savePublications(all);
  }

  // Réécrit le fichier si le contenu a changé. Sans geste de la personne, seulement si Google a déjà donné l'accès.
  async function updatePage(key, interactive) {
    const all = await Store.publications();
    const pub = all[key];
    if (!pub || isExpired(pub)) return;
    const s = pubSource(key, pub);
    if (!s.ids && s.src && !spaces.some(x => x.id === s.src)) return; // collection supprimée : la page reste, à retirer à la main
    const board = await pubBoard(key, pub, { thumbs: true });
    const hash = await ShareCodec.pageHash(board);
    if (hash === pub.hash) return;
    if (!interactive && !(await Drive.canPublishSilently())) return; // mise à jour au prochain passage
    try { await Drive.update(pub.fileId, await pageFor(pub, board)); }
    catch (e) {
      if (e.status === 404) { delete all[key]; await Store.savePublications(all); throw new Error('Le fichier de la page a été supprimé du Drive : la page n’est plus publiée'); }
      throw e;
    }
    all[key] = { ...pub, hash, updatedAt: Date.now() };
    await Store.savePublications(all);
  }

  async function unpublishPage(key) {
    const all = await Store.publications();
    if (all[key]) {
      try { await Drive.unpublish(all[key].fileId); }
      catch (e) { if (e.status !== 404) throw e; } // déjà supprimé du Drive : on oublie la page
    }
    delete all[key];
    await Store.savePublications(all);
    Telemetry.track('page_removed');
  }

  let publishTimer = null;
  // Après une modification ici, ou après des changements reçus d'un autre appareil (images, liens) :
  // les pages publiées depuis cet appareil se mettent à jour.
  const schedulePublishUpdate = () => {
    clearTimeout(publishTimer);
    publishTimer = setTimeout(async () => {
      const all = await Store.publications();
      for (const key of Object.keys(all)) { try { await updatePage(key, false); } catch { /* réessayé à la prochaine modification */ } }
    }, 3000);
  };
  window.addEventListener('leketia:changed', schedulePublishUpdate);
  window.addEventListener('leketia:synced', schedulePublishUpdate);

  // Board reçu par un QR ou un lien (/?import=…) : on montre ce qu'il contient, la personne décide.
  // Sur iPhone, un lien s'ouvre toujours dans Safari, dont la mémoire est séparée de l'app installée :
  // on propose alors de copier le lien et de le coller dans l'app, plutôt que de l'ajouter au journal de Safari.
  const PAGE_ID = /^[A-Za-z0-9_-]{20,100}$/;
  const iphoneSafari = () => /^ios/.test(InstallParcours.parcours(navigator.userAgent, navigator.maxTouchPoints || 0)) && !Install.ouverteInstallee();

  // Adresse d'un board leketia (/b?d=… ou /p/<id>) → de quoi l'importer, sinon null.
  function leketiaBoardRef(raw) {
    try {
      const u = new URL(raw, location.origin);
      if (u.origin !== location.origin) return null;
      if (u.pathname === '/b' && u.searchParams.get('d')) return { d: u.searchParams.get('d'), url: u.href };
      const m = u.pathname.match(/^\/p\/([A-Za-z0-9_-]{20,100})$/);
      if (m) return { pageId: m[1], url: u.href };
      if (u.pathname === '/' && u.searchParams.get('import')) return { d: u.searchParams.get('import'), url: `${u.origin}/b?d=${u.searchParams.get('import')}` };
      if (u.pathname === '/' && PAGE_ID.test(u.searchParams.get('import_page') || '')) return { pageId: u.searchParams.get('import_page'), url: `${u.origin}/p/${u.searchParams.get('import_page')}` };
    } catch { /* pas une adresse */ }
    return null;
  }

  async function importBoard(ref, { fromSafari = false } = {}) {
    let board;
    if (ref.pageId) {
      if (!PAGE_ID.test(ref.pageId)) throw new Error('Lien de page invalide');
      const res = await fetch(`/p/${ref.pageId}?format=json`);
      if (!res.ok) throw new Error('Cette page n’est plus publiée');
      board = await res.json();
    } else board = await ShareCodec.decode(ref.d);
    const what = `« ${board.name} » (${board.links.length} lien${board.links.length > 1 ? 's' : ''})`;

    if (fromSafari && iphoneSafari() && await Drive.available()) {
      const send = await showConfirm(`Tu es dans Safari, dont le journal est séparé de l'app installée. Envoyer ${what} à ton app ? La page passe par ton Google Drive et t'attendra à la prochaine ouverture de leketia.`, 'Envoyer à mon app');
      if (send) {
        try { await Drive.sendToInbox({ ...(ref.pageId ? { pageId: ref.pageId } : { d: ref.d }), name: board.name }); toast('Envoyé : ouvre leketia depuis ton écran d’accueil'); }
        catch (e) { toast(e.message, 'error'); }
        return;
      }
      if (!(await showConfirm(`Ajouter ${what} au journal de Safari (pas celui de l'app installée) ?`, 'Ajouter ici'))) return;
    } else if (fromSafari && iphoneSafari()) {
      const copy = await showConfirm(`Tu es dans Safari. Si leketia est installée sur ton écran d'accueil, son journal est séparé : copie le lien, ouvre leketia et touche « Coller le lien » pour y ajouter ${what}.`, 'Copier le lien');
      if (copy) {
        try { await navigator.clipboard.writeText(ref.url); toast('Lien copié : ouvre leketia depuis ton écran d’accueil'); }
        catch { toast('Copie impossible : copie l’adresse de la page', 'error'); }
        return;
      }
      if (!(await showConfirm(`Ajouter ${what} au journal de Safari (pas celui de l'app installée) ?`, 'Ajouter ici'))) return;
    } else if (!(await showConfirm(`Ajouter ${what} à ton journal ?`, 'Ajouter'))) return;

    const { added, skipped, collection } = await Store.importShared(board);
    Telemetry.track('board_imported', { source: ref.pageId ? 'page' : 'lien', liens: added });
    toast(`${added} ajouté${added > 1 ? 's' : ''} dans « ${collection} »${skipped ? `, ${skipped} déjà présent${skipped > 1 ? 's' : ''}` : ''}`);
    await loadSpaces();
    const space = spaces.find(s => s.name.toLowerCase() === collection.toLowerCase());
    if (space) setSpace(space.id); // on retrouve la page dans l'app, ouverte sur sa collection
  }

  // Boîte d'arrivée du Drive : pages envoyées depuis Safari (ou un autre appareil du même compte Google).
  let inboxRun = null;
  function checkInbox() {
    if (inboxRun) return inboxRun;
    inboxRun = (async () => {
      const got = await Drive.takeInbox().catch(() => []);
      for (const it of got) {
        const ref = it.pageId && PAGE_ID.test(it.pageId) ? { pageId: it.pageId } : (it.d ? { d: it.d } : null);
        if (ref) { try { await importBoard(ref); } catch (e) { toast(e.message, 'error'); } }
      }
      return got.length;
    })().finally(() => { inboxRun = null; });
    return inboxRun;
  }
  window.addEventListener('leketia:drive-token', () => { setTimeout(checkInbox, 0); });
  const inboxButton = () => document.getElementById('inboxBtn');
  // Un toucher : l'accès Google (geste requis), puis la boîte est relevée automatiquement.
  async function receiveInbox(btn) {
    if (btn) btn.disabled = true;
    try {
      await Drive.connect();
      await new Promise(r => setTimeout(r, 50));
      const n = await checkInbox();
      if (!n) toast('Rien en attente dans ton Google Drive');
    } catch (e) { toast(e.message, 'error'); }
    finally { if (btn) btn.disabled = false; }
  }

  async function handleImportLink() {
    const params = new URLSearchParams(location.search);
    const hashImport = location.hash.startsWith('#import=') ? location.hash.slice(8) : '';
    const d = params.get('import') || hashImport;
    const pageId = params.get('import_page');
    if (!d && !pageId) return;
    const ref = pageId ? { pageId, url: `${location.origin}/p/${pageId}` } : { d, url: `${location.origin}/b?d=${d}` };
    history.replaceState({}, '', '/');
    try { await importBoard(ref, { fromSafari: true }); } catch (e) { toast(e.message, 'error'); }
  }

  // ===== Sauvegarde : export, envoi, import =====
  const BACKUP_STALE_DAYS = 7;
  async function refreshBackupHint() {
    const last = await Store.lastBackupAt();
    const total = spaces.reduce((n, s) => n + (s.item_count || 0), 0);
    const days = last ? Math.floor((Date.now() - last) / 86400000) : null;
    const stale = total > 0 && (days === null || days >= BACKUP_STALE_DAYS) && !(await Drive.syncLinked().catch(() => false));
    document.getElementById('backupBtn').classList.toggle('needs-backup', stale);
    const status = document.getElementById('backupStatus');
    status.classList.toggle('is-stale', stale);
    status.textContent = days === null ? 'Aucune sauvegarde pour l’instant. Ton journal n’existe que sur cet appareil.'
      : days === 0 ? 'Dernière sauvegarde : aujourd’hui.'
      : `Dernière sauvegarde : il y a ${days} jour${days > 1 ? 's' : ''}.`;
  }
  // Le bouton Drive n'apparaît que si l'instance a son identifiant Google ; il passe alors en premier.
  // ===== Synchronisation entre appareils =====
  async function refreshSyncZone() {
    const supported = await Drive.syncSupported();
    const linked = supported && await Drive.syncLinked();
    document.getElementById('syncZone').hidden = !supported;
    document.getElementById('syncOn').hidden = linked;
    document.getElementById('syncNow').hidden = !linked;
    document.getElementById('syncOff').hidden = !linked;
    document.getElementById('syncHint').hidden = linked;
    const st = Sync.state();
    const line = document.getElementById('syncLine');
    line.textContent = !linked ? 'Synchronisation désactivée sur cet appareil.'
      : st.status === 'syncing' ? 'Synchronisation en cours…'
      : st.status === 'error' ? `Synchronisation en échec : ${st.error}`
      : st.at ? `Synchronisé ${new Date(st.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}. Tes autres appareils récupèrent tes ajouts à l'ouverture, puis toutes les 2 minutes.`
      : 'Synchronisation activée.';
    line.classList.toggle('is-on', linked && st.status !== 'error');
    return linked;
  }
  window.addEventListener('leketia:sync-state', () => { if (document.getElementById('backupModal').classList.contains('active')) refreshSyncZone(); });
  // Plusieurs onglets ou fenêtres de leketia sur le même appareil partagent la même base :
  // quand l'un modifie ou se synchronise, les autres réaffichent tout de suite.
  const tabs = 'BroadcastChannel' in window ? new BroadcastChannel('leketia') : null;
  let fromOtherTab = false;
  if (tabs) {
    tabs.onmessage = async () => { fromOtherTab = true; try { await loadSpaces(); } finally { fromOtherTab = false; } };
    window.addEventListener('leketia:changed', () => { if (!fromOtherTab) tabs.postMessage('changed'); });
    window.addEventListener('leketia:synced', () => tabs.postMessage('synced'));
  }

  // Bouton de synchro dans la barre du haut : visible quand la synchro est active, tourne pendant un passage.
  async function refreshSyncButton() {
    const b = document.getElementById('syncBtn');
    if (!b) return;
    const linked = await Drive.syncLinked().catch(() => false);
    b.hidden = !linked;
    const st = Sync.state();
    b.classList.toggle('is-syncing', st.status === 'syncing');
    b.classList.toggle('is-error', st.status === 'error');
    b.title = st.status === 'error' ? `Synchronisation en échec : ${st.error}` : st.at ? `Synchronisé à ${new Date(st.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} — toucher pour synchroniser` : 'Synchroniser';
  }
  window.addEventListener('leketia:sync-state', refreshSyncButton);
  // Journal vide : l'écran passe d'« vide » à « en cours d'arrivée » (et retour) avec l'état de la synchro.
  let lastSyncStatus = '';
  window.addEventListener('leketia:sync-state', (e) => {
    const st = e.detail && e.detail.status;
    if (st !== lastSyncStatus && journalEmpty && !items.length) renderGrid();
    lastSyncStatus = st;
  });
  async function syncTap() { await Sync.run(); refreshSyncButton(); }

  // Tirer vers le bas en haut de la liste : synchroniser (geste habituel sur téléphone).
  (() => {
    let y0 = null, pulled = 0;
    const hint = () => document.getElementById('pullHint');
    window.addEventListener('touchstart', (e) => { y0 = window.scrollY <= 0 && !document.querySelector('.modal-overlay.active') ? e.touches[0].clientY : null; pulled = 0; }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (y0 == null) return;
      pulled = Math.max(0, e.touches[0].clientY - y0);
      const h = hint();
      if (h) { h.hidden = pulled < 20; h.style.transform = `translateY(${Math.min(pulled, 90) * 0.5}px)`; h.textContent = pulled > 80 ? 'Relâche pour synchroniser' : 'Tire pour synchroniser'; }
    }, { passive: true });
    window.addEventListener('touchend', async () => {
      const h = hint();
      if (h) { h.hidden = true; h.style.transform = ''; }
      if (y0 != null && pulled > 80) {
        if (await Drive.syncLinked().catch(() => false)) { toast('Synchronisation…'); await Sync.run(); } else await loadSpaces();
      }
      y0 = null; pulled = 0;
    });
  })();

  // Un autre appareil a ajouté ou modifié : on réaffiche, sans changer de collection.
  window.addEventListener('leketia:synced', async (e) => {
    await loadSpaces();
    if (activeSpace !== 'all' && activeSpace !== 'trash' && !spaces.some(sp => sp.id === activeSpace)) setSpace('all');
    const n = e.detail && e.detail.applied;
    if (n) toast(`Journal mis à jour depuis tes autres appareils`);
  });
  async function syncConnect(btn) {
    if (btn) btn.disabled = true;
    try {
      await Drive.connect();
      if (!(await Drive.syncLinked())) throw new Error('Google n’a pas donné d’accès durable : retire leketia de ton compte Google (Sécurité › Applications tierces), puis réessaie');
      await refreshSyncZone();
      const r = await Sync.run();
      if (r && r.error) throw new Error(Sync.state().error);
      toast('Synchronisation activée sur cet appareil');
      Telemetry.track('sync_on');
      refreshSyncButton();
    } catch (e) { toast(e.message, 'error'); }
    finally { if (btn) btn.disabled = false; refreshSyncZone(); }
  }
  async function syncNow(btn) {
    if (btn) btn.disabled = true;
    await Sync.run();
    if (btn) btn.disabled = false;
    refreshSyncZone();
  }
  async function syncDisconnect() {
    if (!(await showConfirm('Arrêter la synchronisation sur cet appareil ? Ton journal reste ici et dans ton Google Drive ; les autres appareils continuent.', 'Arrêter'))) return;
    await Drive.disconnect();
    refreshSyncButton();
    toast('Synchronisation arrêtée sur cet appareil');
    Telemetry.track('sync_off');
    refreshSyncZone();
  }

  async function refreshDriveButton() {
    const on = await Drive.available();
    document.getElementById('driveZone').hidden = !on;
    document.getElementById('driveList').hidden = true;
    // Sans Drive, la copie en fichier est la seule sauvegarde : on l'ouvre d'office et son bouton passe en premier.
    document.getElementById('backupFile').open = !on;
    document.getElementById('shareBackupBtn').className = 'btn backup-action ' + (on ? 'btn-ghost' : 'btn-primary');
  }
  // Mesure d'audience : la personne peut la couper ; « Global Privacy Control » du navigateur la coupe d'office.
  function refreshMesure() {
    const box = document.getElementById('mesureToggle');
    if (!box) return;
    box.checked = Telemetry.enabled();
    box.disabled = Telemetry.gpc();
    document.getElementById('mesureHint').textContent = Telemetry.gpc() ? '(coupée par ton navigateur)' : '(aucun lien ni titre n’est envoyé)';
  }
  function mesureChanged(box) { Telemetry.setEnabled(box.checked); toast(box.checked ? 'Mesure d’audience activée' : 'Mesure d’audience coupée : plus rien n’est envoyé'); }
  function showBackup() {
    refreshMesure();
    refreshDriveButton();
    refreshSyncZone();
    const sel = document.getElementById('backupScope');
    sel.replaceChildren(new Option('Tout le journal', ''), ...orderedSpaces().map(s => new Option(`Collection « ${s.name} »`, s.id)));
    // Le choix n'a de sens qu'avec plusieurs collections.
    document.getElementById('backupScopeGroup').hidden = spaces.length < 2;
    refreshBackupHint();
    document.getElementById('backupModal').classList.add('active');
  }
  function closeBackup() { document.getElementById('backupModal').classList.remove('active'); }
  function saveFileLocally(file) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file); a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }
  let exporting = false;
  async function runExport(send) {
    if (exporting) return;
    exporting = true;
    document.querySelectorAll('#backupModal .backup-action').forEach(b => { b.disabled = true; });
    try {
      const { file, count, skippedVideos } = await Store.exportFile(document.getElementById('backupScope').value || null);
      if (count === 0) { toast('Rien à sauvegarder dans cette sélection', 'error'); return; }
      const note = skippedVideos ? ` (${skippedVideos} vidéo${skippedVideos > 1 ? 's' : ''} non incluse${skippedVideos > 1 ? 's' : ''})` : '';
      if (send && navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'Sauvegarde leketia' }); toast(`${count} élément${count > 1 ? 's' : ''} envoyé${count > 1 ? 's' : ''}${note}`); }
        catch (e) { if (e.name !== 'AbortError') { saveFileLocally(file); toast('Envoi impossible : fichier téléchargé à la place' + note); } }
      } else {
        saveFileLocally(file);
        toast((send ? 'Envoi de fichier indisponible ici : ' : '') + `${count} élément${count > 1 ? 's' : ''} dans le fichier téléchargé${note}`);
      }
      refreshBackupHint();
    } catch (e) { toast(e.message, 'error'); }
    finally {
      exporting = false;
      document.querySelectorAll('#backupModal .backup-action').forEach(b => { b.disabled = false; });
    }
  }
  async function driveBackup() {
    if (exporting) return;
    exporting = true;
    document.querySelectorAll('#backupModal .backup-action').forEach(b => { b.disabled = true; });
    try {
      // Toujours le journal entier : la sauvegarde la plus récente doit suffire à tout restaurer.
      const { file, count, skippedVideos } = await Store.exportFile(null);
      if (count === 0) { toast('Ton journal est vide : rien à sauvegarder', 'error'); return; }
      await Drive.save(file);
      const note = skippedVideos ? ' (vidéos non incluses)' : '';
      toast(`${count} élément${count > 1 ? 's' : ''} sauvegardé${count > 1 ? 's' : ''} dans Google Drive${note}`);
      Telemetry.track('backup', { to: 'drive', elements: count });
      refreshBackupHint();
    } catch (e) { toast(e.message, 'error'); }
    finally {
      exporting = false;
      document.querySelectorAll('#backupModal .backup-action').forEach(b => { b.disabled = false; });
    }
  }
  // Restauration : les sauvegardes de ce compte Google, quel que soit l'appareil qui les a faites.
  // Importer fusionne : ce qui manque est ajouté, ce qui existe déjà est laissé tel quel.
  async function driveRestoreList() {
    if (exporting) return;
    const list = document.getElementById('driveList');
    exporting = true;
    try {
      const files = await Drive.list();
      list.replaceChildren();
      if (!files.length) {
        list.append(mk('li', 'drive-empty')); list.lastChild.textContent = 'Aucune sauvegarde dans le Google Drive de ce compte.';
      }
      files.forEach((f, i) => {
        const li = mk('li');
        const b = mk('button', 'drive-item');
        b.type = 'button';
        const when = new Date(f.createdTime).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
        const size = f.size ? ` · ${Math.max(1, Math.round(Number(f.size) / 1024))} Ko` : '';
        b.textContent = `${i === 0 ? 'La plus récente : ' : ''}${when}${size}`;
        b.addEventListener('click', () => driveRestore(f));
        li.append(b);
        list.append(li);
      });
      list.hidden = false;
    } catch (e) { toast(e.message, 'error'); }
    finally { exporting = false; }
  }
  async function driveRestore(f) {
    if (exporting) return;
    exporting = true;
    try {
      const file = await Drive.download(f.id, f.name);
      const { added, skipped } = await Store.importFile(file);
      toast(`Restauré : ${added} ajouté${added > 1 ? 's' : ''}, ${skipped} déjà présent${skipped > 1 ? 's' : ''}`);
      Telemetry.track('restore', { from: 'drive', elements: added });
      closeBackup();
      await loadSpaces();
    } catch (e) { toast(e.message, 'error'); }
    finally { exporting = false; }
  }
  // Un toucher : Google demande l'accès (sa fenêtre ne peut s'ouvrir qu'après un geste), puis la plus récente
  // sauvegarde de ce compte est importée, quel que soit l'appareil qui l'a faite.
  async function restoreLatest(btn) {
    if (exporting) return;
    exporting = true;
    if (btn) { btn.disabled = true; btn.textContent = 'Restauration…'; }
    try {
      const [latest] = await Drive.list();
      if (!latest) { toast('Aucune sauvegarde dans le Google Drive de ce compte', 'error'); return; }
      const { added } = await Store.importFile(await Drive.download(latest.id, latest.name));
      const when = new Date(latest.createdTime).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
      toast(`Journal restauré : ${added} élément${added > 1 ? 's' : ''}, sauvegarde du ${when}`);
      Telemetry.track('restore', { from: 'drive_auto', elements: added });
      await loadSpaces();
    } catch (e) { toast(e.message, 'error'); }
    finally { exporting = false; if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = 'Restaurer depuis Google Drive'; } }
  }
  const downloadBackup = () => runExport(false);
  const shareBackup = () => runExport(true);
  async function importBackup(input) {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    try {
      const { added, skipped } = await Store.importFile(file);
      toast(`${added} ajouté${added > 1 ? 's' : ''}, ${skipped} ignoré${skipped > 1 ? 's' : ''} (déjà présents ou invalides)`);
      Telemetry.track('restore', { from: 'fichier', elements: added });
      closeBackup();
      await loadSpaces();
    } catch (e) { toast(e.message, 'error'); }
  }

  // ===== Tags & filtre par tag =====
  // Type de plateforme d'un item (source des tags "plateforme")
  function platformOf(item) {
    if (item.type !== 'link' || !item.url) return 'divers';
    let h; try { h = new URL(item.url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return 'divers'; }
    if (h.endsWith('tiktok.com')) return 'tiktok';
    if (h.endsWith('instagram.com')) return 'instagram';
    if (/(^|\.)pinterest\.[a-z.]+$/.test(h) || h === 'pin.it') return 'pinterest';
    if (h === 'x.com' || h.endsWith('twitter.com')) return 'twitter';
    if (h.endsWith('youtube.com') || h === 'youtu.be') return 'youtube';
    return 'divers';
  }

  const PLATFORM_TAGS = new Set(['instagram', 'tiktok', 'pinterest', 'twitter', 'youtube']);
  const PLATFORM_LABELS = { instagram: 'Instagram', tiktok: 'TikTok', pinterest: 'Pinterest', twitter: 'X', youtube: 'YouTube' };

  // Tags d'un item : plateforme (hors "divers") + tous les #hashtags du titre ET de la description.
  function tagsOf(item) {
    const out = [];
    const p = platformOf(item);
    if (p && p !== 'divers') out.push(p);
    const text = (item.title || '') + ' ' + (item.description || '');
    const re = /#([\p{L}\p{N}_-]{1,30})/gu;
    let m;
    while ((m = re.exec(text))) out.push(m[1].toLowerCase());
    return [...new Set(out)];
  }

  // Tags perso (localStorage, par utilisateur) — s'affichent même sans item porteur.
  function customTagsKey() { return 'leketia:customTags:' + (currentUser && currentUser.id != null ? currentUser.id : 'anon'); }
  function getCustomTags() {
    try { const a = JSON.parse(localStorage.getItem(customTagsKey())); return Array.isArray(a) ? a.filter(t => typeof t === 'string') : []; }
    catch { return []; }
  }
  function setCustomTags(arr) { try { localStorage.setItem(customTagsKey(), JSON.stringify(arr)); } catch {} }
  function addCustomTag(tag) { const a = getCustomTags(); if (!a.includes(tag)) { a.push(tag); setCustomTags(a); } }
  function removeCustomTag(tag) {
    setCustomTags(getCustomTags().filter(t => t !== tag));
    if (activeTag === tag) activeTag = '';
    renderGrid();
  }
  // Normalise une saisie utilisateur en tag (# initial optionnel, minuscules, 1er token valide).
  function normalizeTag(raw) {
    const m = (raw || '').trim().replace(/^#+/, '').toLowerCase().match(/[\p{L}\p{N}_-]{1,30}/u);
    return m ? m[0] : '';
  }

  function makeTagChip(tag, label, removable) {
    const active = activeTag === tag;
    const chip = mk('button', 'filter-chip' + (active ? ' active' : ''));
    chip.type = 'button';
    chip.dataset.tag = tag;
    chip.setAttribute('aria-pressed', active ? 'true' : 'false');
    chip.textContent = label;
    chip.addEventListener('click', () => setTagFilter(chip, tag));
    if (removable) {
      const x = mk('span', 'tag-remove');
      x.textContent = '×';
      x.setAttribute('aria-label', 'Retirer le tag ' + label);
      x.addEventListener('click', (e) => { e.stopPropagation(); removeCustomTag(tag); });
      chip.appendChild(x);
    }
    return chip;
  }

  // Reconstruit la barre : Tous + plateformes + #hashtags (triés) + tags perso (× retirable) + bouton "+".
  function renderTagBar() {
    const bar = document.getElementById('tagBar');
    if (!bar) return;
    const sl = bar.scrollLeft;
    const custom = getCustomTags();
    const customSet = new Set(custom);
    const platformSet = new Set(), hashtagSet = new Set();
    items.forEach(it => tagsOf(it).forEach(t => {
      if (customSet.has(t)) return; // affiché comme puce perso (retirable) plus bas
      (PLATFORM_TAGS.has(t) ? platformSet : hashtagSet).add(t);
    }));

    bar.innerHTML = '';
    bar.appendChild(makeTagChip('', 'Tous', false));
    [...platformSet].sort().forEach(t => bar.appendChild(makeTagChip(t, PLATFORM_LABELS[t] || t, false)));
    [...hashtagSet].sort().forEach(t => bar.appendChild(makeTagChip(t, '#' + t, false)));
    [...custom].sort().forEach(t => bar.appendChild(makeTagChip(t, '#' + t, true)));

    const addBtn = mk('button', 'type-more-btn');
    addBtn.type = 'button';
    addBtn.setAttribute('aria-label', 'Nouveau tag');
    addBtn.title = 'Nouveau tag';
    addBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    addBtn.addEventListener('click', () => openTagInput(addBtn));
    bar.appendChild(addBtn);

    bar.scrollLeft = sl;
  }

  function setTagFilter(el, tag) {
    activeTag = tag;
    document.querySelectorAll('#tagBar .filter-chip').forEach(c => { c.classList.remove('active'); c.setAttribute('aria-pressed', 'false'); });
    el.classList.add('active');
    el.setAttribute('aria-pressed', 'true');
    renderGrid(); // filtrage côté client, pas besoin de recharger
  }

  // Bouton "+" → champ inline. Entrée ajoute+persiste ; Échap/blur ferme.
  function openTagInput(addBtn) {
    const input = mk('input', 'tag-input');
    input.type = 'text';
    input.placeholder = 'Nouveau tag';
    input.setAttribute('aria-label', 'Nom du nouveau tag');
    input.maxLength = 30;
    addBtn.replaceWith(input);
    input.focus();
    let done = false;
    const commit = () => { if (done) return; done = true; const t = normalizeTag(input.value); if (t) addCustomTag(t); renderTagBar(); };
    const cancel = () => { if (done) return; done = true; renderTagBar(); };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
    input.addEventListener('blur', commit);
  }

  // ===== Réorganisation des onglets d'espaces (drag, souris + tactile) =====
  // Onglets déplaçables = espaces uniquement ("Tous" et "Corbeille" restent fixes).
  function spaceTabEls() {
    return [...document.querySelectorAll('#spacesBar .space-tab')].filter(t => t.dataset.space !== 'all' && t.dataset.space !== 'trash');
  }
  function computeDropIndex(clientX) {
    const els = spaceTabEls();
    for (let i = 0; i < els.length; i++) {
      const r = els[i].getBoundingClientRect();
      if (clientX < r.left + r.width / 2) return i;
    }
    return els.length;
  }
  function positionIndicator(clientX) {
    if (!dragSession) return;
    const wrap = document.getElementById('spacesBarWrap');
    const els = spaceTabEls();
    const idx = computeDropIndex(clientX);
    const wr = wrap.getBoundingClientRect();
    let screenX;
    if (!els.length) screenX = clientX;
    else if (idx >= els.length) screenX = els[els.length - 1].getBoundingClientRect().right;
    else screenX = els[idx].getBoundingClientRect().left;
    dragSession.indicator.style.left = (screenX - wr.left - 1) + 'px';
    dragSession.dropIndex = idx;
  }
  function onReorderMove(e) {
    if (!dragSession) return;
    lastPointer.x = e.clientX; lastPointer.y = e.clientY;
    positionIndicator(e.clientX);
  }
  function preventTouchScroll(e) { e.preventDefault(); } // bloque le scroll natif pendant le drag tactile
  function startReorder(tabEl, id) {
    if (dragSession) return;
    const wrap = document.getElementById('spacesBarWrap');
    if (!wrap) return;
    const indicator = mk('div', 'space-drop-indicator');
    wrap.appendChild(indicator);
    dragSession = { id, tabEl, indicator, dropIndex: -1 };
    tabEl.classList.add('dragging');
    document.body.classList.add('reordering');
    positionIndicator(lastPointer.x);
    document.addEventListener('pointermove', onReorderMove);
    document.addEventListener('pointerup', endReorder);
    document.addEventListener('pointercancel', endReorder);
    document.addEventListener('touchmove', preventTouchScroll, { passive: false });
  }
  function endReorder() {
    if (!dragSession) return;
    const { id, dropIndex } = dragSession;
    cleanupReorder();
    const displayed = orderedSpaces().map(s => s.id);
    const from = displayed.indexOf(id);
    if (from !== -1 && dropIndex >= 0) {
      let target = dropIndex;
      displayed.splice(from, 1);
      if (from < target) target--;
      displayed.splice(target, 0, id);
      saveSpaceOrder(displayed);
    }
    renderSpacesTabs();
  }
  function cleanupReorder() {
    document.removeEventListener('pointermove', onReorderMove);
    document.removeEventListener('pointerup', endReorder);
    document.removeEventListener('pointercancel', endReorder);
    document.removeEventListener('touchmove', preventTouchScroll);
    if (dragSession) { dragSession.tabEl.classList.remove('dragging'); dragSession.indicator.remove(); dragSession = null; }
    document.body.classList.remove('reordering');
  }

  // Ordre des espaces (par utilisateur, localStorage). IDs inconnus → à la fin.
  function spaceOrderKey() { return 'leketia:spaceOrder:' + (currentUser && currentUser.id != null ? currentUser.id : 'anon'); }
  function getSpaceOrder() {
    try { const a = JSON.parse(localStorage.getItem(spaceOrderKey())); return Array.isArray(a) ? a : []; }
    catch { return []; }
  }
  function saveSpaceOrder(ids) { try { localStorage.setItem(spaceOrderKey(), JSON.stringify(ids)); } catch {} }
  function orderedSpaces() {
    const saved = getSpaceOrder();
    if (!saved.length) return spaces.slice();
    const pos = new Map(saved.map((id, i) => [id, i]));
    return spaces
      .map((s, i) => ({ s, i, p: pos.has(s.id) ? pos.get(s.id) : Infinity }))
      .sort((a, b) => (a.p - b.p) || (a.i - b.i))
      .map(x => x.s);
  }

  // Auto-récupération : dès qu'une URL propre est saisie/collée, on lance le fetch (débounce)
  function onLinkInput() {
    const raw = document.getElementById('linkUrl').value.trim();
    if (_linkDebounce) clearTimeout(_linkDebounce);
    if (!isCleanUrl(raw)) return;
    const norm = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
    if (norm === lastAutoFetched) return;
    _linkDebounce = setTimeout(() => { lastAutoFetched = norm; fetchLinkPreview(); }, 650);
  }

  function isCleanUrl(s) {
    if (!s || /\s/.test(s)) return false;
    const norm = /^https?:\/\//i.test(s) ? s : 'https://' + s;
    try { const u = new URL(norm); return u.hostname.length > 3 && /\.[a-z]{2,}$/i.test(u.hostname); }
    catch { return false; }
  }

  // ===== Toast =====
  function toast(msg, type = 'success') {
    const c = document.getElementById('toasts');
    const t = mk('div', 'toast toast-' + type);
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(8px)'; setTimeout(() => t.remove(), 200); }, 2600);
  }

  // ===== Utilities =====
  // Échappe aussi les guillemets : la valeur est sûre dans du texte ET dans un attribut HTML.
  function esc(str) { if (!str) return ''; return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function mk(tag, cls) { const el = document.createElement(tag); if (cls) el.className = cls; return el; }

  // ===== Init =====
  // Register service worker for PWA
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then(() => {
      }).catch(() => {});
    });
  }

  // Confirm dialog buttons
  document.getElementById('confirmOk').addEventListener('click', () => _closeConfirm(true));
  document.getElementById('confirmCancel').addEventListener('click', () => _closeConfirm(false));
  // Close confirm on overlay click
  document.getElementById('confirmDialog').addEventListener('click', (e) => { if (e.target === e.currentTarget) _closeConfirm(false); });

  // Modal close on overlay click
  document.querySelectorAll('.modal-overlay').forEach(ov => {
    ov.addEventListener('click', (e) => {
      if (e.target === ov) {
        ov.classList.remove('active');
        if (ov.id === 'addItemModal') resetAddItemForm();
        if (ov.id === 'addSpaceModal') document.getElementById('spaceName').value = '';
        if (ov.id === 'embedModal') document.getElementById('embedBox').innerHTML = '';
      }
    });
  });

  // Escape closes modals + confirm (UI/UX Pro Max §1)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const confirm = document.getElementById('confirmDialog');
      if (confirm.classList.contains('active')) { _closeConfirm(false); return; }
      const openModal = document.querySelector('.modal-overlay.active');
      if (openModal) {
        openModal.classList.remove('active');
        if (openModal.id === 'addItemModal') resetAddItemForm();
        if (openModal.id === 'addSpaceModal') document.getElementById('spaceName').value = '';
        if (openModal.id === 'embedModal') document.getElementById('embedBox').innerHTML = '';
      }
    }
  });

  // Close dropdowns on click outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.card-menu-btn') && !e.target.closest('.actions-dropdown')) {
      document.querySelectorAll('.actions-dropdown.active').forEach(d => d.classList.remove('active'));
    }
  });

  document.getElementById('spaceName').addEventListener('keydown', (e) => { if (e.key === 'Enter') createSpace(); });

  start();

  return { loadSpaces, syncTap, restoreLatest, receiveInbox, syncConnect, syncNow, syncDisconnect, scopeChanged, shareOptionsChanged, stopSelecting, shareSelection, pasteLink, showShare, closeShare, setShareTab, renderShare, showBackup, closeBackup, downloadBackup, shareBackup, driveBackup, driveRestoreList, importBackup, setSpace, createSpace, showAddSpace, closeAddSpace, newCatInline, showPages, closePages, mesureChanged,
    loadItems, showAddItem, closeAddItem, switchModalTab, fetchLinkPreview, previewPhoto, submitItem,
    showItemActions, changeStatus, deleteItem, onLinkInput,
    openEmbed, closeEmbed, openMedia, openEdit, closeEdit, submitEdit, restoreItem, deleteForever,
    setTagFilter, renderTagBar, tagsOf };
})();
