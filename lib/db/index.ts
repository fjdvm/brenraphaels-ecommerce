import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

let database: ReturnType<typeof createDatabase> | undefined;

function createDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to save Customer details.");
  }

  return drizzle(postgres(connectionString, { prepare: false }), { schema });
}

export function getDatabase() {
  database ??= createDatabase();
  return database;
}
