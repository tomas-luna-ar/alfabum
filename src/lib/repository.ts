import { toThumbnail } from "./image";
import { ensureSession, publicUrl, STICKERS_BUCKET, supabase } from "./supabase";
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

/** Código del link público del álbum del usuario actual; lo crea la primera vez. */
export async function getShareCode(): Promise<string> {
  await ensureSession();
  const { data, error } = await supabase.from("albums").select("share_code").maybeSingle();
  if (error) throw error;
  if (data) return data.share_code;
  const { data: created, error: createError } = await supabase.from("albums").insert({}).select("share_code").single();
  if (createError) throw createError;
  return created.share_code;
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
