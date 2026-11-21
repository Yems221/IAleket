// Configuration publique de l'instance — GET /config.json
// Ne contient que des valeurs publiques (l'identifiant Google n'est pas un secret).
import { json } from './_shared';

interface Env {
  GOOGLE_CLIENT_ID?: string;
}

export async function onRequestGet(context: { env: Env }): Promise<Response> {
  return json({ googleClientId: (context.env.GOOGLE_CLIENT_ID || '').trim() });
}
