import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Farmacia | Ajustes de inventario" };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function EstudianteFarmaciaAjustesPage() {
  redirect("/estudiante/farmacia/inventario");
}
