import assert from "node:assert/strict";
import { test } from "node:test";
import ExcelJS from "exceljs";
import { importCatalog } from "../../scripts/catalogo-agemed-worker.mjs";

async function source(rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Medicamentos");
  sheet.addRow(["Listado oficial"]);
  sheet.addRow(["REGISTRO", "REGISTRO", "REGISTRO", "NOMBRE COMERCIAL", "NOMBRE GENERICO\t", "FORMA FARMACÃ‰UTICA", "CONCENTRACIÃ“N"]);
  for (const row of rows) sheet.addRow(row);
  return { buffer: await workbook.xlsx.writeBuffer(), contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", url: "https://example.test/catalogo.xlsx" };
}

function database(initial = []) {
  const docs = new Map(initial.map((doc) => [doc._id, doc]));
  return {
    docs,
    async allDocs({ keys, startkey, endkey }) {
      return { rows: (keys ?? [...docs.keys()].filter((id) => id >= startkey && id <= endkey)).map((id) => ({ id, doc: docs.get(id) })) };
    },
    async put(doc) {
      const existing = docs.get(doc._id);
      assert.equal(doc._rev, existing?._rev, "La actualizacion debe conservar la revision");
      docs.set(doc._id, { ...doc, _rev: String(Number(existing?._rev ?? 0) + 1) });
      return { ok: true, id: doc._id };
    },
    async bulkDocs(batch) { return Promise.all(batch.map((doc) => this.put(doc))); },
  };
}
const medication = ["II", 14822, "02-03-2022", "MARCA", "AMIODARONA", "COMPRIMIDO", "200MG"];

test("importa el formato oficial y repetirlo actualiza sin duplicar ni tocar altas manuales", async () => {
  const manual = { _id: "medicamentoCatalogo:manual", fuente: "manual", _rev: "1" };
  const db = database([manual]);
  const input = await source([medication, medication]);
  assert.equal((await importCatalog(db, async () => input)).imported, 1);
  assert.equal((await importCatalog(db, async () => input)).imported, 1);
  const imported = [...db.docs.values()].filter((doc) => doc.fuente === "agemed");
  assert.equal(imported.length, 1);
  assert.equal(imported[0].registroSanitario, "II-14822/2022");
  assert.equal(imported[0].concentracion, "200MG");
  assert.equal(imported[0].formaFarmaceutica, "COMPRIMIDO");
  assert.deepEqual(db.docs.get(manual._id), manual);
});

test("archivo vacio no desactiva el catalogo anterior y deja una auditoria fallida", async () => {
  const previous = { _id: "medicamentoCatalogo:agemed:anterior", registroVigente: true };
  const db = database([previous]);
  const input = await source([]);
  await assert.rejects(importCatalog(db, async () => input), /no contiene medicamentos validos/);
  assert.deepEqual(db.docs.get(previous._id), previous);
  assert.equal([...db.docs.values()].filter((doc) => doc.estado === "fallida").length, 1);
});

test("fallo de escritura se propaga para reintentar y no retira registros anteriores", async () => {
  const previous = { _id: "medicamentoCatalogo:agemed:anterior", registroVigente: true };
  const db = database([previous]);
  db.bulkDocs = async () => [{ error: "conflict" }];
  const input = await source([medication]);
  await assert.rejects(importCatalog(db, async () => input), /Fallaron 1 medicamentos/);
  assert.deepEqual(db.docs.get(previous._id), previous);
  assert.equal([...db.docs.values()].filter((doc) => doc.estado === "fallida").length, 1);
});

test("una fila incompleta impide retirar registros previos", async () => {
  const previous = { _id: "medicamentoCatalogo:agemed:anterior", registroVigente: true };
  const db = database([previous]);
  const input = await source([medication, ["II", 10]]);
  const result = await importCatalog(db, async () => input);
  assert.equal(result.omitted, 1);
  assert.equal(result.retired, 0);
  assert.deepEqual(db.docs.get(previous._id), previous);
});
