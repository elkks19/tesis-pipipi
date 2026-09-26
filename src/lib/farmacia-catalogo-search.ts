import type { MedicamentoCatalogo } from "@/lib/schema";

export type CatalogoOption = Pick<MedicamentoCatalogo, "atcCode" | "titularRegistro" | "id" | "principioActivo" | "nombreComercial" | "concentracion" | "formaFarmaceutica" | "registroSanitario" | "viaAdministracion" | "laboratorio">;
export type CatalogoPage = { items: CatalogoOption[]; nextOffset: number | null };

export function normalizeCatalogQuery(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export function indexCatalog(items: CatalogoOption[]) {
  return items.map((item) => ({ item, search: normalizeCatalogQuery([
    item.principioActivo, item.nombreComercial, item.concentracion,
    item.formaFarmaceutica, item.registroSanitario, item.laboratorio,
  ].filter(Boolean).join(" ")) })).sort((a, b) =>
    a.item.principioActivo.localeCompare(b.item.principioActivo, "es") || a.item.id.localeCompare(b.item.id));
}

export function searchCatalog(index: ReturnType<typeof indexCatalog>, query: string, offset = 0): CatalogoPage {
  const terms = normalizeCatalogQuery(query).split(/\s+/).filter(Boolean);
  const matches = index.filter(({ search }) => terms.every((term) => search.includes(term)));
  const items = matches.slice(offset, offset + 30).map(({ item }) => item);
  return { items, nextOffset: offset + items.length < matches.length ? offset + items.length : null };
}
