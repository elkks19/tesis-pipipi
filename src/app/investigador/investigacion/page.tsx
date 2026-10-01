import type { Metadata } from "next";

import { DataScienceChat } from "@/components/data-science/data-science-chat";

export const metadata: Metadata = {
  title: "Investigacion",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ResearcherResearchPage() {
  return (
    <main className="flex h-svh min-h-0 overflow-hidden bg-background">
      <DataScienceChat workspace="researcher" />
    </main>
  );
}
