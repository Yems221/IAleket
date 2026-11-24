// Configuration publique de l'instance — GET /config.json
// Ne contient que des valeurs publiques (l'identifiant Google n'est pas un secret).
import { json } from './_shared';

interface Env {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  PUBLIC_ORIGIN?: string;
}

// Adresse publique de l'instance (ex. https://leketia.saccessa.com), pour les liens de partage.
// Seulement une origine https valide ; sinon vide, et l'app garde sa propre adresse.
function publicOrigin(raw: string | undefined): string {
  try {
    const u = new URL((raw || '').trim());
    return u.protocol === 'https:' && u.origin === (raw || '').trim().replace(/\/$/, '') ? u.origin : '';
  } catch { return ''; }
}

export async function onRequestGet(context: { env: Env }): Promise<Response> {
  // googleSync : le secret est configuré, donc l'accès Google peut durer (synchronisation automatique).
  // Le secret lui-même n'est jamais envoyé.
  return json({ googleClientId: (context.env.GOOGLE_CLIENT_ID || '').trim(), googleSync: !!(context.env.GOOGLE_CLIENT_SECRET || '').trim(), publicOrigin: publicOrigin(context.env.PUBLIC_ORIGIN) });
}
