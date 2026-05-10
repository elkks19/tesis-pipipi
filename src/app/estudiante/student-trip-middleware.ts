import type { User } from "better-auth";

export type StudentTripResolution = {
  redirectTo?: string;
};

export async function resolveStudentTripRoute(
  user: User | undefined,
): Promise<StudentTripResolution> {
  void user;

  // TODO: validar viajes activos/futuros cuando exista la pantalla de viajes.
  // El flujo esperado:
  // 1. Buscar documentos type="viaje" donde el usuario este en una estacion.
  // 2. Verificar fechaEntrada y fechaSalida.
  // 3. Si hoy esta dentro del rango, redirigir a la estacion asignada.
  // 4. Si el viaje es futuro, mostrar estado de preparacion.
  return {};
}
