import { headers } from "next/headers";
import { z } from "zod";

import { logAgentUsage } from "@/lib/agent-usage";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  renderInvestigacionReportPdf,
  type InvestigacionReportArtifact,
  type InvestigacionReportSource,
} from "@/lib/reports/investigacion-report-pdf";
import {
  canAccessDataScience,
  getSessionUserRole,
} from "@/lib/role-redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  assistantMessageIndex: z.number().int().nonnegative(),
  conversationId: z.string().trim().min(1).max(300),
});

type StoredMessage = {
  artifacts?: unknown;
  content?: unknown;
  intent?: unknown;
  role?: unknown;
  scope?: unknown;
  sources?: unknown;
};

type StoredChat = {
  _id?: string;
  messages?: StoredMessage[];
  ownerId?: string;
  title?: string;
  type?: string;
};

const stationLabels: Record<string, string> = {
  anamnesis: "Anamnesis",
  diagnostico: "Diagnóstico",
  ecografia: "Ecografía",
  electrocardiograma: "Electrocardiograma",
  espirometria: "Espirometría",
  "examen-fisico-general": "Examen físico general",
  "examen-fisico-segmentario": "Examen físico segmentario",
  laboratorios: "Laboratorios",
};

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return Response.json({ message: "No autenticado." }, { status: 401 });
  }

  const role = getSessionUserRole(session.user);
  if (!canAccessDataScience(role)) {
    return Response.json({ message: "No autorizado." }, { status: 403 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ message: "Solicitud de reporte inválida." }, { status: 400 });
  }

  const startedAt = Date.now();
  const createdAt = new Date(startedAt).toISOString();
  const { assistantMessageIndex, conversationId } = parsed.data;
  let chat: StoredChat;

  try {
    chat = (await db.get(conversationId)) as unknown as StoredChat;
  } catch {
    return Response.json({ message: "Conversación no encontrada." }, { status: 404 });
  }

  if (
    chat.type !== "investigacion_chat" ||
    chat.ownerId !== session.user.id ||
    !Array.isArray(chat.messages)
  ) {
    return Response.json({ message: "Conversación no encontrada." }, { status: 404 });
  }

  const assistantMessage = chat.messages[assistantMessageIndex];
  if (assistantMessage?.role !== "assistant") {
    return Response.json({ message: "Respuesta no encontrada." }, { status: 404 });
  }

  const questionMessage = findPreviousUserMessage(
    chat.messages,
    assistantMessageIndex,
  );
  const artifacts = toArtifacts(assistantMessage.artifacts);
  const sources = toSources(assistantMessage.sources);
  const scopeLabel = await resolveScopeLabel(assistantMessage.scope);
  const title = makeReportTitle(
    String(questionMessage?.content ?? chat.title ?? "Reporte de investigación"),
  );

  try {
    const pdf = await renderInvestigacionReportPdf({
      answer: String(assistantMessage.content ?? ""),
      artifacts,
      generatedAt: new Date(),
      question: String(questionMessage?.content ?? ""),
      requestedBy: session.user.name || session.user.email,
      requestedRole: role,
      scopeLabel,
      sources,
      title,
    });

    await logAgentUsage({
      action: "pdf_generated",
      actorId: session.user.id,
      actorRole: role,
      artifactCount: artifacts.length,
      conversationId,
      createdAt,
      durationMs: Date.now() - startedAt,
      intent:
        typeof assistantMessage.intent === "string"
          ? assistantMessage.intent
          : undefined,
      messageIndex: assistantMessageIndex,
      scope: assistantMessage.scope,
      sourceCount: sources.length,
      status: "succeeded",
      tools: ["render_investigation_pdf"],
    });

    return new Response(pdf, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${safeFilePart(title)}-${new Date()
          .toISOString()
          .slice(0, 10)}.pdf"`,
        "Content-Type": "application/pdf",
      },
    });
  } catch (error) {
    await logAgentUsage({
      action: "pdf_generated",
      actorId: session.user.id,
      actorRole: role,
      artifactCount: artifacts.length,
      conversationId,
      createdAt,
      durationMs: Date.now() - startedAt,
      errorCode: "pdf_generation_failed",
      messageIndex: assistantMessageIndex,
      scope: assistantMessage.scope,
      sourceCount: sources.length,
      status: "failed",
      tools: [{ name: "render_investigation_pdf", status: "failed" }],
    });

    console.error("[investigacion-report] generación fallida", {
      conversationId,
      error: error instanceof Error ? error.name : "unknown",
    });
    return Response.json(
      { message: "No se pudo generar el reporte PDF." },
      { status: 500 },
    );
  }
}

function findPreviousUserMessage(messages: StoredMessage[], fromIndex: number) {
  for (let index = fromIndex - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") return messages[index];
  }
  return undefined;
}

function toArtifacts(value: unknown): InvestigacionReportArtifact[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.title !== "string" || typeof item.type !== "string") {
      return [];
    }
    const spec = isRecord(item.spec) ? item.spec : undefined;
    return [
      {
        data: item.data,
        spec: spec
          ? {
              description: stringValue(spec.description),
              group: stringValue(spec.group),
              kind: stringValue(spec.kind),
              series: stringValue(spec.series),
              x: stringValue(spec.x),
              y: stringValue(spec.y),
            }
          : undefined,
        title: item.title,
        type: item.type,
      },
    ];
  });
}

function toSources(value: unknown): InvestigacionReportSource[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.title !== "string") return [];
    return [
      {
        documentType: stringValue(item.document_type),
        score: typeof item.score === "number" ? item.score : undefined,
        title: item.title,
      },
    ];
  });
}

async function resolveScopeLabel(value: unknown) {
  if (!isRecord(value)) return "Alcance no disponible";

  const stationKey = stringValue(value.stationKey);
  const rawIds = Array.isArray(value.viajeIds)
    ? value.viajeIds
    : stringValue(value.viajeId)
      ? [value.viajeId]
      : [];
  const ids = rawIds.filter((item): item is string => typeof item === "string");
  const station = stationKey
    ? stationLabels[stationKey] ?? stationKey
    : "Todas las estaciones";

  if (!ids.length) return `Todos los viajes · ${station}`;

  const labels = await Promise.all(
    ids.map(async (id) => {
      try {
        const document = (await db.get(id)) as unknown;
        if (
          isRecord(document) &&
          document.type === "viaje" &&
          typeof document.servicio === "string"
        ) {
          const establishment = isRecord(document.establecimiento)
            ? stringValue(document.establecimiento.nombre)
            : undefined;
          return establishment
            ? `${document.servicio} / ${establishment}`
            : document.servicio;
        }
      } catch {
        // El identificador sigue permitiendo describir el filtro si el viaje ya no existe.
      }
      return id;
    }),
  );

  return `${labels.join(", ")} · ${station}`;
}

function makeReportTitle(question: string) {
  const normalized = question.replace(/\s+/g, " ").trim();
  if (!normalized) return "Reporte de investigación";
  return normalized.length > 96 ? `${normalized.slice(0, 95)}…` : normalized;
}

function safeFilePart(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "reporte-investigacion"
  );
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
