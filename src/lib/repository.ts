import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Alfajor, AlfajorRepository, AlfajorUpdate, NewAlfajor } from "./types";

interface AlbumDB extends DBSchema {
  alfajores: {
    key: string;
    value: Alfajor;
    indexes: { byCreatedAt: number };
  };
}

let dbPromise: Promise<IDBPDatabase<AlbumDB>> | null = null;

function getDB() {
  dbPromise ??= openDB<AlbumDB>("alfajor-album", 1, {
    upgrade(db) {
      const store = db.createObjectStore("alfajores", { keyPath: "id" });
      store.createIndex("byCreatedAt", "createdAt");
    },
  });
  return dbPromise;
}

export const localRepository: AlfajorRepository = {
  async list() {
    const db = await getDB();
    return db.getAllFromIndex("alfajores", "byCreatedAt");
  },

  async get(id) {
    const db = await getDB();
    return db.get("alfajores", id);
  },

  async create(data: NewAlfajor) {
    const db = await getDB();
    const tx = db.transaction("alfajores", "readwrite");
    const all = await tx.store.getAll();
    const number = all.reduce((max, a) => Math.max(max, a.number), 0) + 1;
    const alfajor: Alfajor = {
      ...data,
      id: crypto.randomUUID(),
      number,
      createdAt: Date.now(),
    };
    await tx.store.add(alfajor);
    await tx.done;
    return alfajor;
  },

  async update(id: string, data: AlfajorUpdate) {
    const db = await getDB();
    const tx = db.transaction("alfajores", "readwrite");
    const current = await tx.store.get(id);
    if (!current) throw new Error("Alfajor no encontrado");
    const updated = { ...current, ...data };
    await tx.store.put(updated);
    await tx.done;
    return updated;
  },

  async remove(id) {
    const db = await getDB();
    await db.delete("alfajores", id);
  },
};

export const repository: AlfajorRepository = localRepository;
