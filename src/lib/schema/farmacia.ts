import z from "zod";

export const inventarioCategorias = [
  "medicamento",
  "insumo",
  "equipo",
  "otro",
] as const;

export const inventarioFuentes = ["agemed", "manual"] as const;

export type Receta = {
  type: "receta";

  medicamentos: {
    nombre: string;
    dosis: string;
    frecuencia: string;
    duracion: string;
  }[];
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
  laboratorio?: string;
  nombreComercial?: string;
  principioActivo: string;
  registroSanitario?: string;
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
  cantidadPlanificada: number;
  catalogoId?: string;
  categoria: (typeof inventarioCategorias)[number];
  concentracion?: string;
  createdAt: string;
  createdBy?: string;
  fechaVencimiento?: string;
  formaFarmaceutica?: string;
  fuente?: (typeof inventarioFuentes)[number];
  laboratorio?: string;
  lote?: string;
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

export const CreateViajeInventarioItemSchema = z
  .object({
    atcCode: z.string().trim().optional(),
    cantidadDisponible: z.coerce.number().min(0).optional(),
    cantidadPlanificada: z.coerce.number().min(0),
    categoria: z.enum(inventarioCategorias),
    concentracion: z.string().trim().optional(),
    fechaVencimiento: z.string().trim().optional(),
    formaFarmaceutica: z.string().trim().optional(),
    fuente: z.enum(inventarioFuentes).optional(),
    laboratorio: z.string().trim().optional(),
    lote: z.string().trim().optional(),
    nombre: z.string().trim().min(1, "Indica el nombre del item."),
    nombreComercial: z.string().trim().optional(),
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
  });
