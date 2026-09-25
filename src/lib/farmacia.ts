import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { findTesisDocs } from "@/lib/db-find";
import { ensureTesisIndexes } from "@/lib/db-indexes";
import { db } from "@/lib/db";
import type { TesisDocument } from "@/lib/db";
import { canPerformFarmaciaAction, getFarmaciaAccessPhase, getLaPazDateValue, type FarmaciaAccessMode, type FarmaciaAccessPhase, type FarmaciaPermission } from "@/lib/farmacia-access";
export { canPerformFarmaciaAction, getFarmaciaAccessPhase } from "@/lib/farmacia-access";
export type { FarmaciaAccessMode, FarmaciaAccessPhase, FarmaciaPermission } from "@/lib/farmacia-access";
import type {
  MedicamentoCatalogo,
  DispensacionReceta,
  DispensacionRecetaLinea,
  InventarioMovimiento,
  Receta,
  RecetaMedicamento,
  Viaje,
  ViajeInventarioItem,
} from "@/lib/schema";

type ViajeDocument = PouchDB.Core.ExistingDocument<Viaje>;
type InventarioDocument = PouchDB.Core.ExistingDocument<ViajeInventarioItem>;
type CatalogoDocument = PouchDB.Core.ExistingDocument<MedicamentoCatalogo>;
type RecetaDocument = PouchDB.Core.ExistingDocument<Receta>;

export type FarmaciaPlanningTrip = {
  active: boolean;
  accessPhase: FarmaciaAccessPhase;
  estacionTipo?: string;
  establecimiento: string;
  fechaEntrada: string;
  fechaSalida: string;
  servicio: string;
  viajeId: string;
};

export type InventarioInput = Omit<
  ViajeInventarioItem,
  "createdAt" | "createdBy" | "id" | "type" | "updatedAt" | "updatedBy" | "viajeId"
>;

function isViaje(doc: unknown): doc is ViajeDocument {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "viaje" &&
    "_id" in doc &&
    "estaciones" in doc &&
    Array.isArray(doc.estaciones)
  );
}

function isInventarioItem(doc: unknown): doc is InventarioDocument {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "viajeInventarioItem" &&
    "_id" in doc
  );
}

function isReceta(doc: unknown): doc is RecetaDocument {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "receta" &&
    "_id" in doc
  );
}

function isCatalogo(doc: unknown): doc is CatalogoDocument {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "medicamentoCatalogo" &&
    "_id" in doc
  );
}

function cleanText(value: string | undefined) {
  const cleaned = value?.trim();

  return cleaned ? cleaned : undefined;
}

