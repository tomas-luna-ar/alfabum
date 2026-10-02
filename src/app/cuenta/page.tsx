"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useUser } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";

const inputClass =
  "w-full rounded-lg border border-amber-900/20 bg-white px-3 py-2.5 text-base outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/20";

export default function CuentaPage() {
  const router = useRouter();
  const user = useUser();
  const [mode, setMode] = useState<"save" | "login">("save");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Convierte la cuenta anónima en una con mail y contraseña: las figuritas quedan, porque es el mismo usuario. */
  async function saveAccount() {
    const { error: emailError } = await supabase.auth.updateUser({ email });
    if (emailError) throw emailError;
    const { error: passwordError } = await supabase.auth.updateUser({ password });
    if (passwordError) throw passwordError;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "save") {
        await saveAccount();
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
        if (loginError) throw loginError;
        router.push("/");
      }
      setPassword("");
    } catch (err) {
      console.error(err);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <main className="mx-auto max-w-md px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="mb-6 flex items-center gap-3">
        <Link href="/" className="rounded-full bg-amber-900/10 px-3 py-1.5 text-amber-900" aria-label="Volver al álbum">
          ←
        </Link>
        <h1 className="font-display text-2xl text-amber-900">Tu cuenta</h1>
      </header>

      {!user ? (
        <p className="py-10 text-center text-amber-900/60">Cargando…</p>
      ) : !user.is_anonymous ? (
        <section className="space-y-4 rounded-xl bg-white/80 p-4 shadow-sm">
          <p className="text-stone-800">
            Tu álbum está guardado en <strong>{user.email}</strong>. Podés entrar desde cualquier celu con tu mail y contraseña.
          </p>
          <button onClick={signOut} className="w-full rounded-full bg-amber-900/10 py-3 font-semibold text-amber-900">
            Cerrar sesión
          </button>
        </section>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "save" ? (
            <p className="rounded-xl bg-white/80 p-4 text-sm text-stone-700 shadow-sm">
              Tu álbum está guardado solo en este celu. Ponele mail y contraseña para no perderlo y poder abrirlo desde otro lado.
            </p>
          ) : (
            <p className="rounded-xl bg-amber-100 p-4 text-sm text-amber-900">
              Al entrar con otra cuenta vas a ver ese álbum. Las figuritas de este celu que no guardaste se pierden.
            </p>
          )}

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-amber-900">Mail</span>
            <input
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-amber-900">Contraseña</span>
            <input
              type="password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "save" ? "new-password" : "current-password"}
              minLength={6}
              required
            />
          </label>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-amber-900 py-3.5 font-semibold text-amber-50 disabled:opacity-40"
          >
            {busy ? "Un momento…" : mode === "save" ? "Guardar mi álbum" : "Entrar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode(mode === "save" ? "login" : "save");
              setError(null);
            }}
            className="w-full text-sm font-medium text-amber-800 underline underline-offset-4"
          >
            {mode === "save" ? "¿Ya tenés una cuenta? Entrá" : "Volver a guardar este álbum"}
          </button>
        </form>
      )}
    </main>
  );
}

function errorMessage(err: unknown) {
  const code = (err as { code?: string })?.code;
  if (code === "invalid_credentials") return "Mail o contraseña incorrectos.";
  if (code === "email_exists" || code === "user_already_exists") return "Ya hay una cuenta con ese mail. Probá entrar.";
  if (code === "weak_password") return "La contraseña es muy débil: usá al menos 6 caracteres.";
  if (code === "email_address_invalid") return "Ese mail no parece válido.";
  return "No pudimos completar el pedido. Probá de nuevo.";
}
