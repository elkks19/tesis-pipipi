import { describe, expect, test } from "vitest";
import { paginateActivity } from "../../src/lib/activity-pagination";
import { formatBoliviaActivityDate } from "../../src/lib/bolivia-time";

describe("paginación de actividad", () => {
  test("formatea la hora boliviana con espacios y periodo estables para la hidratación", () => {
    expect(formatBoliviaActivityDate("2026-09-24T15:50:00.000Z"))
      .toBe("24 sept de 2026, 11:50 a. m.");
    expect(formatBoliviaActivityDate("2026-09-24T01:18:45.228Z"))
      .toBe("23 sept de 2026, 9:18 p. m.");
    expect(formatBoliviaActivityDate("invalid"))
      .toBe("Fecha no disponible");
  });
  test("el 24 UTC sigue siendo 23 en Bolivia y los eventos futuros no desplazan al nuevo paciente", () => {
    const now = Date.parse("2026-09-24T01:21:00Z");
    const current = { id: "paciente-real", createdAt: "2026-09-24T01:18:45.228Z" };
    const future = Array.from({ length: 20 }, (_, i) => ({ id: `seed-${i}`, createdAt: "2026-09-24T19:10:00Z" }));
    const page = paginateActivity([...future, current, { id: "invalid", createdAt: "invalid" }], 1, "", 15, now);
    expect(page.rows).toEqual([current]);
    expect(page.total).toBe(1);
    expect(formatBoliviaActivityDate(current.createdAt)).toContain("23");
    expect(formatBoliviaActivityDate(current.createdAt)).toContain("9:18");
  });
  const rows = Array.from({ length: 36 }, (_, index) => ({ id: `registro-${index}`, createdAt: new Date(Date.UTC(2026, 0, 1, index)).toISOString(), searchText: index === 2 ? "María Pérez CI 123456 Paciente actualizado" : "Otro paciente Registro creado" }));
  test("ordena todo antes de paginar sin omitir ni duplicar registros", () => {
    const pages = [1, 2, 3].map((page) => paginateActivity(rows, page));
    expect(pages[0].rows[0].id).toBe("registro-35");
    expect(pages[0].total).toBe(36);
    expect(pages[2].rows).toHaveLength(6);
    const ids = pages.flatMap((page) => page.rows.map((row) => row.id));
    expect(new Set(ids).size).toBe(36);
    expect(ids.at(-1)).toBe("registro-0");
  });
  test("busca más allá de la primera página y omite diferencias de acentos", () => {
    expect(paginateActivity(rows, 1, "maria 123456").rows.map((row) => row.id)).toEqual(["registro-2"]);
    expect(paginateActivity(rows, 1, "actualizado").total).toBe(1);
    expect(paginateActivity(rows, 1, "inexistente").total).toBe(0);
  });
  test("normaliza páginas inválidas y mantiene un desempate estable", () => {
    expect(paginateActivity(rows, -5).page).toBe(1);
    expect(paginateActivity(rows, Number.NaN).page).toBe(1);
    expect(paginateActivity(rows, 99).page).toBe(3);
    const tied = [{ id: "b", createdAt: "2026-01-01" }, { id: "a", createdAt: "2026-01-01" }];
    expect(paginateActivity(tied).rows).toEqual(paginateActivity([...tied].reverse()).rows);
  });
  test("coloca un evento nuevo en la primera página al actualizar", () => {
    const newer = { id: "nuevo", createdAt: "2026-02-01T00:00:00.000Z", searchText: "Paciente actualizado" };
    expect(paginateActivity([...rows, newer]).rows[0].id).toBe("nuevo");
  });
});
