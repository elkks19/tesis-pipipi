import "server-only";

import { Disk } from "flydrive";
import { FSDriver } from "flydrive/drivers/fs";
import type { DriverContract } from "flydrive/types";

let disk: Disk | null = null;

function hasS3Credentials() {
  return Boolean(
    process.env.S3_BUCKET &&
      process.env.S3_REGION &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY,
  );
}

function getRequiredEnv(key: string) {
  const value = process.env[key];

  if (!value) {
    throw new Error(`${key} debe estar configurado.`);
  }

  return value;
}

function parseBoolean(value: string | undefined) {
  return value === "true" || value === "1";
}

function createFsDisk() {
  const location = process.env.FILE_STORAGE_ROOT ?? "storage/uploads";
  const publicUrl = process.env.FILE_STORAGE_PUBLIC_URL;

  return new Disk(
    new FSDriver({
      location,
      visibility: "private",
      urlBuilder: publicUrl
        ? {
            async generateURL(key) {
              return `${publicUrl.replace(/\/$/, "")}/${key}`;
            },
          }
        : undefined,
    }),
  );
}

async function createS3Disk() {
  const s3DriverModule = "flydrive/drivers/s3";
  const { S3Driver } = (await import(s3DriverModule)) as {
    S3Driver: new (options: Record<string, unknown>) => DriverContract;
  };

  return new Disk(
    new S3Driver({
      bucket: getRequiredEnv("S3_BUCKET"),
      region: getRequiredEnv("S3_REGION"),
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: parseBoolean(process.env.S3_FORCE_PATH_STYLE),
      credentials: {
        accessKeyId: getRequiredEnv("S3_ACCESS_KEY_ID"),
        secretAccessKey: getRequiredEnv("S3_SECRET_ACCESS_KEY"),
      },
      visibility: "private",
      supportsACL: process.env.S3_SUPPORTS_ACL
        ? parseBoolean(process.env.S3_SUPPORTS_ACL)
        : true,
      cdnUrl: process.env.S3_PUBLIC_URL,
    }),
  );
}

export async function getStorageDisk() {
  if (disk) {
    return disk;
  }

  disk = hasS3Credentials() ? await createS3Disk() : createFsDisk();

  return disk;
}

export async function putFile({
  contentType,
  key,
  bytes,
}: {
  bytes: Uint8Array;
  contentType: string;
  key: string;
}) {
  const storage = await getStorageDisk();

  await storage.put(key, bytes, {
    contentLength: bytes.byteLength,
    contentType,
    visibility: "private",
  });
}

export async function getFileUrl(key: string) {
  const storage = await getStorageDisk();

  try {
    return await storage.getUrl(key);
  } catch {
    return storage.getSignedUrl(key, {
      expiresIn: "30 mins",
    });
  }
}

export async function getFileStream(key: string) {
  const storage = await getStorageDisk();

  return storage.getStream(key);
}
