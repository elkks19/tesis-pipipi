import { ActivityIcon, HistoryIcon, PackageIcon, PackagePlusIcon, PillIcon, SlidersHorizontalIcon, SyringeIcon } from "lucide-react";
import type { FarmaciaAccessMode, FarmaciaAccessPhase } from "@/lib/farmacia-access";

export function farmaciaNavigation(mode: FarmaciaAccessMode, phase: FarmaciaAccessPhase) {
  const base = `/${mode}/farmacia`;
  if (phase === "sin_acceso") return [];
  if (phase === "planeacion") return [
    { href: `${base}/planeacion`, label: "Inventario del viaje", icon: PackageIcon },
    { href: `${base}/entradas`, label: "Entradas", icon: PackagePlusIcon },
  ];
  return [
    { href: `${base}/inventario`, label: "Inventario del viaje", icon: PackageIcon },
    { href: `${base}/recetas`, label: "Recetas", icon: PillIcon },
    { href: `${base}/insumos`, label: "Entrega de insumos", icon: SyringeIcon },
    ...(mode === "docente" && phase === "activo" ? [{ href: `${base}/entradas`, label: "Entradas", icon: PackagePlusIcon }] : []),
    ...(mode === "docente" && (phase === "activo" || phase === "conciliacion") ? [{ href: `${base}/ajustes`, label: "Ajustes", icon: SlidersHorizontalIcon }] : []),
    { href: `${base}/movimientos`, label: "Movimientos", icon: HistoryIcon },
    { href: `${base}/actividad`, label: "Actividad", icon: ActivityIcon },
  ];
}
