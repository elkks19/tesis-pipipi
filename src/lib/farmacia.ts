import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { findTesisDocs } from "@/lib/db-find";
import { ensureTesisIndexes } from "@/lib/db-indexes";
import { db } from "@/lib/db";
import type {
  MedicamentoCatalogo,
  Receta,
  RecetaMedicamento,
  Viaje,
  ViajeInventarioItem,
} from "@/lib/schema";
import {
  resolveDocenteTripRoute,
  resolveStudentTripRoute,
} from "@/lib/student-trip-resolution";

type ViajeDocument = PouchDB.Core.ExistingDocument<Viaje>;
type InventarioDocument = PouchDB.Core.ExistingDocument<ViajeInventarioItem>;
type CatalogoDocument = PouchDB.Core.ExistingDocument<MedicamentoCatalogo>;
type RecetaDocument = PouchDB.Core.ExistingDocument<Receta>;

export type FarmaciaAccessMode = "docente" | "estudiante";

export type FarmaciaPlanningTrip = {
  active: boolean;
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

  const resolution =
    mode === "docente"
      ? await resolveDocenteTripRoute(userId)
      : await resolveStudentTripRoute(userId);

  if (resolution.activeTrip?.estacionTipo === "Farmacia") {
    return { ...resolution.activeTrip, active: true };
  }

  const futureTrip = resolution.futureTrips?.find(
    (trip) => trip.estacionTipo === "Farmacia",
  );

  return futureTrip ? { ...futureTrip, active: false } : null;
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

  return result.docs.filter(isInventarioItem).sort(sortInventario);
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
    limit: 250,
    selector: {
      fuente: "agemed",
      type: "medicamentoCatalogo",
    },
    use_index: "idx_medicamento_catalogo_fuente",
  });

  return result.docs
    .filter(isCatalogo)
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

  if (item.categoria === "medicamento" && item.principioActivo) {
    catalogoId = catalogoId ?? buildMedicationCatalogId(item);
    const catalogDoc = await db.get(catalogoId).catch(() => null);
    const catalogPayload: MedicamentoCatalogo = {
      atcCode: cleanText(item.atcCode),
      concentracion: cleanText(item.concentracion),
      createdAt: isCatalogo(catalogDoc) ? catalogDoc.createdAt : now,
      createdBy: isCatalogo(catalogDoc) ? catalogDoc.createdBy : userId,
      formaFarmaceutica: cleanText(item.formaFarmaceutica),
      fuente: item.fuente ?? "agemed",
      id: catalogoId,
      laboratorio: cleanText(item.laboratorio),
      nombreComercial: cleanText(item.nombreComercial),
      principioActivo: item.principioActivo,
      registroSanitario: cleanText(item.registroSanitario),
      titularRegistro: cleanText(item.titularRegistro),
      type: "medicamentoCatalogo",
      updatedAt: now,
      updatedBy: userId,
      viaAdministracion: cleanText(item.viaAdministracion),
    };

    await db.put({
      ...catalogPayload,
      ...(isCatalogo(catalogDoc) ? { _id: catalogDoc._id, _rev: catalogDoc._rev } : { _id: catalogoId }),
    });
  }

  const itemId = `viajeInventarioItem:${viajeId}:${randomUUID()}`;
  const document: ViajeInventarioItem = {
    ...item,
    catalogoId,
    createdAt: now,
    createdBy: userId,
    id: itemId,
    nombre: item.categoria === "medicamento" ? buildMedicationName(item) : item.nombre,
    type: "viajeInventarioItem",
    updatedAt: now,
    updatedBy: userId,
    viajeId,
  };

  await db.put({
    ...document,
    _id: itemId,
  });

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
  historiaId: string;
  indicacionesGenerales?: string;
  medicamentos: Receta["medicamentos"];
  pacienteId: string;
  pacienteNombre: string;
};

export type RecetaPageResult = {
  hasNextPage: boolean;
  nextCursor?: string;
  rows: RecetaRow[];
};

function isPaciente(doc: unknown): doc is PouchDB.Core.ExistingDocument<{ type: "paciente"; datosPersonales: { nombres: string; apellidoPaterno: string; apellidoMaterno: string } }> {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "paciente"
  );
}

async function getPacienteNombre(pacienteId: string): Promise<string> {
  try {
    const doc = await db.get(pacienteId);
    if (isPaciente(doc)) {
      const datos = doc.datosPersonales;
      return [datos.nombres, datos.apellidoPaterno, datos.apellidoMaterno]
        .filter(Boolean)
        .join(" ");
    }
  } catch {
    // Patient not found
  }
  return "Paciente desconocido";
}

export async function listViajeRecetas(viajeId: string): Promise<RecetaRow[]> {
  await ensureTesisIndexes();

  const result = await findTesisDocs({
    limit: 500,
    selector: {
      type: "receta",
      viajeId,
    },
  });

  const recetas = result.docs.filter(isReceta);
  const rows: RecetaRow[] = [];

  for (const receta of recetas) {
    const pacienteNombre = await getPacienteNombre(receta.pacienteId);
    rows.push({
      id: receta._id,
      createdAt: receta.createdAt,
      entregada: receta.entregada ?? false,
      entregadaAt: receta.entregadaAt,
      historiaId: receta.historiaId,
      indicacionesGenerales: receta.indicacionesGenerales,
      medicamentos: receta.medicamentos,
      pacienteId: receta.pacienteId,
      pacienteNombre,
    });
  }

  return rows.sort((a, b) => {
    if (a.entregada !== b.entregada) return a.entregada ? 1 : -1;
    return b.createdAt.localeCompare(a.createdAt);
  });
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

  await db.put({
    ...doc,
    ...(updates.cantidadDisponible !== undefined && {
      cantidadDisponible: updates.cantidadDisponible,
    }),
    ...(updates.nombre !== undefined && { nombre: updates.nombre }),
    ...(updates.observaciones !== undefined && {
      observaciones: updates.observaciones || undefined,
    }),
    updatedAt: now,
    updatedBy: userId,
  });
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

  await db.put({
    ...insumoDoc,
    cantidadDisponible: disponible - cantidad,
    updatedAt: now,
    updatedBy: userId,
  });
  await db.put({ ...document, _id: id });

  return { id, createdAt: now };
}
