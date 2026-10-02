export type Alfajor = {
  id: string;
  /** Número de figurita dentro del álbum (1, 2, 3...). */
  number: number;
  name: string;
  brand: string;
  /** Puntaje de 1 a 5. */
  rating: number;
  notes: string;
  /** URL pública de la imagen ya procesada al formato figurita. */
  photoUrl: string;
  /** URL de una versión chica, para la grilla del álbum. */
  thumbUrl: string;
  /** "scan": paquete recortado y enderezado. "photo": foto original. */
  photoStyle: PhotoStyle;
  /** Fuente de la foto cuando no la sacó el usuario (ej: "Foto: Open Food Facts"), para citarla. */
  photoCredit: string | null;
  createdAt: number;
};

export type PhotoStyle = "scan" | "photo";

export type NewAlfajor = Pick<Alfajor, "name" | "brand" | "rating" | "notes" | "photoStyle" | "photoCredit"> & {
  /** Imagen procesada; al guardarla se sube junto con su miniatura. */
  photo: Blob;
};

export type AlfajorUpdate = Partial<Pick<Alfajor, "name" | "brand" | "rating" | "notes">>;

/** Contrato de almacenamiento: las figuritas del usuario actual (ver repository.ts). */
export interface AlfajorRepository {
  list(): Promise<Alfajor[]>;
  get(id: string): Promise<Alfajor | undefined>;
  create(data: NewAlfajor): Promise<Alfajor>;
  update(id: string, data: AlfajorUpdate): Promise<Alfajor>;
  remove(id: string): Promise<void>;
}

/** Alfajor conocido del catálogo (sale de Open Food Facts), para no tener que sacarle foto. */
export type CatalogItem = {
  code: string;
  brand: string;
  name: string;
  imageUrl: string;
};