function normalizeForKey(value: string | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function buildMedicationCatalogId(item: InventarioInput) {
  const key = [
    item.principioActivo,
    item.concentracion,
    item.formaFarmaceutica,
    item.viaAdministracion,
    item.registroSanitario,
    item.laboratorio,
  ]
    .map(normalizeForKey)
    .join("|");
  const hash = createHash("sha1").update(key).digest("hex").slice(0, 18);

  return `medicamentoCatalogo:${hash}`;
}

function buildMedicationName(item: InventarioInput) {
  const parts = [
    item.principioActivo,
    item.concentracion,
    item.formaFarmaceutica,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" ") : item.nombre;
}

function sortInventario(a: InventarioDocument, b: InventarioDocument) {
  return a.nombre.localeCompare(b.nombre, "es");
}


export async function getFarmaciaPlanningTrip({
  mode,
  userId,
}: {
  mode: FarmaciaAccessMode;
  userId: string | null | undefined;
}): Promise<FarmaciaPlanningTrip | null> {
  if (!userId) {
    return null;
  }

  await ensureTesisIndexes();
  const result = await findTesisDocs({ limit: 500, selector: { type: "viaje" }, use_index: "idx_type" });
  const candidates = result.docs.filter(isViaje).filter((viaje) => {
    const farmacia = viaje.estaciones.find((station) => station.tipo === "Farmacia");
    return mode === "docente"
      ? farmacia?.docenteEncargadoId === userId
      : farmacia?.estudiantesIds.includes(userId);
  }).map((viaje) => ({ phase: getFarmaciaAccessPhase(viaje), viaje }))
    .filter(({ phase }) => phase !== "sin_acceso")
    .sort((a, b) => {
      const priority: Record<FarmaciaAccessPhase, number> = { activo: 0, conciliacion: 1, planeacion: 2, cerrado: 3, sin_acceso: 4 };
      return priority[a.phase] - priority[b.phase] || b.viaje.fechaEntrada.localeCompare(a.viaje.fechaEntrada);
    });
  const selected = candidates[0];
  if (!selected) return null;
  return {
    accessPhase: selected.phase,
    active: selected.phase === "activo",
    estacionTipo: "Farmacia",
    establecimiento: selected.viaje.establecimiento.nombre,
    fechaEntrada: selected.viaje.fechaEntrada,
    fechaSalida: selected.viaje.fechaSalida,
    servicio: selected.viaje.servicio,
    viajeId: selected.viaje._id,
  };
}

export async function authorizeFarmaciaAction({ mode, permission, userId, viajeId }: {
  mode: FarmaciaAccessMode;
  permission: FarmaciaPermission;
  userId: string;
  viajeId: string;
}) {
  const viaje = await db.get(viajeId).catch(() => null);
  if (!isViaje(viaje)) return false;
  const farmacia = viaje.estaciones.find((estacion) => estacion.tipo === "Farmacia");
  const assignedToMode = mode === "docente"
    ? farmacia?.docenteEncargadoId === userId
    : farmacia?.estudiantesIds.includes(userId);
  if (!assignedToMode) return false;
  return canPerformFarmaciaAction({ mode, permission, phase: getFarmaciaAccessPhase(viaje) });
}

export async function canAccessFarmaciaTrip({
  userId,
  viajeId,
}: {
  userId: string;
  viajeId: string;
}) {
  await ensureTesisIndexes();

  const viaje = await db.get(viajeId).catch(() => null);

  if (!isViaje(viaje)) {
    return false;
  }

  const farmacia = viaje.estaciones.find(
    (estacion) => estacion.tipo === "Farmacia",
  );

  if (!farmacia) {
    return false;
  }

  return (
    farmacia.docenteEncargadoId === userId ||
    farmacia.estudiantesIds.includes(userId)
  );
}

export async function listViajeInventario(viajeId: string) {
  await ensureTesisIndexes();

  const result = await findTesisDocs({
    limit: 500,
    selector: {
      type: "viajeInventarioItem",
      viajeId,
    },
    use_index: "idx_viaje_inventario_viaje",
  });

  const items = result.docs.filter(isInventarioItem);
  const movements = await listInventarioMovimientos(viajeId);
  const totals = movements.reduce((map, movement) => map.set(movement.inventarioItemId, (map.get(movement.inventarioItemId) ?? 0) + movement.cantidad), new Map<string, number>());
  return items.map((item) => item.cantidadInicial === undefined ? item : { ...item, cantidadDisponible: totals.get(item._id) ?? 0 }).sort(sortInventario);
}

export async function getRecetaById(recetaId: string | undefined) {
  if (!recetaId) {
    return null;
  }

  const doc = await db.get(recetaId).catch(() => null);

  return isReceta(doc) ? doc : null;
}

export async function listMedicamentoCatalogo() {
  await ensureTesisIndexes();

  const result = await findTesisDocs({
    limit: 20000,
    selector: {
      type: "medicamentoCatalogo",
    },
    use_index: "idx_type",
  });

  return result.docs
    .filter(isCatalogo)
    .filter((item) => item.fuente === "manual" || item.registroVigente !== false)
    .sort((a, b) => a.principioActivo.localeCompare(b.principioActivo, "es"));
}

export async function createViajeInventarioItem({
  item,
  userId,
  viajeId,
}: {
  item: InventarioInput;
  userId: string;
  viajeId: string;
}) {
  const now = new Date().toISOString();
  let catalogoId = item.catalogoId;
  let inventoryItem = item;

  if (item.categoria === "medicamento" && item.principioActivo) {
    catalogoId = catalogoId ?? buildMedicationCatalogId(item);
    const catalogDoc = await db.get(catalogoId).catch(() => null);
    if (isCatalogo(catalogDoc) && catalogDoc.fuente === "agemed") {
      inventoryItem = {
        ...item,
        atcCode: catalogDoc.atcCode,
        catalogoId: catalogDoc.id,
        concentracion: catalogDoc.concentracion,
        formaFarmaceutica: catalogDoc.formaFarmaceutica,
        fuente: "agemed",
        laboratorio: catalogDoc.laboratorio,
        nombreComercial: catalogDoc.nombreComercial,
        principioActivo: catalogDoc.principioActivo,
        registroSanitario: catalogDoc.registroSanitario,
        titularRegistro: catalogDoc.titularRegistro,
        viaAdministracion: catalogDoc.viaAdministracion,
      };
    }
    const catalogPayload: MedicamentoCatalogo = {
      atcCode: cleanText(item.atcCode),
      concentracion: cleanText(item.concentracion),
      createdAt: isCatalogo(catalogDoc) ? catalogDoc.createdAt : now,
      createdBy: isCatalogo(catalogDoc) ? catalogDoc.createdBy : userId,
      formaFarmaceutica: cleanText(item.formaFarmaceutica),
      fuente: item.fuente ?? "agemed",
      id: catalogoId,
      laboratorio: cleanText(item.laboratorio),
      manualMotivo: cleanText(item.manualMotivo),
      nombreComercial: cleanText(item.nombreComercial),
      principioActivo: item.principioActivo,
      registroSanitario: cleanText(item.registroSanitario),
      titularRegistro: cleanText(item.titularRegistro),
      type: "medicamentoCatalogo",
      updatedAt: now,
      updatedBy: userId,
      viaAdministracion: cleanText(item.viaAdministracion),
    };

    if (!isCatalogo(catalogDoc) || item.fuente === "manual") {
      await db.put({
        ...catalogPayload,
        ...(isCatalogo(catalogDoc) ? { _id: catalogDoc._id, _rev: catalogDoc._rev } : { _id: catalogoId }),
      });
    }
  }

  const itemId = `viajeInventarioItem:${viajeId}:${randomUUID()}`;
  const document: ViajeInventarioItem = {
    ...inventoryItem,
    cantidadDisponible: inventoryItem.cantidadDisponible ?? inventoryItem.cantidadPlanificada,
    cantidadInicial: inventoryItem.cantidadDisponible ?? inventoryItem.cantidadPlanificada,
    cantidadMinima: inventoryItem.cantidadMinima ?? 0,
    catalogoId,
    condicion: inventoryItem.condicion ?? "disponible",
    createdAt: now,
    createdBy: userId,
    id: itemId,
    nombre: inventoryItem.categoria === "medicamento" ? buildMedicationName(inventoryItem) : inventoryItem.nombre,
    type: "viajeInventarioItem",
    updatedAt: now,
    updatedBy: userId,
    viajeId,
  };

  const initialQuantity = document.cantidadInicial ?? 0;
  const movementId = `inventarioMovimiento:${viajeId}:${randomUUID()}`;
  const docs: PouchDB.Core.PutDocument<TesisDocument>[] = [{ ...document, _id: itemId }];
  if (initialQuantity > 0) {
    docs.push({
      _id: movementId,
      cantidad: initialQuantity,
      createdAt: now,
      createdBy: userId,
      id: movementId,
      inventarioItemId: itemId,
      motivo: "Saldo inicial del inventario",
      tipo: "entrada",
      type: "inventarioMovimiento",
      viajeId,
    });
  }
  await db.bulkDocs(docs);

  return document;
}

export async function saveHistoriaReceta({
  historia,
  indicacionesGenerales,
  medicamentos,
  recetaId,
  userId,
}: {
  historia: { _id: string; pacienteId: string; viajeId?: string };
  indicacionesGenerales?: string;
  medicamentos: RecetaMedicamento[];
  recetaId?: string;
  userId: string;
}) {
  const existing = await getRecetaById(recetaId);
  const now = new Date().toISOString();
  const id = existing?._id ?? recetaId ?? `receta:${historia._id}:${randomUUID()}`;
  const receta: Receta = {
    createdAt: existing?.createdAt ?? now,
    createdBy: existing?.createdBy ?? userId,
    historiaId: historia._id,
    id,
    indicacionesGenerales: cleanText(indicacionesGenerales),
    medicamentos,
    pacienteId: historia.pacienteId,
    type: "receta",
    updatedAt: now,
    updatedBy: userId,
    viajeId: historia.viajeId,
  };

  await db.put({
    ...receta,
    ...(existing ? { _id: existing._id, _rev: existing._rev } : { _id: id }),
  });

  return receta;
}

export type RecetaRow = {
  id: string;
  createdAt: string;
  entregada: boolean;
  entregadaAt?: string;
  estado: "pendiente" | "parcial" | "entregada";
  historiaId: string;
  indicacionesGenerales?: string;
  medicamentos: Receta["medicamentos"];
  cantidadesEntregadas: number[];
  pacienteId: string;
  pacienteNombre: string;
};

type MovimientoDocument = PouchDB.Core.ExistingDocument<InventarioMovimiento>;
type DispensacionDocument = PouchDB.Core.ExistingDocument<DispensacionReceta>;

function isMovimiento(doc: unknown): doc is MovimientoDocument {
  return typeof doc === "object" && doc !== null && "type" in doc && doc.type === "inventarioMovimiento" && "_id" in doc;
}

function isDispensacion(doc: unknown): doc is DispensacionDocument {
  return typeof doc === "object" && doc !== null && "type" in doc && doc.type === "dispensacionReceta" && "_id" in doc;
}

export async function listInventarioMovimientos(viajeId: string) {
  await ensureTesisIndexes();
  const result = await findTesisDocs({
    limit: 2000,
    selector: { type: "inventarioMovimiento", viajeId },
    use_index: "idx_inventario_movimiento_viaje",
  });
  return result.docs.filter(isMovimiento).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function listRecetaDispensaciones(recetaId: string) {
  await ensureTesisIndexes();
  const result = await findTesisDocs({
    limit: 500,
    selector: { type: "dispensacionReceta", recetaId },
    use_index: "idx_dispensacion_receta",
  });
  return result.docs.filter(isDispensacion);
}

function deliveredByMedication(dispensaciones: DispensacionDocument[], count: number) {
  const totals = Array.from({ length: count }, () => 0);
  for (const dispensacion of dispensaciones) {
    for (const line of dispensacion.lineas) {
      if (line.recetaMedicamentoIndex < totals.length) totals[line.recetaMedicamentoIndex] += line.cantidad;
    }
  }
  return totals;
}

function recetaStatus(receta: RecetaDocument, delivered: number[]) {
  if (receta.entregada && delivered.every((quantity) => quantity === 0)) return "entregada" as const;
  const hasDelivery = delivered.some((quantity) => quantity > 0);
  const complete = receta.medicamentos.every((medicine, index) =>
    typeof medicine.cantidad === "number" && delivered[index] >= medicine.cantidad,
  );
  return complete ? "entregada" as const : hasDelivery ? "parcial" as const : "pendiente" as const;
}

export type RecetaPageResult = {
  hasNextPage: boolean;
  nextCursor?: string;
  rows: RecetaRow[];
};

type PacienteRecetaDocument = PouchDB.Core.ExistingDocument<{
  type: "paciente";
  datosPersonales: {
    apellidoMaterno?: string;
    apellidoPaterno?: string;
    nombres: string;
    numeroDocumentoIdentidad?: string;
  };
}>;

function isPaciente(doc: unknown): doc is PacienteRecetaDocument {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "paciente"
  );
}

function pacienteNombre(doc: PacienteRecetaDocument) {
  return [
    doc.datosPersonales.nombres,
    doc.datosPersonales.apellidoPaterno,
    doc.datosPersonales.apellidoMaterno,
  ].filter(Boolean).join(" ");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function findPacienteIds(query: string) {
  const safeQuery = escapeRegex(query.trim());
  if (!safeQuery) return undefined;

  const result = await findTesisDocs({
    limit: 100,
    selector: {
      $or: [
        { "datosPersonales.numeroDocumentoIdentidad": { $regex: safeQuery } },
        { "datosPersonales.nombres": { $regex: safeQuery } },
        { "datosPersonales.apellidoPaterno": { $regex: safeQuery } },
        { "datosPersonales.apellidoMaterno": { $regex: safeQuery } },
      ],
      type: "paciente",
    },
  });

  return result.docs.filter(isPaciente).map((doc) => doc._id);
}

async function getPacientesById(ids: string[]) {
  if (ids.length === 0) return new Map<string, string>();
  const result = await db.allDocs({ include_docs: true, keys: ids });

  return new Map(
    result.rows.flatMap((row) => {
      const doc = "doc" in row ? row.doc : undefined;
      return isPaciente(doc) ? [[doc._id, pacienteNombre(doc)] as const] : [];
    }),
  );
}

async function listDispensacionesForRecetas(recetaIds: string[]) {
  if (recetaIds.length === 0) return new Map<string, DispensacionDocument[]>();
  const result = await findTesisDocs({
    limit: 1000,
    selector: { recetaId: { $in: recetaIds }, type: "dispensacionReceta" },
    use_index: "idx_dispensacion_receta",
  });
  const grouped = new Map<string, DispensacionDocument[]>();
  for (const doc of result.docs.filter(isDispensacion)) {
    grouped.set(doc.recetaId, [...(grouped.get(doc.recetaId) ?? []), doc]);
  }
  return grouped;
}

export async function listViajeRecetasPage({
  bookmark,
  limit = 20,
  query = "",
  viajeId,
}: {
  bookmark?: string;
  limit?: number;
  query?: string;
  viajeId: string;
}): Promise<RecetaPageResult> {
  await ensureTesisIndexes();

  const pacienteIds = await findPacienteIds(query);
  if (pacienteIds?.length === 0) return { hasNextPage: false, rows: [] };

  const result = await findTesisDocs({
    bookmark,
    limit,
    selector: {
      ...(pacienteIds ? { pacienteId: { $in: pacienteIds } } : {}),
      type: "receta",
      viajeId,
    },
    sort: [{ createdAt: "desc" }],
    use_index: "idx_recetas_viaje_created",
  });

  const recetas = result.docs.filter(isReceta);
  const pacientes = await getPacientesById([...new Set(recetas.map((receta) => receta.pacienteId))]);
  const dispensaciones = await listDispensacionesForRecetas(recetas.map((receta) => receta._id));

  const rows = recetas.map((receta): RecetaRow => {
    const cantidadesEntregadas = deliveredByMedication(dispensaciones.get(receta._id) ?? [], receta.medicamentos.length);
    return {
      id: receta._id,
      createdAt: receta.createdAt,
      entregada: receta.entregada ?? false,
      entregadaAt: receta.entregadaAt,
      estado: recetaStatus(receta, cantidadesEntregadas),
      historiaId: receta.historiaId,
      indicacionesGenerales: receta.indicacionesGenerales,
      medicamentos: receta.medicamentos,
      cantidadesEntregadas,
      pacienteId: receta.pacienteId,
      pacienteNombre: pacientes.get(receta.pacienteId) ?? "Paciente desconocido",
    };
  });

  return {
    hasNextPage: recetas.length === limit && Boolean(result.bookmark),
    nextCursor: result.bookmark,
    rows,
  };
}

export async function listViajeRecetas(viajeId: string): Promise<RecetaRow[]> {
  return (await listViajeRecetasPage({ limit: 500, viajeId })).rows;
}

export async function dispensarReceta({ lineas, recetaId, userId, viajeId }: {
  lineas: DispensacionRecetaLinea[];
  recetaId: string;
  userId: string;
  viajeId: string;
}) {
  const receta = await db.get(recetaId).catch(() => null);
  if (!isReceta(receta) || receta.viajeId !== viajeId) throw new Error("Receta no encontrada en este viaje.");
  const previous = await listRecetaDispensaciones(recetaId);
  const delivered = deliveredByMedication(previous, receta.medicamentos.length);
  const itemIds = [...new Set(lineas.map((line) => line.inventarioItemId))];
  const inventoryDocs = await Promise.all(itemIds.map((id) => db.get(id).catch(() => null)));
  const inventory = new Map(inventoryDocs.filter(isInventarioItem).map((item) => [item._id, item]));
  const totalsByItem = new Map<string, number>();

  for (const line of lineas) {
    const medicine = receta.medicamentos[line.recetaMedicamentoIndex];
    const item = inventory.get(line.inventarioItemId);
    if (!medicine || !item || item.viajeId !== viajeId || item.categoria !== "medicamento") throw new Error("El lote seleccionado no pertenece a esta receta o viaje.");
    if ((item.condicion ?? "disponible") !== "disponible") throw new Error(`${item.nombre} no esta habilitado para dispensacion.`);
    if (item.fechaVencimiento && item.fechaVencimiento < getLaPazDateValue()) throw new Error(`${item.nombre} esta vencido.`);
    const prescribed = medicine.cantidad;
    if (!prescribed) throw new Error(`La receta no define cantidad para ${medicine.nombre}.`);
    const requestedForMedicine = lineas.filter((candidate) => candidate.recetaMedicamentoIndex === line.recetaMedicamentoIndex).reduce((sum, candidate) => sum + candidate.cantidad, 0);
    if (delivered[line.recetaMedicamentoIndex] + requestedForMedicine > prescribed) throw new Error(`La entrega supera la cantidad pendiente de ${medicine.nombre}.`);
    totalsByItem.set(item._id, (totalsByItem.get(item._id) ?? 0) + line.cantidad);
  }

  for (const [itemId, quantity] of totalsByItem) {
    const item = inventory.get(itemId)!;
    const available = item.cantidadDisponible ?? item.cantidadInicial ?? item.cantidadPlanificada;
    if (quantity > available) throw new Error(`Solo hay ${available} unidades disponibles de ${item.nombre}.`);
  }

  const now = new Date().toISOString();
  const dispensationId = `dispensacionReceta:${viajeId}:${randomUUID()}`;
  const docs: Array<Record<string, unknown>> = lineas.map((line) => {
    const movementId = `inventarioMovimiento:${viajeId}:${randomUUID()}`;
    return { _id: movementId, cantidad: -line.cantidad, createdAt: now, createdBy: userId, id: movementId, inventarioItemId: line.inventarioItemId, motivo: "Dispensacion de receta", recetaId, recetaMedicamentoIndex: line.recetaMedicamentoIndex, tipo: "dispensacion", type: "inventarioMovimiento", viajeId };
  });
  for (const [itemId, quantity] of totalsByItem) {
    const item = inventory.get(itemId)!;
    const current = item.cantidadDisponible ?? item.cantidadInicial ?? item.cantidadPlanificada;
    if (item.cantidadInicial === undefined) {
      const baselineId = `inventarioMovimiento:${viajeId}:${randomUUID()}`;
      docs.push({ _id: baselineId, cantidad: current, createdAt: now, createdBy: userId, id: baselineId, inventarioItemId: itemId, motivo: "Saldo inicial migrado", tipo: "entrada", type: "inventarioMovimiento", viajeId });
    }
    docs.push({ ...item, cantidadDisponible: current - quantity, cantidadInicial: item.cantidadInicial ?? current, updatedAt: now, updatedBy: userId });
  }
  docs.push({ _id: dispensationId, createdAt: now, createdBy: userId, id: dispensationId, lineas, recetaId, type: "dispensacionReceta", viajeId });
  const nextDelivered = [...delivered];
  for (const line of lineas) nextDelivered[line.recetaMedicamentoIndex] += line.cantidad;
  const nextStatus = recetaStatus(receta, nextDelivered);
  docs.push({ ...receta, entregada: nextStatus === "entregada", entregadaAt: nextStatus === "entregada" ? now : undefined, entregadaBy: nextStatus === "entregada" ? userId : undefined, updatedAt: now, updatedBy: userId });
  const results = await db.bulkDocs(docs as never[]);
  const failed = results.find((result) => "error" in result);
  if (failed) throw new Error("No se pudo completar la dispensacion por un conflicto de inventario.");
  return { estado: nextStatus };
}

export async function markRecetaEntregada({
  recetaId,
  userId,
}: {
  recetaId: string;
  userId: string;
}) {
  const doc = await db.get(recetaId).catch(() => null);

  if (!isReceta(doc)) {
    throw new Error("Receta no encontrada.");
  }

  const now = new Date().toISOString();

  await db.put({
    ...doc,
    entregada: true,
    entregadaAt: now,
    entregadaBy: userId,
    updatedAt: now,
    updatedBy: userId,
  });

  return { ...doc, entregada: true, entregadaAt: now };
}

export async function updateRecetaMedicamentos({
  indicacionesGenerales,
  medicamentos,
  recetaId,
  userId,
}: {
  indicacionesGenerales?: string;
  medicamentos: RecetaMedicamento[];
  recetaId: string;
  userId: string;
}) {
  const doc = await db.get(recetaId).catch(() => null);

  if (!isReceta(doc)) {
    throw new Error("Receta no encontrada.");
  }

  const now = new Date().toISOString();

  await db.put({
    ...doc,
    indicacionesGenerales: indicacionesGenerales?.trim() || undefined,
    medicamentos,
    updatedAt: now,
    updatedBy: userId,
  });
}

export async function updateViajeInventarioItem({
  itemId,
  updates,
  userId,
}: {
  itemId: string;
  updates: {
    cantidadDisponible?: number;
    condicion?: ViajeInventarioItem["condicion"];
    motivo?: string;
    tipo?: InventarioMovimiento["tipo"];
    nombre?: string;
    observaciones?: string;
  };
  userId: string;
}) {
  const doc = await db.get(itemId).catch(() => null);

  if (!isInventarioItem(doc)) {
    throw new Error("Item de inventario no encontrado.");
  }

  const now = new Date().toISOString();
  const previousQuantity = doc.cantidadDisponible ?? doc.cantidadInicial ?? doc.cantidadPlanificada;
  const nextQuantity = updates.cantidadDisponible ?? previousQuantity;
  const quantityDelta = nextQuantity - previousQuantity;
  const updatedDocument = {
    ...doc,
    cantidadInicial: doc.cantidadInicial ?? previousQuantity,
    ...(updates.cantidadDisponible !== undefined && {
      cantidadDisponible: updates.cantidadDisponible,
    }),
    ...(updates.nombre !== undefined && { nombre: updates.nombre }),
    ...(updates.condicion !== undefined && { condicion: updates.condicion }),
    ...(updates.observaciones !== undefined && {
      observaciones: updates.observaciones || undefined,
    }),
    updatedAt: now,
    updatedBy: userId,
  };
  const documents: Array<Record<string, unknown>> = [updatedDocument];
  if (doc.cantidadInicial === undefined) {
    const baselineId = `inventarioMovimiento:${doc.viajeId}:${randomUUID()}`;
    documents.push({ _id: baselineId, cantidad: previousQuantity, createdAt: now, createdBy: userId, id: baselineId, inventarioItemId: doc._id, motivo: "Saldo inicial migrado", tipo: "entrada", type: "inventarioMovimiento", viajeId: doc.viajeId });
  }
  if (quantityDelta !== 0 || (updates.condicion && updates.condicion !== doc.condicion)) {
    const movementId = `inventarioMovimiento:${doc.viajeId}:${randomUUID()}`;
    documents.push({ _id: movementId, cantidad: quantityDelta, createdAt: now, createdBy: userId, id: movementId, inventarioItemId: doc._id, motivo: updates.motivo?.trim() || "Ajuste de inventario", tipo: updates.tipo ?? "ajuste", type: "inventarioMovimiento", viajeId: doc.viajeId });
  }
  const results = await db.bulkDocs(documents as never[]);
  if (results.some((result) => "error" in result)) throw new Error("El inventario cambio mientras se guardaba. Recarga e intenta nuevamente.");
}

export async function deleteViajeInventarioItem({
  itemId,
  userId,
}: {
  itemId: string;
  userId: string;
}) {
  void userId;
  const doc = await db.get(itemId).catch(() => null);

  if (!isInventarioItem(doc)) {
    throw new Error("Item de inventario no encontrado.");
  }

  const movements = await findTesisDocs({ limit: 1, selector: { type: "inventarioMovimiento", inventarioItemId: itemId } });
  if (movements.docs.some(isMovimiento)) {
    throw new Error("No se puede eliminar un item con movimientos; cambia su condicion o ajusta su saldo.");
  }

  await db.remove(doc);
}

export type InsumoEntregaRow = {
  id: string;
  cantidad: number;
  createdAt: string;
  insumoId: string;
  insumoNombre: string;
  observaciones?: string;
  pacienteNombre?: string;
};

type InsumoEntregaDocument = PouchDB.Core.ExistingDocument<
  import("@/lib/schema").InsumoEntrega
>;

function isInsumoEntrega(doc: unknown): doc is InsumoEntregaDocument {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "insumoEntrega" &&
    "_id" in doc
  );
}

export async function listInsumoEntregas(viajeId: string): Promise<InsumoEntregaRow[]> {
  await ensureTesisIndexes();

  const result = await findTesisDocs({
    limit: 500,
    selector: {
      type: "insumoEntrega",
      viajeId,
    },
  });

  return result.docs
    .filter(isInsumoEntrega)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((doc) => ({
      id: doc._id,
      cantidad: doc.cantidad,
      createdAt: doc.createdAt,
      insumoId: doc.insumoId,
      insumoNombre: doc.insumoNombre,
      observaciones: doc.observaciones,
      pacienteNombre: doc.pacienteNombre,
    }));
}

export async function createInsumoEntrega({
  cantidad,
  insumoId,
  insumoNombre,
  observaciones,
  pacienteNombre,
  userId,
  viajeId,
}: {
  cantidad: number;
  insumoId: string;
  insumoNombre: string;
  observaciones?: string;
  pacienteNombre?: string;
  userId: string;
  viajeId: string;
}) {
  const now = new Date().toISOString();
  const id = `insumoEntrega:${viajeId}:${randomUUID()}`;

  const document: import("@/lib/schema").InsumoEntrega = {
    cantidad,
    createdAt: now,
    createdBy: userId,
    id,
    insumoId,
    insumoNombre,
    observaciones: observaciones?.trim() || undefined,
    pacienteNombre: pacienteNombre?.trim() || undefined,
    type: "insumoEntrega",
    viajeId,
  };

  const insumoDoc = await db.get(insumoId).catch(() => null);
  if (!isInventarioItem(insumoDoc) || insumoDoc.viajeId !== viajeId) {
    throw new Error("El insumo no pertenece a este viaje.");
  }
  const disponible = typeof insumoDoc.cantidadDisponible === "number"
    ? insumoDoc.cantidadDisponible
    : insumoDoc.cantidadPlanificada;
  if (cantidad > disponible) {
    throw new Error(`Solo hay ${disponible} unidades disponibles.`);
  }

  const movementId = `inventarioMovimiento:${viajeId}:${randomUUID()}`;
  const documents: PouchDB.Core.PutDocument<TesisDocument>[] = [
    { ...insumoDoc, cantidadDisponible: disponible - cantidad, cantidadInicial: insumoDoc.cantidadInicial ?? disponible, updatedAt: now, updatedBy: userId },
    { ...document, _id: id },
    { _id: movementId, cantidad: -cantidad, createdAt: now, createdBy: userId, id: movementId, inventarioItemId: insumoId, motivo: observaciones?.trim() || "Entrega de insumo", tipo: "entrega_insumo", type: "inventarioMovimiento", viajeId },
  ];
  if (insumoDoc.cantidadInicial === undefined) {
    const baselineId = `inventarioMovimiento:${viajeId}:${randomUUID()}`;
    documents.push({ _id: baselineId, cantidad: disponible, createdAt: now, createdBy: userId, id: baselineId, inventarioItemId: insumoId, motivo: "Saldo inicial migrado", tipo: "entrada", type: "inventarioMovimiento", viajeId });
  }
  const results = await db.bulkDocs(documents);
  if (results.some((result) => "error" in result)) throw new Error("No se pudo registrar la entrega por un conflicto de inventario.");

  return { id, createdAt: now };
}
