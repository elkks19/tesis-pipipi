import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function LegacyResearcherResearchPage() {
  redirect("/investigador/investigacion");
}
