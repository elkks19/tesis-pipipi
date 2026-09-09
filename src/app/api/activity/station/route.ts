import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { listActivity } from "@/lib/activity-queries";
import {
  canAccessDocente,
  canAccessEstudiante,
  getSessionUserRole,
} from "@/lib/role-redirect";
import type { StationKey } from "@/lib/station-histories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stationKeys = [
  "anamnesis",
  "diagnostico",
  "ecografia",
  "electrocardiograma",
  "espirometria",
  "examenFisicoGeneral",
  "examenFisicoSegmentario",
  "farmacia",
  "laboratorios",
] as const satisfies readonly StationKey[];

function isStationKey(value: string | null): value is StationKey {
  return stationKeys.includes(value as StationKey);
}

function isActivityMode(value: string | null): value is "docente" | "estudiante" {
  return value === "docente" || value === "estudiante";
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return Response.json({ message: "No autenticado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const mode = url.searchParams.get("mode");
  const stationKey = url.searchParams.get("stationKey");

  if (!isActivityMode(mode) || !isStationKey(stationKey)) {
    return Response.json({ message: "Parametros invalidos." }, { status: 400 });
  }

  const role = getSessionUserRole(session.user);

  if (
    (mode === "estudiante" && !canAccessEstudiante(role)) ||
    (mode === "docente" && !canAccessDocente(role))
  ) {
    return Response.json({ message: "No autorizado." }, { status: 403 });
  }

  const page = await listActivity({
    cursor,
    mode,
    stationKey,
    userId: session.user.id,
  });

  return Response.json(page, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
