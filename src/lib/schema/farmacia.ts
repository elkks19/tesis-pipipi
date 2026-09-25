import z from "zod";

export const inventarioCategorias = [
  "medicamento",
  "insumo",
  "equipo",
  "otro",
] as const;

export const inventarioFuentes = ["agemed", "manual"] as const;
export const inventarioCondiciones = [
  "disponible",
  "cuarentena",
  "danado",
  "vencido",
] as const;
export const inventarioMovimientoTipos = [
  "entrada",
  "dispensacion",
  "entrega_insumo",
  "ajuste",
  "devolucion",
  "merma",
] as const;

export type Receta = {
  id: string;
  type: "receta";
  createdAt: string;
  createdBy?: string;
  diagnosticoId?: string;
  entregada?: boolean;
  entregadaAt?: string;
  entregadaBy?: string;
  historiaId: string;
  indicacionesGenerales?: string;
  medicamentos: RecetaMedicamento[];
  pacienteId: string;
  updatedAt: string;
  updatedBy?: string;
  viajeId?: string;
};

export type RecetaEstado = "pendiente" | "parcial" | "entregada";

export type RecetaMedicamento = {
  cantidad?: number;
  catalogoId?: string;
  concentracion?: string;
  dosis: string;
  duracion: string;
  formaFarmaceutica?: string;
  frecuencia: string;
  indicaciones?: string;
  inventarioItemId?: string;
  nombre: string;
  principioActivo?: string;
  unidad?: string;
  viaAdministracion?: string;
};

export type MedicamentoCatalogo = {
  id: string;
  type: "medicamentoCatalogo";
  atcCode?: string;
  concentracion?: string;
  createdAt: string;
  createdBy?: string;
  formaFarmaceutica?: string;
  fuente: (typeof inventarioFuentes)[number];
  fuenteActualizadaAt?: string;
  importacionId?: string;
  manualMotivo?: string;
  laboratorio?: string;
  nombreComercial?: string;
  principioActivo: string;
  registroSanitario?: string;
  registroVigente?: boolean;
  titularRegistro?: string;
  updatedAt: string;
  updatedBy?: string;
  viaAdministracion?: string;
};

export type ViajeInventarioItem = {
  id: string;
  type: "viajeInventarioItem";
  atcCode?: string;
  cantidadDisponible?: number;
  cantidadInicial?: number;
  cantidadMinima?: number;
  cantidadPlanificada: number;
  catalogoId?: string;
  categoria: (typeof inventarioCategorias)[number];
  concentracion?: string;
  condicion?: (typeof inventarioCondiciones)[number];
  createdAt: string;
  createdBy?: string;
  fechaVencimiento?: string;
  formaFarmaceutica?: string;
  fuente?: (typeof inventarioFuentes)[number];
  laboratorio?: string;
  lote?: string;
  manualMotivo?: string;
  nombre: string;
  nombreComercial?: string;
  observaciones?: string;
  principioActivo?: string;
  registroSanitario?: string;
  titularRegistro?: string;
  unidad: string;
  updatedAt: string;
  updatedBy?: string;
  viaAdministracion?: string;
  viajeId: string;
};

export type InventarioMovimiento = {
  id: string;
  type: "inventarioMovimiento";
  cantidad: number;
  createdAt: string;
  createdBy: string;
  inventarioItemId: string;
  motivo: string;
  recetaId?: string;
  recetaMedicamentoIndex?: number;
  tipo: (typeof inventarioMovimientoTipos)[number];
  viajeId: string;
};

export type DispensacionRecetaLinea = {
  cantidad: number;
  inventarioItemId: string;
  recetaMedicamentoIndex: number;
};

export type DispensacionReceta = {
  id: string;
  type: "dispensacionReceta";
  createdAt: string;
  createdBy: string;
  lineas: DispensacionRecetaLinea[];
  recetaId: string;
  viajeId: string;
};

export type ImportacionCatalogo = {
  id: string;
  type: "importacionCatalogo";
  createdAt: string;
  errores: string[];
  estado: "completada" | "fallida";
  fuenteUrl: string;
  importados: number;
  omitidos: number;
  updatedAt: string;
};

export type InsumoEntrega = {
  id: string;
  type: "insumoEntrega";
  cantidad: number;
  createdAt: string;
  createdBy?: string;
  insumoId: string;
  insumoNombre: string;
  observaciones?: string;
  pacienteNombre?: string;
  viajeId: string;
};

