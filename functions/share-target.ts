// Web Share Target — /share-target (POST multipart/form-data)
// Cible de partage natif Android : reçoit soit un fichier (image/vidéo) depuis la
// galerie, soit un lien/texte (TikTok, Instagram, Pinterest…). On stocke un éventuel
// média dans R2 puis on redirige vers l'app (/?share_...) qui ouvre la modale d'ajout
// pré-remplie. La CRÉATION de l'item reste côté client authentifié : ici on se limite
// au stockage R2 + redirection (aucune écriture en base).
// Note : inopérant sur iOS (Web Share Target non supporté) — assumé.
import { Env, MEDIA_TYPES, sha256 } from './_shared';

// 303 "See Other" → force un GET après le POST (pattern Post/Redirect/Get).
function redirectToApp(request: Request, query = ''): Response {
  return Response.redirect(new URL('/' + query, request.url).toString(), 303);
}

// Vérifie la session (cookie session=, hash sha256, lookup non expiré). Empêche le
// spam R2 anonyme : sans session valide, on ne stocke rien.
async function isAuthenticated(request: Request, env: Env): Promise<boolean> {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/session=([^;]+)/);
  const token = match ? match[1] : '';
  if (!token) return false;
  const tokenHash = await sha256(token);
  const session = await env.DB.prepare(
    `SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > datetime('now')`,
  ).bind(tokenHash).first();
  return !!session;
}

// 1re URL http(s) d'un texte (les partages Insta/TikTok mettent souvent l'URL dans "text").
function firstUrl(text: string): string {
  const m = text.match(/https?:\/\/\S+/);
  return m ? m[0] : '';
}

// Sécurité : une plateforme peut faire un GET (aperçu) → on renvoie simplement l'app.
export async function onRequestGet(context: { request: Request }): Promise<Response> {
  return redirectToApp(context.request);
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  try {
    // Partage perdu si non authentifié : l'utilisateur devra se reconnecter puis
    // repartager (acceptable, et évite tout stockage anonyme).
    if (!(await isAuthenticated(request, env))) return redirectToApp(request);

    const form = await request.formData();
    const media = form.get('media');
    const title = (form.get('title') as string) || '';
    const text = (form.get('text') as string) || '';
    const urlField = (form.get('url') as string) || '';

    // 1) Média (image/vidéo) partagé depuis la galerie → stockage R2, puis modale photo.
    if (media instanceof File && media.size > 0) {
      const spec = MEDIA_TYPES[media.type];
      if (spec && media.size <= spec.max * 1024 * 1024) {
        const key = `uploads/${crypto.randomUUID()}.${spec.ext}`;
        // media.stream() : pas de bufferisation, la mémoire du Worker reste stable.
        await env.STORAGE.put(key, media.stream(), { httpMetadata: { contentType: media.type } });
        const mediaUrl = `/images/${key.replace('uploads/', '')}`;
        return redirectToApp(
          request,
          `?share_media=${encodeURIComponent(mediaUrl)}&share_kind=${spec.kind}`,
        );
      }
      // Type/taille non supporté → on retombe sur un éventuel lien, sinon l'accueil.
    }

    // 2) Lien partagé → champ "url", sinon 1re URL trouvée dans "text".
    const url = urlField.trim() || firstUrl(text);
    if (url) {
      let q = `?share_url=${encodeURIComponent(url)}`;
      if (title) q += `&share_title=${encodeURIComponent(title)}`;
      return redirectToApp(request, q);
    }

    // 3) Pas d'URL exploitable mais du texte → pré-remplir le titre côté client.
    if (text.trim()) return redirectToApp(request, `?share_text=${encodeURIComponent(text.trim())}`);

    return redirectToApp(request);
  } catch {
    // Ne jamais afficher une page cassée à quelqu'un qui vient de partager.
    return redirectToApp(request);
  }
}
