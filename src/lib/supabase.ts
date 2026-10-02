import { createClient, type Session } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local");
}

export const supabase = createClient(url, key);

export const STICKERS_BUCKET = "stickers";

let sessionPromise: Promise<Session> | null = null;

/**
 * Devuelve la sesión actual o crea un usuario anónimo, así nadie tiene que registrarse para empezar.
 * Se comparte la promesa para no crear varios anónimos si varias pantallas la piden a la vez.
 */
export function ensureSession(): Promise<Session> {
  sessionPromise ??= (async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session;
    const { data: anon, error } = await supabase.auth.signInAnonymously();
    if (error || !anon.session) throw error ?? new Error("No se pudo iniciar sesión");
    return anon.session;
  })().catch((err) => {
    sessionPromise = null;
    throw err;
  });
  return sessionPromise;
}

// Si cambia el usuario (entra con su cuenta o cierra sesión), la próxima llamada vuelve a leer la sesión
supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") sessionPromise = null;
});

export function publicUrl(path: string) {
  return supabase.storage.from(STICKERS_BUCKET).getPublicUrl(path).data.publicUrl;
}