export const CreateViajeInventarioItemSchema = z
  .object({
    atcCode: z.string().trim().optional(),
    cantidadDisponible: z.coerce.number().int("La existencia debe ser entera").nonnegative().optional(),
    cantidadMinima: z.coerce.number().int().nonnegative().default(0),
    cantidadPlanificada: z.preprocess(
      (value) => value === "" ? Number.NaN : value,
      z.coerce.number().int("La cantidad debe ser entera").nonnegative("La cantidad no puede ser negativa"),
    ),
    catalogoId: z.string().trim().optional(),
    categoria: z.enum(inventarioCategorias),
    concentracion: z.string().trim().optional(),
    condicion: z.enum(inventarioCondiciones).default("disponible"),
    fechaVencimiento: z.string().trim().refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Indica una fecha de vencimiento valida.").optional(),
    formaFarmaceutica: z.string().trim().optional(),
    fuente: z.enum(inventarioFuentes).optional(),
    laboratorio: z.string().trim().optional(),
    lote: z.string().trim().optional(),
    nombre: z.string().trim().min(1, "Indica el nombre del item."),
    nombreComercial: z.string().trim().optional(),
    manualMotivo: z.string().trim().max(500).optional(),
    observaciones: z.string().trim().optional(),
    principioActivo: z.string().trim().optional(),
    registroSanitario: z.string().trim().optional(),
    titularRegistro: z.string().trim().optional(),
    unidad: z.string().trim().min(1, "Indica la unidad."),
    viaAdministracion: z.string().trim().optional(),
  })
  .superRefine((item, ctx) => {
    if (item.categoria !== "medicamento") {
      return;
    }

    if (!item.principioActivo) {
      ctx.addIssue({
        code: "custom",
        message: "Indica el principio activo para estandarizar el medicamento.",
        path: ["principioActivo"],
      });
    }

    if (!item.concentracion) {
      ctx.addIssue({
        code: "custom",
        message: "Indica la concentracion del medicamento.",
        path: ["concentracion"],
      });
    }

    if (!item.formaFarmaceutica) {
      ctx.addIssue({
        code: "custom",
        message: "Indica la forma farmaceutica.",
        path: ["formaFarmaceutica"],
      });
    }

    if (item.fuente === "manual" && !item.manualMotivo) {
      ctx.addIssue({
        code: "custom",
        message: "Explica por que el medicamento no esta en el catalogo AGEMED.",
        path: ["manualMotivo"],
      });
    }
    if (item.fuente === "agemed" && !item.catalogoId) {
      ctx.addIssue({ code: "custom", message: "Selecciona un medicamento del catalogo AGEMED.", path: ["catalogoId"] });
    }
  });

export const CreateRecetaMedicamentoSchema = z.object({
  cantidad: z.coerce.number().int().positive().optional(),
  catalogoId: z.string().trim().optional(),
  concentracion: z.string().trim().optional(),
  dosis: z.string().trim().min(1, "Indica la dosis."),
  duracion: z.string().trim().min(1, "Indica la duracion."),
  formaFarmaceutica: z.string().trim().optional(),
  frecuencia: z.string().trim().min(1, "Indica la frecuencia."),
  indicaciones: z.string().trim().optional(),
  inventarioItemId: z.string().trim().optional(),
  nombre: z.string().trim().min(1, "Indica el medicamento."),
  principioActivo: z.string().trim().optional(),
  unidad: z.string().trim().optional(),
  viaAdministracion: z.string().trim().optional(),
});

export const DispensarRecetaSchema = z.object({
  lineas: z.array(z.object({
    cantidad: z.coerce.number().int().positive("La cantidad debe ser mayor que cero."),
    inventarioItemId: z.string().trim().min(1),
    recetaMedicamentoIndex: z.coerce.number().int().nonnegative(),
  })).min(1, "Selecciona al menos un medicamento para entregar."),
});

export const AjustarInventarioSchema = z.object({
  cantidadObjetivo: z.coerce.number().int().nonnegative(),
  condicion: z.enum(inventarioCondiciones),
  motivo: z.string().trim().min(3, "Indica el motivo del ajuste."),
  tipo: z.enum(["entrada", "ajuste", "devolucion", "merma"]),
});

export const CreateRecetaSchema = z.object({
  indicacionesGenerales: z.string().trim().optional(),
  medicamentos: z
    .array(CreateRecetaMedicamentoSchema)
    .max(20, "La receta no puede tener mas de 20 medicamentos."),
});
