import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";

const defaultAuthenticatedPath = "/estudiante/anamnesis/create-historia";

function getLoginUrl(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  return loginUrl;
}

function getSafeNextPath(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next");

  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return defaultAuthenticatedPath;
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
      return NextResponse.redirect(new URL(getSafeNextPath(request), request.url));
    }

    return NextResponse.next();
  }

  if (!session) {
    return NextResponse.redirect(getLoginUrl(request));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/estudiante/:path*", "/login", "/register"],
};
