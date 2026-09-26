import { getAuthenticatedUserId } from "@/lib/auth-session";
import { getFarmaciaPlanningTrip } from "@/lib/farmacia";
import { searchMedicamentoCatalogo } from "@/lib/farmacia-catalogo";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return Response.json({ error: "Sesión requerida." }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const mode = params.get("mode");
  const query = params.get("q") ?? "";
  const rawOffset = params.get("offset") ?? "0";
  const offset = Number(rawOffset);
  if ((mode !== "docente" && mode !== "estudiante") || query.length > 120 || !/^\d+$/.test(rawOffset) || !Number.isSafeInteger(offset)) {
    return Response.json({ error: "Búsqueda inválida." }, { status: 400 });
  }
  const trip = await getFarmaciaPlanningTrip({ mode, userId });
  if (!trip) return Response.json({ error: "Sin acceso a Farmacia." }, { status: 403 });
  try {
    return Response.json(await searchMedicamentoCatalogo(query, offset), { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "No se pudo consultar el catálogo." }, { status: 503 });
  }
}
