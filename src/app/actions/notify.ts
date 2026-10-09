"use server";

import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

type Target = {
  endpoint: string;
  p256dh: string;
  auth_key: string;
  who: string | null;
  alfajor_name: string;
  alfajor_brand: string;
  share_code: string;
};

/**
 * Avisa por push a quienes siguen el álbum que el usuario pegó una figurita nueva.
 * Corre con la sesión del usuario: la base solo devuelve destinatarios si la figurita es suya,
 * es reciente y todavía no se avisó (así no se puede usar para mandar spam).
 */
export async function notifyNewSticker(accessToken: string, alfajorId: string): Promise<number> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!publicKey || !privateKey || !url || !key) return 0;

  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("claim_new_sticker_push", { sticker: alfajorId });
  if (error) throw new Error(`No se pudo preparar el aviso: ${error.message}`);
  const targets = (data ?? []) as Target[];
  if (targets.length === 0) return 0;

  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "https://alfabum.vercel.app", publicKey, privateKey);
  const first = targets[0];
  const payload = JSON.stringify({
    title: `🍫 ${first.who ?? "Un amigo"} pegó un alfajor nuevo`,
    body: `${first.alfajor_brand} · ${first.alfajor_name}`,
    url: `/a/${first.share_code}`,
    tag: `sticker-${alfajorId}`,
  });

  const results = await Promise.allSettled(
    targets.map((t) => webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth_key } }, payload)),
  );

  // 404/410: el navegador dio de baja la suscripción; se borra para no seguir intentando
  await Promise.all(
    results.map((r, i) => {
      const status = r.status === "rejected" ? (r.reason as { statusCode?: number }).statusCode : undefined;
      if (status === 404 || status === 410) {
        return supabase.rpc("forget_push_subscription", { dead_endpoint: targets[i].endpoint });
      }
    }),
  );
  return results.filter((r) => r.status === "fulfilled").length;
}
