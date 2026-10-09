"use client";

import { ensureSession, supabase } from "./supabase";

export type PushState =
  /** El navegador no soporta push (o en iPhone, la app no está agregada a inicio). */
  | "unsupported"
  /** En iPhone con Safari: hay que agregar Alfabum a inicio para poder recibir notificaciones. */
  | "needs-install"
  /** El usuario las bloqueó en el navegador: hay que habilitarlas desde los ajustes. */
  | "denied"
  | "off"
  | "on";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function isIOS() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function registerWorker() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
}

export async function getPushState(): Promise<PushState> {
  if (!VAPID_PUBLIC_KEY) return "unsupported";
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  // En iPhone, push solo existe dentro de la app agregada a inicio (iOS 16.4+)
  if (!supported) return isIOS() && !isStandalone() ? "needs-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  const registration = await registerWorker();
  return (await registration.pushManager.getSubscription()) ? "on" : "off";
}

/** Pide permiso, suscribe este navegador y lo guarda para que le lleguen los avisos. */
export async function enablePush(): Promise<PushState> {
  if (!VAPID_PUBLIC_KEY) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";

  const registration = await registerWorker();
  await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY),
    }));

  await ensureSession();
  const json = subscription.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert({
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? "",
  });
  if (error) throw error;
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const registration = await registerWorker();
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
    await subscription.unsubscribe();
  }
  return "off";
}

/** La clave pública VAPID viene en base64url; el navegador la pide en bytes. */
function base64UrlToBytes(value: string) {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
