// PROTOTYPE — serveur sans stockage. Il sert les fichiers statiques et rattrape le
// partage Android quand le service worker n'est pas encore actif (premier lancement) :
// seul le texte est sauvé, transmis à la page par l'adresse.
function firstUrl(text) {
  const m = String(text || '').match(/https?:\/\/\S+/);
  return m ? m[0] : '';
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/share') return env.ASSETS.fetch(request);

    const target = new URL('/', url);
    if (request.method === 'POST') {
      const form = await request.formData();
      const title = String(form.get('title') || '');
      const text = String(form.get('text') || '');
      const shared = String(form.get('url') || '').trim() || firstUrl(text) || firstUrl(title);
      target.pathname = '/add';
      target.searchParams.set('u', shared);
      target.searchParams.set('t', title || text);
      target.searchParams.set('via', 'secours');
    }
    return Response.redirect(target.toString(), 303);
  },
};
