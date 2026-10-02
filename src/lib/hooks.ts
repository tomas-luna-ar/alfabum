"use client";

import { useEffect, useState } from "react";
import { repository } from "./repository";
import type { Alfajor } from "./types";

export function useAlfajores() {
  const [alfajores, setAlfajores] = useState<Alfajor[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    repository.list().then((list) => {
      if (!cancelled) setAlfajores(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { alfajores };
}

export function useAlfajor(id: string) {
  const [alfajor, setAlfajor] = useState<Alfajor | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    repository.get(id).then((a) => {
      if (!cancelled) setAlfajor(a ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { alfajor, setAlfajor };
}
