import type { User } from "better-auth";

import { resolveStudentTripRoute as resolveStudentTripRouteByUserId } from "@/lib/student-trip-resolution";

export type {
  ActiveStudentTrip,
  FutureStudentTrip,
  StudentTripResolution,
} from "@/lib/student-trip-resolution";

export async function resolveStudentTripRoute(user: User | undefined) {
  return resolveStudentTripRouteByUserId(user?.id);
}
