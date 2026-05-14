"use client";

import { useRouter } from "next/navigation";
import { LogOutIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

type LogoutButtonProps = {
  className?: string;
};

export function LogoutButton({ className }: LogoutButtonProps) {
  const router = useRouter();

  return (
    <Button
      className={className}
      onClick={async () => {
        await authClient.signOut();
        router.push("/login");
        router.refresh();
      }}
      type="button"
      variant="outline"
    >
      <LogOutIcon data-icon="inline-start" />
      Cerrar sesion
    </Button>
  );
}
