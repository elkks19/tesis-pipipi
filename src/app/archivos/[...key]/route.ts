import { Readable } from "node:stream";

import { getFileStream } from "@/lib/file-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getContentType(key: string) {
  const extension = key.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      key: string[];
    }>;
  },
) {
  const { key } = await context.params;
  const fileKey = key.map((part) => decodeURIComponent(part)).join("/");

  if (!fileKey) {
    return Response.json({ message: "Archivo no encontrado." }, { status: 404 });
  }

  try {
    const stream = await getFileStream(fileKey);

    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Cache-Control": "private, max-age=300",
        "Content-Type": getContentType(fileKey),
      },
    });
  } catch {
    return Response.json({ message: "Archivo no encontrado." }, { status: 404 });
  }
}
