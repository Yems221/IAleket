// Cible de partage — /share-target (POST multipart/form-data)
// En temps normal c'est le service worker qui reçoit le partage Android, sur l'appareil.
// Cette fonction ne sert que de secours, quand il n'est pas encore actif (tout premier
// lancement) : elle transmet le lien à l'app par l'adresse et ne garde rien.
// Un fichier partagé dans ce cas précis est perdu : il faut le repartager.
import { firstUrl } from './_shared';

// 303 "See Other" → force un GET après le POST (pattern Post/Redirect/Get).
function redirectToApp(request: Request, query = ''): Response {
  return Response.redirect(new URL('/' + query, request.url).toString(), 303);
}

export async function onRequestGet(context: { request: Request }): Promise<Response> {
  return redirectToApp(context.request);
}

export async function onRequestPost(context: { request: Request }): Promise<Response> {
  const { request } = context;
  try {
    const form = await request.formData();
    const title = String(form.get('title') || '');
    const text = String(form.get('text') || '');
    const url = String(form.get('url') || '').trim() || firstUrl(text) || firstUrl(title);

    if (url) {
      let q = `?share_url=${encodeURIComponent(url)}`;
      if (title && !firstUrl(title)) q += `&share_title=${encodeURIComponent(title)}`;
      return redirectToApp(request, q);
    }
    if (text.trim()) return redirectToApp(request, `?share_text=${encodeURIComponent(text.trim().slice(0, 500))}`);
    return redirectToApp(request);
  } catch {
    // Ne jamais afficher une page cassée à quelqu'un qui vient de partager.
    return redirectToApp(request);
  }
}
