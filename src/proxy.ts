import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import {
  canAccessAdmin,
  canAccessDocente,
  canAccessEstudiante,
  getRoleHomePath,
  getSessionUserRole,
} from "@/lib/role-redirect";
import {
  resolveDocenteTripRoute,
  resolveStudentTripRoute,
  type StudentTripResolution,
} from "@/lib/student-trip-resolution";

function getLoginUrl(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  return loginUrl;
}

function getSafeNextPath(request: NextRequest, fallbackPath: string) {
  const next = request.nextUrl.searchParams.get("next");

  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return fallbackPath;
  }

  return next;
}

async function getRoleStartPath(userId: string, roleHomePath: string) {
  if (roleHomePath === "/estudiante") {
    const resolution = await resolveStudentTripRoute(userId).catch(
      (): StudentTripResolution => ({}),
    );

    return resolution.redirectTo ?? roleHomePath;
  }

  if (roleHomePath === "/docente") {
    const resolution = await resolveDocenteTripRoute(userId).catch(
      (): StudentTripResolution => ({}),
    );

    return resolution.redirectTo ?? roleHomePath;
  }

  return roleHomePath;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (pathname === "/login" || pathname === "/register") {
    if (!session) {
      return NextResponse.next();
    }

    const roleHomePath = getRoleHomePath(getSessionUserRole(session.user));
    const startPath = await getRoleStartPath(session.user.id, roleHomePath);

    return NextResponse.redirect(
      new URL(getSafeNextPath(request, startPath), request.url),
    );
  }

  if (!session) {
    return NextResponse.redirect(getLoginUrl(request));
  }

  const role = getSessionUserRole(session.user);
  const roleHomePath = getRoleHomePath(role);
  const startPath = await getRoleStartPath(session.user.id, roleHomePath);

  if (pathname === "/") {
    return NextResponse.redirect(new URL(startPath, request.url));
  }

  if (pathname === "/admin" && !canAccessAdmin(role)) {
    return NextResponse.redirect(new URL(startPath, request.url));
  }

  if (pathname === "/docente" && !canAccessDocente(role)) {
    return NextResponse.redirect(new URL(startPath, request.url));
  }

  if (pathname === "/estudiante" && !canAccessEstudiante(role)) {
    return NextResponse.redirect(new URL(startPath, request.url));
  }

  if (
    (pathname === "/docente" || pathname === "/estudiante") &&
    startPath !== pathname
  ) {
    return NextResponse.redirect(new URL(startPath, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/admin", "/docente", "/estudiante", "/login", "/register"],
};
