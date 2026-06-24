import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { findTesisDocs } from "@/lib/db-find";
import { ensureTesisIndexes } from "@/lib/db-indexes";
import { db } from "@/lib/db";
import type {
  MedicamentoCatalogo,
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

export type FarmaciaAccessMode = "docente" | "estudiante";

export type FarmaciaPlanningTrip = {
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
    return resolution.activeTrip;
  }

  return (
    resolution.futureTrips?.find((trip) => trip.estacionTipo === "Farmacia") ??
    null
  );
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
