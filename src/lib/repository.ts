import { toThumbnail } from "./image";
import { ensureSession, publicUrl, STICKERS_BUCKET, supabase } from "./supabase";
import type { Breakdown } from "./gamification";
import type { Alfajor, AlfajorRepository, AlfajorUpdate, CatalogItem, NewAlfajor } from "./types";

type AlfajorRow = {
  id: string;
  number: number;
  name: string;
  brand: string;
  rating: number;
  notes: string;
  photo_path: string;
  thumb_path: string;
  photo_style: Alfajor["photoStyle"];
  photo_credit: string | null;
  created_at: string;
};

/** `crypto.randomUUID` solo existe en contextos seguros (HTTPS o localhost); al probar por la IP de la red local no está. */
function newId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const COLUMNS = "id, number, name, brand, rating, notes, photo_path, thumb_path, photo_style, photo_credit, created_at";

function fromRow(row: AlfajorRow): Alfajor {
  return {
    id: row.id,
    number: row.number,
    name: row.name,
    brand: row.brand,
    rating: row.rating,
    notes: row.notes,
    photoUrl: publicUrl(row.photo_path),
    thumbUrl: publicUrl(row.thumb_path),
    photoStyle: row.photo_style,
    photoCredit: row.photo_credit,
    createdAt: Date.parse(row.created_at),
  };
}

/** Figuritas del usuario actual en Supabase: los datos en la tabla `alfajores`, las imágenes en Storage. */
export const repository: AlfajorRepository = {
  async list() {
    await ensureSession();
    const { data, error } = await supabase.from("alfajores").select(COLUMNS).order("created_at");
    if (error) throw error;
    return data.map(fromRow);
  },

  async get(id) {
    await ensureSession();
    const { data, error } = await supabase.from("alfajores").select(COLUMNS).eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? fromRow(data) : undefined;
  },

  async create({ photo, photoStyle, photoCredit, ...fields }: NewAlfajor) {
    const session = await ensureSession();
    const id = newId();
    // Cada usuario sube a su propia carpeta: así lo exigen las políticas de Storage
    const photoPath = `${session.user.id}/${id}.jpg`;
    const thumbPath = `${session.user.id}/${id}-thumb.jpg`;
    const bucket = supabase.storage.from(STICKERS_BUCKET);

    const uploads = await Promise.all([
      bucket.upload(photoPath, photo, { contentType: "image/jpeg", cacheControl: "31536000" }),
      bucket.upload(thumbPath, await toThumbnail(photo), { contentType: "image/jpeg", cacheControl: "31536000" }),
    ]);
    const uploadError = uploads.find((u) => u.error)?.error;
    if (uploadError) {
      await bucket.remove([photoPath, thumbPath]);
      throw uploadError;
    }

    const { data, error } = await supabase
      .from("alfajores")
      // El número lo asigna la base (trigger), así que acá va cualquier valor
      .insert({
        id,
        ...fields,
        number: 0,
        photo_path: photoPath,
        thumb_path: thumbPath,
        photo_style: photoStyle,
        photo_credit: photoCredit,
      })
      .select(COLUMNS)
      .single();
    if (error) {
      await bucket.remove([photoPath, thumbPath]);
      throw error;
    }
    return fromRow(data);
  },

  async update(id: string, fields: AlfajorUpdate) {
    await ensureSession();
    const { data, error } = await supabase.from("alfajores").update(fields).eq("id", id).select(COLUMNS).single();
    if (error) throw error;
    return fromRow(data);
  },

  async remove(id) {
    await ensureSession();
    const { data, error } = await supabase
      .from("alfajores")
      .delete()
      .eq("id", id)
      .select("photo_path, thumb_path")
      .single();
    if (error) throw error;
    // Si fallara el borrado de las imágenes quedan huérfanas, pero la figurita ya no está en el álbum
    await supabase.storage.from(STICKERS_BUCKET).remove([data.photo_path, data.thumb_path]);
  },
};

export type MyAlbum = { shareCode: string; displayName: string | null };

/** Álbum del usuario actual (código del link público y nombre); lo crea la primera vez. */
export async function getMyAlbum(): Promise<MyAlbum> {
  await ensureSession();
  const { data, error } = await supabase.from("albums").select("share_code, display_name").maybeSingle();
  if (error) throw error;
  if (data) return { shareCode: data.share_code, displayName: data.display_name };
  const { data: created, error: createError } = await supabase
    .from("albums")
    .insert({})
    .select("share_code, display_name")
    .single();
  if (createError) throw createError;
  return { shareCode: created.share_code, displayName: created.display_name };
}

/** Código del link público del álbum del usuario actual. */
export async function getShareCode(): Promise<string> {
  return (await getMyAlbum()).shareCode;
}

/** Nombre que ven los amigos ("Álbum de …"). */
export async function setDisplayName(name: string): Promise<void> {
  await getMyAlbum();
  const { error } = await supabase
    .from("albums")
    .update({ display_name: name.trim() || null })
    .eq("owner_id", (await ensureSession()).user.id);
  if (error) throw error;
}

/** Figuritas de un álbum compartido, para cualquiera que tenga el link (no hace falta sesión). */
export async function getSharedAlbum(code: string): Promise<Alfajor[]> {
  const { data, error } = await supabase.rpc("shared_album", { code });
  if (error) throw error;
  return (data as AlfajorRow[]).map(fromRow);
}

