import "server-only";
import { db } from "@/lib/db";
import { indexCatalog, searchCatalog, type CatalogoOption } from "@/lib/farmacia-catalogo-search";

// Solo datos públicos del catálogo; nunca pacientes ni permisos de usuario.
let cached: { expires: number; index: ReturnType<typeof indexCatalog> } | undefined;
let pending: Promise<ReturnType<typeof indexCatalog>> | undefined;

async function getIndex() {
  if (cached && cached.expires > Date.now()) return cached.index;
  if (!pending) {
    pending = (async () => {
      const result = await db.allDocs({ include_docs: true, startkey: "medicamentoCatalogo:agemed:", endkey: "medicamentoCatalogo:agemed:\ufff0" });
      const items: CatalogoOption[] = [];
      for (const { doc } of result.rows) {
        if (!doc || doc.type !== "medicamentoCatalogo" || doc.fuente !== "agemed" || doc.registroVigente === false) continue;
        const { atcCode, titularRegistro, id, principioActivo, nombreComercial, concentracion, formaFarmaceutica, registroSanitario, viaAdministracion, laboratorio } = doc;
        items.push({ atcCode, titularRegistro, id, principioActivo, nombreComercial, concentracion, formaFarmaceutica, registroSanitario, viaAdministracion, laboratorio });
      }
      const index = indexCatalog(items);
      cached = { index, expires: Date.now() + 60_000 };
      return index;
    })().finally(() => { pending = undefined; });
  }
  return pending;
}

export async function searchMedicamentoCatalogo(query: string, offset: number) {
  return searchCatalog(await getIndex(), query, offset);
}
