"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { repository } from "./repository";
import { ensureSession, supabase } from "./supabase";
import type { Alfajor } from "./types";

export function useAlfajores() {
  const [alfajores, setAlfajores] = useState<Alfajor[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    repository.list().then(
      (list) => !cancelled && setAlfajores(list),
      (err) => {
        console.error("No se pudo cargar el álbum", err);
        if (!cancelled) setError(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return { alfajores, error };
}

export function useAlfajor(id: string) {
  const [alfajor, setAlfajor] = useState<Alfajor | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    repository.get(id).then(
      (a) => !cancelled && setAlfajor(a ?? null),
      (err) => {
        console.error("No se pudo cargar la figurita", err);
        if (!cancelled) setAlfajor(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { alfajor, setAlfajor };
}

/** Usuario actual (anónimo o con cuenta); se actualiza al guardar la cuenta, entrar o salir. */
export function useUser() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let cancelled = false;
    ensureSession().then(
      (session) => !cancelled && setUser(session.user),
      (err) => console.error("No se pudo iniciar sesión", err),
    );
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled && session) setUser(session.user);
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  return user;
}
