"use client";

/** Hasta cuándo vio el usuario las novedades (por navegador): lo más nuevo cuenta como sin leer. */
const SEEN_KEY = "feed-seen-at";

export function readFeedSeenAt(): number {
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function markFeedSeen(at = Date.now()) {
  try {
    localStorage.setItem(SEEN_KEY, String(at));
  } catch {}
}
