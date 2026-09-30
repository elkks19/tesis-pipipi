import "server-only";

import { getAuthUsersByIds } from "@/lib/auth-users";
import { findTesisDocs } from "@/lib/db-find";
import { ensureTesisIndexes } from "@/lib/db-indexes";
import type { RegistrationAuthor } from "@/lib/registration-author";
import type { Actividad } from "@/lib/schema/actividad";

// Call with patient IDs from an already authorized patient list.
export async function getPatientRegistrationAuthors(patientIds: string[]) {
  const ids = [...new Set(patientIds.filter(Boolean))];
  const registrations = new Map<string, Actividad>();
  const authors = new Map<string, RegistrationAuthor>();
  if (!ids.length) return authors;
  await ensureTesisIndexes();

  for (let skip = 0; ; skip += 100) {
    const result = await findTesisDocs({
      limit: 100, skip,
      selector: { type: "actividad", subject: "paciente", action: "created", pacienteId: { $in: ids } },
    });
    for (const doc of result.docs) {
      const activity = doc as unknown as Actividad;
      const previous = registrations.get(activity.pacienteId);
      if (!previous || activity.createdAt < previous.createdAt) registrations.set(activity.pacienteId, activity);
    }
    if (result.docs.length < 100) break;
  }

  const users = getAuthUsersByIds([...registrations.values()].map((activity) => activity.actorId));
  for (const [id, activity] of registrations) {
    const user = users.get(activity.actorId);
    authors.set(id, user ? { name: user.name, email: user.email, role: user.role }
      : { name: "Usuario no encontrado" });
  }
  return authors;
}
