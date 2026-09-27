import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let database: ReturnType<typeof createDatabase> | undefined;
function createDatabase() { const url = process.env.CAREERS_DATABASE_URL; if (!url) throw new Error("CAREERS_DATABASE_URL is required for Careers data."); return drizzle(postgres(url, { prepare: false }), { schema }); }
export function getCareersDatabase() { database ??= createDatabase(); return database; }
