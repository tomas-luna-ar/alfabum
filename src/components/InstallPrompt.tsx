"use client";

import { useEffect, useState } from "react";

/** Evento de Chrome/Android para mostrar la ventana nativa de "Instalar app" cuando queramos. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Mode = "prompt" | "ios" | "android-menu";

const DISMISS_KEY = "install-dismissed";

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Invita a agregar Alfabum a la pantalla de inicio. En Chrome/Android abre la ventana nativa;
 * en iPhone no se puede abrir desde la página, así que explica los pasos. No aparece si ya se abrió desde el ícono.
 */
export function InstallPrompt() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone() || readDismissed()) return;
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el sistema operativo solo se conoce en el cliente
    if (isIOS) setMode("ios");
    else if (/Android/.test(ua)) setMode("android-menu");

    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode("prompt");
    }
    function onInstalled() {
      setMode(null);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    setMode(null);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === "accepted") setMode(null);
  }

  if (!mode) return null;

  return (
    <div className="mb-5 flex items-start gap-3 rounded-xl bg-white/90 p-3 shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element -- ícono local chico */}
      <img src="/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 text-sm text-stone-700">
        <p className="font-semibold text-amber-900">Agregá Alfabum a tu celu</p>
        {mode === "prompt" && <p>Abrilo desde un ícono, como cualquier app.</p>}
        {mode === "ios" && (
          <p>
            Tocá <ShareIcon /> <strong>Compartir</strong> y después <strong>“Agregar a inicio”</strong>.
          </p>
        )}
        {mode === "android-menu" && (
          <p>
            Tocá el menú <strong>⋮</strong> del navegador y después <strong>“Agregar a la pantalla principal”</strong>.
          </p>
        )}
        {mode === "prompt" && (
          <button
            onClick={install}
            className="mt-2 rounded-full bg-amber-900 px-4 py-1.5 text-sm font-semibold text-amber-50"
          >
            Instalar
          </button>
        )}
      </div>
      <button onClick={dismiss} className="-mr-1 -mt-1 px-2 text-lg text-stone-400" aria-label="Cerrar">
        ×
      </button>
    </div>
  );
}

/** Ícono de "Compartir" de Safari, para que se reconozca el botón. */
function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="inline h-4 w-4 -translate-y-0.5 text-blue-600"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M12 3v12M8 7l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" strokeLinecap="round" />
    </svg>
  );
}
