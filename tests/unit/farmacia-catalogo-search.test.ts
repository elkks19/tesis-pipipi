import { describe, expect, it } from "vitest";
import { indexCatalog, searchCatalog } from "@/lib/farmacia-catalogo-search";

describe("búsqueda paginada del catálogo", () => {
  it("encuentra términos en distintos campos sin distinguir tildes o mayúsculas", () => {
    const index = indexCatalog([{ id: "1", principioActivo: "Ácido acetilsalicílico", nombreComercial: "Marca", concentracion: "100MG", registroSanitario: "II-123/2026" }]);
    expect(searchCatalog(index, "acido MARCA 100mg").items).toHaveLength(1);
    expect(searchCatalog(index, "II-123").items).toHaveLength(1);
    expect(searchCatalog(index, "ibuprofeno")).toEqual({ items: [], nextOffset: null });
  });
  it("recorre más de dos páginas sin repetir medicamentos con el mismo nombre", () => {
    const index = indexCatalog(Array.from({ length: 65 }, (_, i) => ({ id: String(i).padStart(3, "0"), principioActivo: "Paracetamol" })));
    const first = searchCatalog(index, "");
    const second = searchCatalog(index, "", first.nextOffset!);
    const third = searchCatalog(index, "", second.nextOffset!);
    expect([first.items.length, second.items.length, third.items.length]).toEqual([30, 30, 5]);
    expect(third.nextOffset).toBeNull();
    expect(new Set([...first.items, ...second.items, ...third.items].map((item) => item.id)).size).toBe(65);
  });
});