/** Catálogo completo de alfajores conocidos (son unos 200: se busca en el navegador). */
export async function getCatalog(): Promise<CatalogItem[]> {
  const { data, error } = await supabase.from("catalog").select("code, brand, name, image_url").order("brand");
  if (error) throw error;
  return data.map((row) => ({ code: row.code, brand: row.brand, name: row.name, imageUrl: row.image_url }));
}

/** Nombre del dueño de un álbum compartido (null si no puso uno o el link no existe). */
export async function getSharedAlbumName(code: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("shared_album_name", { code });
  if (error) throw error;
  return data as string | null;
}

export type FriendAlbum = {
  shareCode: string;
  displayName: string | null;
  breakdown: Breakdown;
  lastThumbUrl: string | null;
  lastPhotoStyle: Alfajor["photoStyle"] | null;
  lastAdded: number | null;
};

type FriendRow = {
  share_code: string;
  display_name: string | null;
  stickers: number;
  brands: number;
  comments: number;
  own_photos: number;
  last_thumb_path: string | null;
  last_photo_style: Alfajor["photoStyle"] | null;
  last_added: string | null;
};

/** Álbumes que sigue el usuario actual, con lo necesario para mostrar su nivel y última figurita. */
export async function getFriends(): Promise<FriendAlbum[]> {
  await ensureSession();
  const { data, error } = await supabase.rpc("friend_albums");
  if (error) throw error;
  return (data as FriendRow[]).map((row) => ({
    shareCode: row.share_code,
    displayName: row.display_name,
    breakdown: { stickers: row.stickers, brands: row.brands, comments: row.comments, ownPhotos: row.own_photos },
    lastThumbUrl: row.last_thumb_path ? publicUrl(row.last_thumb_path) : null,
    lastPhotoStyle: row.last_photo_style,
    lastAdded: row.last_added ? Date.parse(row.last_added) : null,
  }));
}

/**
 * Relación del usuario con un álbum compartido. No crea sesión: quien solo mira un link no se vuelve usuario
 * hasta que toca "Agregar a mis amigos".
 */
export async function getFollowStatus(code: string): Promise<"own" | "friend" | "none"> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return "none";
  const [own, friend] = await Promise.all([
    supabase.from("albums").select("share_code").maybeSingle(),
    supabase.from("friends").select("share_code").eq("share_code", code).maybeSingle(),
  ]);
  if (own.error) throw own.error;
  if (friend.error) throw friend.error;
  if (own.data?.share_code === code) return "own";
  return friend.data ? "friend" : "none";
}

export async function addFriend(code: string): Promise<void> {
  await ensureSession();
  const { error } = await supabase.from("friends").upsert({ share_code: code }, { ignoreDuplicates: true });
  if (error) throw error;
}

export async function removeFriend(code: string): Promise<void> {
  await ensureSession();
  const { error } = await supabase.from("friends").delete().eq("share_code", code);
  if (error) throw error;
}

export const REACTION_EMOJIS = ["😋", "🤤", "🔥", "😂", "🤢"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

/** Reacciones de una figurita: cuántas de cada emoji y cuál puso el usuario actual. */
export type StickerReactions = { counts: Partial<Record<ReactionEmoji, number>>; mine: ReactionEmoji | null };

/** Reacciones de todas las figuritas de un álbum, por id de figurita. */
export async function getAlbumReactions(code: string): Promise<Map<string, StickerReactions>> {
  const { data, error } = await supabase.rpc("album_reactions", { code });
  if (error) throw error;
  const byAlfajor = new Map<string, StickerReactions>();
  for (const row of data as { alfajor_id: string; emoji: ReactionEmoji; total: number; mine: boolean }[]) {
    const entry = byAlfajor.get(row.alfajor_id) ?? { counts: {}, mine: null };
    entry.counts[row.emoji] = row.total;
    if (row.mine) entry.mine = row.emoji;
    byAlfajor.set(row.alfajor_id, entry);
  }
  return byAlfajor;
}

/** Pone, cambia o saca (null) la reacción del usuario actual a una figurita. */
export async function setReaction(alfajorId: string, emoji: ReactionEmoji | null): Promise<void> {
  const session = await ensureSession();
  const { error } = emoji
    ? await supabase.from("reactions").upsert({ alfajor_id: alfajorId, user_id: session.user.id, emoji })
    : await supabase.from("reactions").delete().eq("alfajor_id", alfajorId).eq("user_id", session.user.id);
  if (error) throw error;
}

export type FeedItem = {
  kind: "sticker" | "reaction";
  /** Álbum al que lleva la novedad (el del amigo que pegó o reaccionó), si tiene uno. */
  shareCode: string | null;
  who: string | null;
  emoji: string | null;
  alfajorName: string;
  alfajorBrand: string;
  thumbUrl: string;
  createdAt: number;
};

/** Novedades para la campanita: figuritas nuevas de amigos y reacciones a mis figuritas. */
export async function getFeed(): Promise<FeedItem[]> {
  await ensureSession();
  const { data, error } = await supabase.rpc("my_feed", { lim: 30 });
  if (error) throw error;
  return (
    data as {
      kind: FeedItem["kind"];
      share_code: string | null;
      who: string | null;
      emoji: string | null;
      alfajor_name: string;
      alfajor_brand: string;
      thumb_path: string;
      created_at: string;
    }[]
  ).map((row) => ({
    kind: row.kind,
    shareCode: row.share_code,
    who: row.who,
    emoji: row.emoji,
    alfajorName: row.alfajor_name,
    alfajorBrand: row.alfajor_brand,
    thumbUrl: publicUrl(row.thumb_path),
    createdAt: Date.parse(row.created_at),
  }));
}
