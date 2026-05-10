import "server-only";
import "./pouchdb-server-shim";

import PouchDB from "pouchdb/dist/pouchdb";
import PouchDBFind from "pouchdb-find";

import type { Historia, Paciente, Viaje } from "$lib/schema";

PouchDB.plugin(PouchDBFind);

export type TesisDocument = Viaje | Historia | Paciente;

const couchDbUrl = process.env.COUCHDB_URL;

if (!couchDbUrl) {
  throw new Error("COUCHDB_URL debe estar configurado para usar CouchDB.");
}

export const db = new PouchDB<TesisDocument>(couchDbUrl);
