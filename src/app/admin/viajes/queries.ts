import "server-only";

import { db } from "@/lib/db";
import { findTesisDocs } from "@/lib/db-find";
import { ensureTesisIndexes } from "@/lib/db-indexes";
import { getAuthUsersByIds, type AuthUserListItem } from "@/lib/auth-users";
import type { Viaje } from "@/lib/schema/viajes";

export type ViajeStationListItem = Viaje["estaciones"][number] & {
  docenteEncargado?: AuthUserListItem;
  estudiantes: AuthUserListItem[];
  estudiantesNoEncontrados: string[];
};

export type ViajeListItem = Omit<Viaje, "estaciones"> & {
  docId: string;
  estaciones: ViajeStationListItem[];
  resumenEquipo: {
    docentesAsignados: number;
    estudiantesAsignados: number;
    usuariosNoEncontrados: string[];
  };
};

type ViajeDocument = PouchDB.Core.ExistingDocument<Viaje>;

type ViajeFilters = {
  fechaDesde?: string;
  fechaHasta?: string;
  lugar?: string;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseDate(value?: string) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function isViaje(doc: unknown): doc is ViajeDocument {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "type" in doc &&
    doc.type === "viaje"
  );
}

function matchesLugar(viaje: Viaje, lugar?: string) {
  if (!lugar?.trim()) {
    return true;
  }

  const searchable = normalize(
    [
      viaje.establecimiento.nombre,
      viaje.establecimiento.direccion,
      viaje.establecimiento.contacto,
      viaje.servicio,
    ]
      .filter(Boolean)
      .join(" "),
  );

  return searchable.includes(normalize(lugar));
}

function matchesDateRange(viaje: Viaje, filters: ViajeFilters) {
  const filterStart = parseDate(filters.fechaDesde);
  const filterEnd = parseDate(filters.fechaHasta);

  if (!filterStart && !filterEnd) {
    return true;
  }

  const tripStart = parseDate(viaje.fechaEntrada);
  const tripEnd = parseDate(viaje.fechaSalida);

  if (!tripStart || !tripEnd) {
    return false;
  }

  if (filterStart && tripEnd < filterStart) {
    return false;
  }

  if (filterEnd && tripStart > filterEnd) {
    return false;
  }

  return true;
}

function getAssignedUserIds(viajes: Viaje[]) {
  return viajes.flatMap((viaje) =>
    viaje.estaciones.flatMap((estacion) => [
      estacion.docenteEncargadoId,
      ...estacion.estudiantesIds,
    ]),
  );
}

function hydrateViajesUsers(viajes: (Viaje & { docId: string })[]) {
  const usersById = getAuthUsersByIds(getAssignedUserIds(viajes));

  return viajes.map((viaje): ViajeListItem => {
    const estaciones = viaje.estaciones.map((estacion) => {
      const docenteEncargado = usersById.get(estacion.docenteEncargadoId);
      const estudiantes = estacion.estudiantesIds
        .map((studentId) => usersById.get(studentId))
        .filter((student): student is AuthUserListItem => Boolean(student));
      const estudiantesNoEncontrados = estacion.estudiantesIds.filter(
        (studentId) => !usersById.has(studentId),
      );

      return {
        ...estacion,
        docenteEncargado,
        estudiantes,
        estudiantesNoEncontrados,
      };
    });
    const usuariosNoEncontrados = [
      ...new Set(
        estaciones.flatMap((estacion) => [
          ...(estacion.docenteEncargado ? [] : [estacion.docenteEncargadoId]),
          ...estacion.estudiantesNoEncontrados,
        ]),
      ),
    ];

    return {
      ...viaje,
      estaciones,
      resumenEquipo: {
        docentesAsignados: new Set(
          estaciones
            .map((estacion) => estacion.docenteEncargado?.id)
            .filter(Boolean),
        ).size,
        estudiantesAsignados: new Set(
          estaciones.flatMap((estacion) =>
            estacion.estudiantes.map((student) => student.id),
          ),
        ).size,
        usuariosNoEncontrados,
      },
    };
  });
}

export async function listViajes(
  filters: ViajeFilters,
): Promise<ViajeListItem[]> {
  await ensureTesisIndexes();

  const selector: Record<string, unknown> = {
    type: "viaje",
  };
  const filterStart = filters.fechaDesde?.trim();
  const filterEnd = filters.fechaHasta?.trim();

  if (filterStart) {
    selector.fechaSalida = { $gte: filterStart };
  }

  if (filterEnd) {
    selector.fechaEntrada = { $lte: filterEnd };
  }

  const result = await findTesisDocs({
    limit: 500,
    selector,
  });
  const viajes: (Viaje & { docId: string })[] = result.docs.filter(isViaje).map((doc) => ({
      ...doc,
      docId: doc._id ?? doc.id,
    }));

  const filteredViajes = viajes
    .filter((viaje) => matchesLugar(viaje, filters.lugar))
    .filter((viaje) => matchesDateRange(viaje, filters))
    .sort((a, b) => a.fechaEntrada.localeCompare(b.fechaEntrada));

  return hydrateViajesUsers(filteredViajes);
}

export async function getViajeByDocId(id: string): Promise<ViajeListItem | null> {
  try {
    const doc = (await db.get(id)) as ViajeDocument;

    if (!isViaje(doc)) {
      return null;
    }

    const [viaje] = hydrateViajesUsers([
      {
        ...doc,
        docId: doc._id ?? doc.id,
      },
    ]);

    return viaje;
  } catch {
    return null;
  }
}
