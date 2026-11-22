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
  let sharedMediaUrl = null;      // média déjà stocké en R2 via /share-target (partage natif) → pas de ré-upload
  let sharedMediaKind = 'image';  // 'image' | 'video' du média partagé
  let sharedIntentHandled = false; // un seul traitement du partage par chargement de page
  let confirmResolve = null;
  let editingId = null;
  let dragSession = null;      // session de réorganisation d'onglets d'espaces (drag)
  let lastPointer = { x: 0, y: 0 };
  let gridShownOnce = false;   // l'entrée animée des cartes ne joue qu'une fois

  // ===== API =====
  // Mêmes appels que dans HomeBoard, servis par le stockage local (store.js).
  const api = (path, opts) => Store.api(path, opts);

  // ===== Démarrage (pas de compte : les données restent sur l'appareil) =====
  async function start() {
    currentUser = { id: 'local' };
    document.getElementById('app').classList.add('active');
    try {
      await Store.housekeeping();
      await loadSpaces();
      refreshBackupHint();
    } catch (e) {
      document.getElementById('grid').innerHTML = '';
      toast('Le stockage de ce navigateur est indisponible (navigation privée ?)', 'error');
    }
  }

  // ===== Spaces =====
  async function loadSpaces() {
    const data = await api('/api/spaces');
    spaces = data.spaces || [];
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
    grid.innerHTML = '';
    for (let i = 0; i < 8; i++) { grid.appendChild(mk('div', 'skeleton-card')); }
    renderTagBar(); // réserve la barre de tags pendant le chargement (évite un saut de layout)

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
      renderGrid();
    } catch { grid.innerHTML = emptyStateHtml(); }
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
    ).join('') || '<span class="hint">Aucune catégorie — créez-en une d\'abord.</span>';
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
    if (visible.length === 0) { grid.innerHTML = emptyStateHtml(activeTag); return; }

    visible.forEach((item, idx) => {
      const card = mk('div', 'card');
      card.style.setProperty('--card-index', idx);
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
        attachLongPress(card, () => openEdit(item.id));
      }

      grid.appendChild(card);
    });
  }

  function emptyStateHtml(filtered) {
    const mark = '<img src="/brand/leketia-mark.webp" alt="" width="96" height="96">';
    if (activeSpace === 'trash') return `<div class="empty-state"><div class="illustration">${mark}</div><h3>La corbeille est vide</h3><p>Les éléments supprimés restent ici 30 jours.</p></div>`;
    const heading = filtered ? 'Aucun élément pour ce filtre' : 'Ton journal est vide';
    const hint = filtered ? 'Choisis un autre tag ou ajoute un lien.' : 'Partage un lien depuis une autre appli, ou ajoute-le ici.';
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
  function showConfirm(msg) {
    return new Promise((resolve) => {
      confirmResolve = resolve;
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
  }
  function closeAddItem() { document.getElementById('addItemModal').classList.remove('active'); resetAddItemForm(); }

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

  async function fetchLinkPreview() {
    const url = document.getElementById('linkUrl').value.trim();
    if (!url) return;
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
        let imgHtml = p.image_url ? `<img src="${esc(p.image_url)}" alt="preview" onerror="this.style.display='none'">` : '';
      let noteHtml = data.note ? `<div class="desc" style="color:var(--warning,#b45309)">${esc(data.note)}</div>` : '';
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
            image_url: document.getElementById('linkPreview').querySelector('img')?.src || '',
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
      document.getElementById('linkUrl').value = url;
      fetchLinkPreview();
    } catch { toast('Lecture du presse-papiers refusée : colle le lien dans le champ', 'error'); }
  }

  // ===== Sauvegarde : export, envoi, import =====
  const BACKUP_STALE_DAYS = 7;
  async function refreshBackupHint() {
    const last = await Store.lastBackupAt();
    const total = spaces.reduce((n, s) => n + (s.item_count || 0), 0);
    const days = last ? Math.floor((Date.now() - last) / 86400000) : null;
    const stale = total > 0 && (days === null || days >= BACKUP_STALE_DAYS);
    document.getElementById('backupBtn').classList.toggle('needs-backup', stale);
    const status = document.getElementById('backupStatus');
    status.classList.toggle('is-stale', stale);
    status.textContent = days === null ? 'Aucune sauvegarde pour l’instant. Ton journal n’existe que sur cet appareil.'
      : days === 0 ? 'Dernière sauvegarde : aujourd’hui.'
      : `Dernière sauvegarde : il y a ${days} jour${days > 1 ? 's' : ''}.`;
  }
  // Le bouton Drive n'apparaît que si l'instance a son identifiant Google ; il passe alors en premier.
  async function refreshDriveButton() {
    const on = await Drive.available();
    document.getElementById('driveZone').hidden = !on;
    document.getElementById('driveList').hidden = true;
    document.getElementById('shareBackupBtn').className = 'btn backup-action ' + (on ? 'btn-ghost' : 'btn-primary');
  }
  function showBackup() {
    refreshDriveButton();
    const sel = document.getElementById('backupScope');
    sel.replaceChildren(new Option('Tout le journal', ''), ...orderedSpaces().map(s => new Option(`Collection « ${s.name} »`, s.id)));
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
      closeBackup();
      await loadSpaces();
    } catch (e) { toast(e.message, 'error'); }
    finally { exporting = false; }
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

  return { loadSpaces, pasteLink, showBackup, closeBackup, downloadBackup, shareBackup, driveBackup, driveRestoreList, importBackup, setSpace, createSpace, showAddSpace, closeAddSpace,
    loadItems, showAddItem, closeAddItem, switchModalTab, fetchLinkPreview, previewPhoto, submitItem,
    showItemActions, changeStatus, deleteItem, onLinkInput,
    openEmbed, closeEmbed, openMedia, openEdit, closeEdit, submitEdit, restoreItem, deleteForever,
    setTagFilter, renderTagBar, tagsOf };
})();
