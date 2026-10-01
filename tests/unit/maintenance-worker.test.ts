import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import {
  auditRetentionCutoff,
  cleanupExpiredAuditLogs,
  cleanupExpiredSessions,
  syncEmbeddings,
} from "../../scripts/maintenance-worker.mjs";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("maintenance worker", () => {
  it("elimina únicamente sesiones expiradas", () => {
    const directory = mkdtempSync(join(tmpdir(), "tesis-sessions-"));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, "auth.sqlite");
    const database = new Database(databasePath);
    database.exec(`
      CREATE TABLE session (
        id TEXT PRIMARY KEY,
        expiresAt INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE
      );
    `);
    database
      .prepare("INSERT INTO session (id, expiresAt, token) VALUES (?, ?, ?)")
      .run("expired", 999, "expired-token");
    database
      .prepare("INSERT INTO session (id, expiresAt, token) VALUES (?, ?, ?)")
      .run("active", 1001, "active-token");
    database.close();

    expect(cleanupExpiredSessions({ databasePath, now: 1000 })).toEqual({
      deleted: 1,
    });

    const verification = new Database(databasePath, { readonly: true });
    expect(verification.prepare("SELECT id FROM session").all()).toEqual([
      { id: "active" },
    ]);
    verification.close();
  });

  it("calcula cinco años calendario y elimina solo logs vencidos", async () => {
    const requests: Array<{ body?: string; url: string }> = [];
    let findCalls = 0;
    const result = await cleanupExpiredAuditLogs({
      couchUrl: "http://admin:secret@couchdb:5984/tesis",
      fetchImpl: async (input, init) => {
        requests.push({ body: String(init?.body ?? ""), url: String(input) });
        if (String(input).endsWith("_find")) {
          findCalls += 1;
          return Response.json({ docs: findCalls === 1
            ? [{ _id: "audit:old", _rev: "1-a" }, { _id: "agent-usage:old", _rev: "2-b" }]
            : [] });
        }
        return Response.json([{ id: "audit:old", ok: true }, { id: "agent-usage:old", ok: true }]);
      },
      now: new Date("2030-03-01T12:00:00.000Z"),
      retentionYears: 5,
    });

    expect(auditRetentionCutoff({ now: new Date("2030-03-01T12:00:00.000Z"), retentionYears: 5 }))
      .toBe("2025-03-01T12:00:00.000Z");
    expect(result).toEqual({ cutoff: "2025-03-01T12:00:00.000Z", deleted: 2, retentionYears: 5 });
    expect(requests.map((request) => request.url)).toEqual([
      "http://couchdb:5984/tesis/_find",
      "http://couchdb:5984/tesis/_bulk_docs",
      "http://couchdb:5984/tesis/_find",
    ]);
    expect(requests[1]?.body).toContain('"_deleted":true');
  });

  it("solicita la reindexación por la API interna autenticada", async () => {
    const requests: Array<{ input: string; init?: RequestInit }> = [];
    const result = await syncEmbeddings({
      apiUrl: "http://data-science:8000",
      fetchImpl: async (input, init) => {
        requests.push({ input: String(input), init });
        return new Response(
          JSON.stringify({
            historias: 4,
            indexed_chunks: 12,
            pacientes: 3,
            viajes: 1,
          }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        );
      },
      token: "internal-test-token",
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.input).toBe("http://data-science:8000/index/sync");
    expect(new Headers(requests[0]?.init?.headers).get("Authorization")).toBe(
      "Bearer internal-test-token",
    );
    expect(result).toEqual({
      historias: 4,
      indexedChunks: 12,
      pacientes: 3,
      viajes: 1,
    });
  });
});
