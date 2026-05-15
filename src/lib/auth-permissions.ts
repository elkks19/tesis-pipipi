import "server-only";

import type { ReadonlyHeaders } from "next/dist/server/web/spec-extension/adapters/headers";

import { auth } from "@/lib/auth";
import type { authStatements } from "@/lib/auth-roles";

type PermissionResource = keyof typeof authStatements;
type PermissionAction<TResource extends PermissionResource> =
  (typeof authStatements)[TResource][number];

export async function hasAuthPermission<TResource extends PermissionResource>({
  headers,
  permission,
}: {
  headers: Headers | ReadonlyHeaders;
  permission: {
    [TKey in TResource]: PermissionAction<TKey>[];
  };
}) {
  const result = await auth.api.userHasPermission({
    body: {
      permissions: permission,
    },
    headers,
  });

  return result.success;
}
