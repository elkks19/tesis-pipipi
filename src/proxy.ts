import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  resolveDocenteTripRoute,
  resolveStudentTripRoute,
  type StudentTripResolution,
} from "@/lib/student-trip-resolution";
import {
  canAccessAdmin,
  canAccessDocente,
  canAccessEstudiante,
  getRoleHomePath,
  getSessionUserRole,
} from "@/lib/role-redirect";

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

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (pathname === "/login" || pathname === "/register") {
    if (session) {
      const roleHomePath = getRoleHomePath(getSessionUserRole(session.user));

      return NextResponse.redirect(
        new URL(getSafeNextPath(request, roleHomePath), request.url),
      );
    }

    return NextResponse.next();
  }

  if (!session) {
    return NextResponse.redirect(getLoginUrl(request));
  }

  const role = getSessionUserRole(session.user);
  const roleHomePath = getRoleHomePath(role);

  if (pathname === "/") {
    return NextResponse.redirect(new URL(roleHomePath, request.url));
  }

  if (pathname.startsWith("/admin") && !canAccessAdmin(role)) {
    return NextResponse.redirect(new URL(roleHomePath, request.url));
  }

  if (pathname.startsWith("/docente") && !canAccessDocente(role)) {
    return NextResponse.redirect(new URL(roleHomePath, request.url));
  }

  if (pathname.startsWith("/estudiante") && !canAccessEstudiante(role)) {
    return NextResponse.redirect(new URL(roleHomePath, request.url));
  }

  if (pathname.startsWith("/estudiante/")) {
    const resolution = await resolveStudentTripRoute(session.user.id).catch(
      (): StudentTripResolution => ({}),
    );
    const basePath = resolution.activeTrip?.basePath;

    if (!basePath) {
      return NextResponse.redirect(new URL("/estudiante", request.url));
    }

    if (pathname !== basePath && !pathname.startsWith(`${basePath}/`)) {
      return NextResponse.redirect(
        new URL(resolution.redirectTo ?? "/estudiante", request.url),
      );
    }
  }

  if (pathname.startsWith("/docente/")) {
    const resolution = await resolveDocenteTripRoute(session.user.id).catch(
      (): StudentTripResolution => ({}),
    );
    const basePath = resolution.activeTrip?.basePath;

    if (!basePath) {
      return NextResponse.redirect(new URL("/docente", request.url));
    }

    if (pathname !== basePath && !pathname.startsWith(`${basePath}/`)) {
      return NextResponse.redirect(
        new URL(resolution.redirectTo ?? "/docente", request.url),
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/admin/:path*",
    "/docente",
    "/docente/:path*",
    "/estudiante",
    "/estudiante/:path*",
    "/login",
    "/register",
  ],
};
