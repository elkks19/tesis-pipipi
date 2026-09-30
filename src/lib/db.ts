import "server-only";
import "./pouchdb-server-shim";

import PouchDB from "pouchdb/dist/pouchdb";
import PouchDBFind from "pouchdb-find";

import type {
  Actividad,
  Historia,
  ImportacionCatalogo,
  InventarioMovimiento,
  DispensacionReceta,
  InsumoEntrega,
  MedicamentoCatalogo,
  Paciente,
  Receta,
  Viaje,
  ViajeInventarioItem,
} from "$lib/schema";

PouchDB.plugin(PouchDBFind);

export type TesisDocument =
  | Actividad
  | Viaje
  | Historia
  | ImportacionCatalogo
  | InventarioMovimiento
  | DispensacionReceta
  | InsumoEntrega
  | Paciente
  | Receta
  | MedicamentoCatalogo
  | ViajeInventarioItem;

const couchDbUrl = process.env.COUCHDB_URL;

if (!couchDbUrl) {
  throw new Error("COUCHDB_URL debe estar configurado para usar CouchDB.");
}

export const db = new PouchDB<TesisDocument>(couchDbUrl);
