import { headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import {
  canAccessDataScience,
  getSessionUserRole,
} from "@/lib/role-redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DataScienceRouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

const DATA_SCIENCE_API_URL =
  process.env.DATA_SCIENCE_API_URL ?? "http://localhost:8000";
const DATA_SCIENCE_INTERNAL_TOKEN =
  process.env.DATA_SCIENCE_INTERNAL_TOKEN ?? process.env.DS_INTERNAL_TOKEN;

export async function GET(
  request: NextRequest,
  context: DataScienceRouteContext,
) {
  return proxyDataScienceRequest(request, context);
}

export async function POST(
  request: NextRequest,
  context: DataScienceRouteContext,
) {
  return proxyDataScienceRequest(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: DataScienceRouteContext,
) {
  return proxyDataScienceRequest(request, context);
}

async function proxyDataScienceRequest(
  request: NextRequest,
  context: DataScienceRouteContext,
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ detail: "No autenticado." }, { status: 401 });
  }

  const role = getSessionUserRole(session.user);
  if (!canAccessDataScience(role)) {
    return NextResponse.json({ detail: "No autorizado." }, { status: 403 });
  }

  const { path } = await context.params;
  const pathname = path.join("/");
  const targetUrl = new URL(pathname, ensureTrailingSlash(DATA_SCIENCE_API_URL));
  targetUrl.search = request.nextUrl.search;
  if (pathname === "chats" || pathname.startsWith("chats/")) {
    targetUrl.searchParams.set("ownerId", session.user.id);
  }

  const init: RequestInit = {
    headers: buildHeaders(),
    method: request.method,
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    const rawBody = await request.text();
    init.body =
      pathname === "chat" || pathname === "reports"
        ? JSON.stringify(mergeSessionScope(rawBody, session.user, role))
        : rawBody;
  }

  try {
    const response = await fetch(targetUrl, init);
    const contentType = response.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    return NextResponse.json(body, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        detail:
          error instanceof Error
            ? error.message
            : "No se pudo conectar con el asistente de investigacion.",
      },
      { status: 502 },
    );
  }
}

function buildHeaders() {
  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json",
  });

  if (DATA_SCIENCE_INTERNAL_TOKEN) {
    headers.set("Authorization", `Bearer ${DATA_SCIENCE_INTERNAL_TOKEN}`);
  }

  return headers;
}

function mergeSessionScope(
  rawBody: string,
  user: { id: string; role?: string | null },
  role: ReturnType<typeof getSessionUserRole>,
) {
  const body = rawBody ? JSON.parse(rawBody) : {};
  const scope = body.scope ?? {};

  return {
    ...body,
    scope: {
      ...scope,
      role,
      userId: user.id,
    },
  };
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}
