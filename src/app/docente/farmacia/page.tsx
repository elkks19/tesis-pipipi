import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Docente | Farmacia",
};

export default function DocenteFarmaciaPage() {
  redirect("/docente/farmacia/planeacion");
}
