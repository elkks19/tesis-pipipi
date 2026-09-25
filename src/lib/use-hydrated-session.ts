"use client";

import { useSyncExternalStore } from "react";

import { authClient } from "@/lib/auth-client";

const subscribe = () => () => {};

export function useHydratedSession() {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const sessionQuery = authClient.useSession();

  return {
    ...sessionQuery,
    data: hydrated ? sessionQuery.data : null,
    isPending: !hydrated || sessionQuery.isPending,
  };
}
