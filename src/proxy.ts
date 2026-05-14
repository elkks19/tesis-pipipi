import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import {
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

function isInsideBasePath(pathname: string, basePath: string) {
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

async function getStudentResolution(userId: string) {
  return resolveStudentTripRoute(userId).catch(
    (): StudentTripResolution => ({}),
  );
}

async function getDocenteResolution(userId: string) {
  return resolveDocenteTripRoute(userId).catch(
    (): StudentTripResolution => ({}),
  );
}

function redirectTo(path: string, request: NextRequest) {
  return NextResponse.redirect(new URL(path, request.url));
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
    return redirectTo(startPath, request);
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (roleHomePath !== "/admin") {
      return redirectTo(startPath, request);
    }

    return NextResponse.next();
  }

  if (pathname === "/estudiante" || pathname.startsWith("/estudiante/")) {
    if (roleHomePath !== "/estudiante") {
      return redirectTo(startPath, request);
    }

    const resolution = await getStudentResolution(session.user.id);
    const activeTrip = resolution.activeTrip;

    if (!activeTrip) {
      return pathname === "/estudiante"
        ? NextResponse.next()
        : redirectTo("/estudiante", request);
    }

    if (pathname === "/estudiante") {
      return redirectTo(resolution.redirectTo ?? "/estudiante", request);
    }

    if (
      activeTrip.basePath &&
      isInsideBasePath(pathname, activeTrip.basePath)
    ) {
      return NextResponse.next();
    }

    return redirectTo(resolution.redirectTo ?? "/estudiante", request);
  }

  if (pathname === "/docente" || pathname.startsWith("/docente/")) {
    if (roleHomePath !== "/docente") {
      return redirectTo(startPath, request);
    }

    const resolution = await getDocenteResolution(session.user.id);
    const activeTrip = resolution.activeTrip;

    if (!activeTrip) {
      return pathname === "/docente"
        ? NextResponse.next()
        : redirectTo("/docente", request);
    }

    if (pathname === "/docente") {
      return redirectTo(resolution.redirectTo ?? "/docente", request);
    }

    if (
      activeTrip.basePath &&
      isInsideBasePath(pathname, activeTrip.basePath)
    ) {
      return NextResponse.next();
    }

    return redirectTo(resolution.redirectTo ?? "/docente", request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/admin",
    "/admin/:path*",
    "/docente",
    "/docente/:path*",
    "/estudiante",
    "/estudiante/:path*",
    "/login",
    "/register",
  ],
};
