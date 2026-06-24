import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Farmacia",
};

export default function FarmaciaPage() {
  redirect("/estudiante/farmacia/planeacion");
}
