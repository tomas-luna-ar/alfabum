// Arma el catálogo de alfajores a partir de Open Food Facts y genera la migración SQL que lo carga.
//
//   node scripts/build-catalog.mjs
//
// Los datos de Open Food Facts tienen licencia ODbL y las fotos CC BY-SA: hay que citar la fuente.
// Las imágenes no se copian: se usan desde images.openfoodfacts.org (permite CORS).

import { writeFile } from "node:fs/promises";

const OUT = new URL("../supabase/migrations/20261003000000_catalog.sql", import.meta.url);
const PAGE_SIZE = 100;
const FIELDS = "code,product_name,product_name_es,brands,image_front_url";
const USER_AGENT = "Alfabum/0.1 (catalogo de alfajores)";

/** Grupos dueños de varias marcas: si un producto lista uno de estos y otra marca, se usa la otra. */
const PARENT_COMPANIES = new Set([
  "arcor",
  "grupo arcor",
  "mondelez",
  "mondelez international",
  "bagley",
  "kraft",
  "nestle",
  "georgalos",
]);

/** Cómo se escribe cada marca (clave: sin acentos ni mayúsculas). Las que no están se pasan a Título. */
const BRAND_NAMES = {
  guaymallen: "Guaymallén",
  mardel: "Mardel",
  "capitan del espacio": "Capitán del Espacio",
  "bon o bon": "Bon o Bon",
  "b & n": "B&N",
  "b&n": "B&N",
  havanna: "Havanna",
  cachafaz: "Cachafaz",
  milka: "Milka",
  oreo: "Oreo",
  terrabusi: "Terrabusi",
  "jorgito": "Jorgito",
  "fantoche": "Fantoche",
  "tofi": "Tofi",
  "marley": "Marley",
  aguila: "Águila",
  havana: "Havanna",
  "fan to che": "Fantoche",
  "alfajores jorgito": "Jorgito",
  "capitan del espacio sa": "Capitán del Espacio",
  "nonna vitta": "Nonna Vita",
  "genio nevados": "Genio",
  "alfajores odara": "Odara",
};

/** Nombres que no dicen nada: se reemplazan por "Clásico". */
const EMPTY_NAMES = new Set(["", "alf", "alfajor", "alfajores", "alfajorcito", "clasico", "classic"]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Open Food Facts limita las búsquedas por minuto: reintenta con espera creciente. */
async function fetchPage(page) {
  const url =
    "https://world.openfoodfacts.org/cgi/search.pl?action=process&json=1" +
    "&tagtype_0=categories&tag_contains_0=contains&tag_0=alfajores" +
    `&fields=${FIELDS}&page_size=${PAGE_SIZE}&page=${page}`;
  for (let attempt = 1; attempt <= 8; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (res.ok) return res.json();
    const wait = 10_000 * attempt;
    console.error(`Página ${page}: ${res.status}, reintento en ${wait / 1000}s`);
    await sleep(wait);
  }
  throw new Error(`No se pudo bajar la página ${page}`);
}

const fold = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const titleCase = (s) => s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep, c) => sep + c.toUpperCase());

function cleanBrand(raw) {
  const brands = (raw ?? "")
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean);
  const own = brands.find((b) => !PARENT_COMPANIES.has(fold(b))) ?? brands[0];
  if (!own) return null;
  return BRAND_NAMES[fold(own)] ?? titleCase(own);
}

function cleanName(raw, brand) {
  let name = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!name) return null;
  // "Alfajor Havanna de chocolate" → "Alfajor de chocolate": la marca ya está en su campo
  const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  name = name.replace(new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, "giu"), " ");
  name = name
    .replace(/^alfajor(es)?\b\s*/i, "")
    .replace(/^[\s\-–—.,:]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (EMPTY_NAMES.has(fold(name))) name = "Clásico";
  // Nombres escritos todo en mayúsculas pasan a minúsculas con la primera en mayúscula
  if (name === name.toUpperCase()) name = name.toLowerCase();
  name = name.charAt(0).toUpperCase() + name.slice(1);
  // Entra en el campo de la figurita (40): se corta en el último espacio para no partir una palabra
  if (name.length > 40) name = name.slice(0, 40).replace(/\s+\S*$/, "");
  return name.replace(/[\s,(-]+$/, "");
}

/** Imagen grande en lugar de la de 400 px: el recorte necesita resolución. */
const fullImage = (url) => url.replace(/\.\d+\.jpg$/, ".full.jpg");

const sql = (s) => `'${s.replace(/'/g, "''")}'`;

async function main() {
  const first = await fetchPage(1);
  const pages = Math.ceil(first.count / PAGE_SIZE);
  const products = [...first.products];
  for (let page = 2; page <= pages; page++) {
    await sleep(7_000);
    products.push(...(await fetchPage(page)).products);
  }
  console.error(`Bajados ${products.length} de ${first.count}`);

  const byKey = new Map();
  let skipped = 0;
  for (const p of products) {
    const brand = cleanBrand(p.brands);
    const name = brand && cleanName(p.product_name_es || p.product_name, brand);
    if (!brand || !name || !p.image_front_url || !p.code) {
      skipped++;
      continue;
    }
    const key = `${fold(brand)}|${fold(name)}`;
    if (!byKey.has(key)) byKey.set(key, { code: p.code, brand, name, image: fullImage(p.image_front_url) });
  }
  const items = [...byKey.values()].sort((a, b) => a.brand.localeCompare(b.brand, "es") || a.name.localeCompare(b.name, "es"));
  console.error(`Catálogo: ${items.length} alfajores (${skipped} sin marca, nombre o foto; ${products.length - skipped - items.length} repetidos)`);

  const rows = items.map((i) => `  (${sql(i.code)}, ${sql(i.brand)}, ${sql(i.name)}, ${sql(i.image)})`);
  const out = `-- Catálogo de alfajores conocidos, generado con scripts/build-catalog.mjs desde Open Food Facts
-- (datos ODbL, fotos CC BY-SA: https://world.openfoodfacts.org). No editar a mano: volver a generar.

create table if not exists public.catalog (
  code text primary key,
  brand text not null,
  name text not null,
  image_url text not null
);

alter table public.catalog enable row level security;

drop policy if exists "Catálogo público" on public.catalog;
create policy "Catálogo público" on public.catalog for select to anon, authenticated using (true);

-- Figuritas pegadas desde el catálogo: de dónde salió la foto, para citar la fuente
alter table public.alfajores add column if not exists photo_credit text check (char_length(photo_credit) <= 120);

insert into public.catalog (code, brand, name, image_url) values
${rows.join(",\n")}
on conflict (code) do update set brand = excluded.brand, name = excluded.name, image_url = excluded.image_url;
`;
  await writeFile(OUT, out);
  console.error(`Escrito ${OUT.pathname}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
