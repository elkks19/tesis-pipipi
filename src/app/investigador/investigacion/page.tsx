import type { Metadata } from "next";

import { LogoutButton } from "@/components/auth/logout-button";
import { DataScienceChat } from "@/components/data-science/data-science-chat";

export const metadata: Metadata = {
  title: "Investigacion",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ResearcherResearchPage() {
  return (
    <main className="relative flex h-svh min-h-0 overflow-hidden bg-background">
      <LogoutButton className="absolute right-3 top-3 z-10 shrink-0" />
      <DataScienceChat />
    </main>
  );
}
