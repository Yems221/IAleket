// Upload média — POST /api/upload (multipart/form-data, champ "file")
// Accepte images ET vidéos, streame directement vers R2 (aucun base64, aucune
// mise en mémoire du fichier entier). Renvoie l'URL servie + le type média.
import { Env, json, MEDIA_TYPES } from '../_shared';

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { env } = context;

  try {
    const formData = await context.request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return json({ ok: false, error: 'Fichier requis' }, 400);
    }

    const spec = MEDIA_TYPES[file.type];
    if (!spec) {
      return json(
        { ok: false, error: 'Format non supporté (images JPEG/PNG/WebP/GIF/AVIF, vidéos MP4/MOV/WebM)' },
        400,
      );
    }

    if (file.size > spec.max * 1024 * 1024) {
      return json(
        { ok: false, error: `Fichier trop volumineux (max ${spec.max} Mo pour ${spec.kind === 'video' ? 'une vidéo' : 'une image'})` },
        400,
      );
    }

    const key = `uploads/${crypto.randomUUID()}.${spec.ext}`;
    // file.stream() : pas de bufferisation, la mémoire du Worker reste stable
    await env.STORAGE.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
    const mediaUrl = `/images/${key.replace('uploads/', '')}`;

    return json(
      {
        ok: true,
        media_url: mediaUrl,
        image_url: mediaUrl, // compat
        media_type: file.type,
        kind: spec.kind,
      },
      201,
    );
  } catch (e: unknown) {
    console.error('Upload error:', e);
    return json({ ok: false, error: "Erreur lors de l'upload" }, 500);
  }
}
