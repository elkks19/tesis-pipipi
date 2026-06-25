import type { Metadata } from "next";

import { DataScienceChat } from "@/components/data-science/data-science-chat";

export const metadata: Metadata = {
  title: "Investigacion",
};

export default async function AdminResearchPage() {
  return (
    <main
      className="flex h-[calc(100svh-5.5rem)] min-h-0 flex-col overflow-hidden sm:h-[calc(100svh-6.5rem)]"
      data-admin-workspace
    >
      <DataScienceChat />
    </main>
  );
}
