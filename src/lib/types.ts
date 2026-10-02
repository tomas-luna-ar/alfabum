export type Alfajor = {
  id: string;
  /** Número de figurita dentro del álbum (1, 2, 3...). */
  number: number;
  name: string;
  brand: string;
  /** Puntaje de 1 a 5. */
  rating: number;
  notes: string;
  /** Foto ya recortada y redimensionada al formato figurita. */
  photo: Blob;
  createdAt: number;
};

export type NewAlfajor = Pick<Alfajor, "name" | "brand" | "rating" | "notes" | "photo">;

export type AlfajorUpdate = Partial<Pick<Alfajor, "name" | "brand" | "rating" | "notes">>;

/**
 * Contrato de almacenamiento. Hoy hay una implementación local (IndexedDB);
 * para el álbum global se puede agregar una implementación remota con la misma interfaz.
 */
export interface AlfajorRepository {
  list(): Promise<Alfajor[]>;
  get(id: string): Promise<Alfajor | undefined>;
  create(data: NewAlfajor): Promise<Alfajor>;
  update(id: string, data: AlfajorUpdate): Promise<Alfajor>;
  remove(id: string): Promise<void>;
}
