import "server-only";

import { db, type TesisDocument } from "@/lib/db";

type ExistingTesisDocument = PouchDB.Core.ExistingDocument<TesisDocument>;

type MangoFindRequest = {
  bookmark?: string;
  limit?: number;
  selector: Record<string, unknown>;
  sort?: unknown[];
  use_index?: string | string[];
};

type MangoFindResponse = {
  bookmark?: string;
  docs: ExistingTesisDocument[];
};

type MangoDatabase = {
  find(request: MangoFindRequest): Promise<MangoFindResponse>;
};

export function findTesisDocs(request: MangoFindRequest) {
  return (db as unknown as MangoDatabase).find(request);
}
