import { afterEach, describe, expect, it, vi } from "vitest";
import { syncConfig, validSharedSecret, validateSyncConfig } from "@/lib/sync/config.mjs";
import { replicationDefinitions } from "@/lib/sync/replication.mjs";
import { isCaughtUp } from "@/lib/sync/engine.mjs";
import { referencedFiles, validFileKey } from "@/lib/sync/files.mjs";
import { authRoles } from "@/lib/auth-roles";

afterEach(() => vi.unstubAllEnvs());
describe("configuración y replicación", () => {
  const config = () => syncConfig({ APP_ENVIRONMENT: "raspberry", SYNC_ENABLED: "true", COUCHDB_URL: "http://local:password@localhost:5984/tesis", SYNC_CLOUD_APP_URL: "https://app.example.com", SYNC_CLOUD_COUCHDB_URL: "https://db.example.com/tesis", SYNC_CLOUD_COUCHDB_USERNAME: "sync", SYNC_CLOUD_COUCHDB_PASSWORD: "example", SYNC_SHARED_SECRET: "x".repeat(32) });
  it("queda desactivada por defecto y rechaza bases del sistema", () => {
    expect(syncConfig({}).enabled).toBe(false);
    expect(() => validateSyncConfig({ ...config(), localUrl: "http://localhost:5984/_users" })).toThrow();
  });
  it("exige HTTPS, secreto y destinos distintos", () => {
    expect(() => validateSyncConfig(config())).not.toThrow();
    for (const change of [{ cloudUrl: "http://app.example.com" }, { secret: "short" }, { remoteUrl: "https://user:pass@db.example.com/tesis" }]) expect(() => validateSyncConfig({ ...config(), ...change })).toThrow();
  });
  it("permite HTTP solo para el host privado autorizado", () => {
    const privateConfig = { ...config(), trustedHttpHost: "laptop", cloudUrl: "http://laptop:5173", remoteUrl: "http://laptop:5984/tesis" };
    expect(() => validateSyncConfig(privateConfig)).not.toThrow();
    for (const change of [{ trustedHttpHost: "" }, { cloudUrl: "http://otro:5173" }, { remoteUrl: "http://laptop.ejemplo.com/tesis" }, { cloudUrl: "http://user:password@laptop:5173" }]) expect(() => validateSyncConfig({ ...privateConfig, ...change })).toThrow();
  });
  it("usa dos replicaciones continuas estables sin crear ni copiar otras bases", () => {
    const [push, pull] = replicationDefinitions(config());
    expect(push.source).toEqual(pull.target);
    expect(push.target).toEqual(pull.source);
    expect(push._id).toBe("tesis-raspberry-01-push");
    expect(push.continuous).toBe(true);
    expect(push.create_target).toBe(false);
  });
  it("compara credenciales independientes sin aceptar cadenas vacías", () => {
    expect(validSharedSecret("x".repeat(32), "x".repeat(32))).toBe(true);
    expect(validSharedSecret("bad", "x".repeat(32))).toBe(false);
    expect(validSharedSecret("", "")).toBe(false);
  });
});
it("mantiene los permisos diferentes de los roles", () => {
  expect(authRoles.admin.authorize({ estacion: ["review"] }).success).toBe(true);
  expect(authRoles.estudiante.authorize({ estacion: ["review"] }).success).toBe(false);
  expect(authRoles["docente-investigador"].authorize({ estacion: ["write"] }).success).toBe(false);
});
it("no confunde documentos completos con sincronización completa", () => {
  const snapshot = { paused: false, replication: [{ state: "running", pending: 0, failures: 0 }, { state: "running", pending: 0, failures: 0 }], files: { pending: 0, conflicts: 0 }, accounts: { ok: true }, conflicts: 0, error: null };
  expect(isCaughtUp(snapshot)).toBe(true);
  for (const change of [{ files: null }, { accounts: null }, { conflicts: 1 }, { paused: true }, { error: "offline" }, { replication: [] }]) expect(isCaughtUp({ ...snapshot, ...change })).toBe(false);
});
it("extrae referencias de archivos y rechaza traversal", () => {
  expect(referencedFiles([{ ecografia: { imagen: { key: "images/a.jpg", tipo: "image/jpeg" } }, reporteHistoria: { key: "reports/b.pdf", tamano: 10 } }])).toEqual(["images/a.jpg", "reports/b.pdf"]);
  for (const key of ["../secret", "/absolute", "a/../../secret", "a\\b", "a//b"]) expect(validFileKey(key)).toBe(false);
});
