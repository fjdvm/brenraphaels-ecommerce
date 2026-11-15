import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import postgres from "postgres";

// Apply only #346's additive migration and reader grant; refuse unexpected migration state.
const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) throw new Error("DATABASE_URL_UNPOOLED is required");
const sql = postgres(url, { max: 1, ssl: "require", connect_timeout: 10, onnotice: () => {} });
try {
  const journal = JSON.parse(await readFile(new URL("../../drizzle/meta/_journal.json", import.meta.url), "utf8")).entries;
  const entry = journal.find(item => item.tag === "0034_dispatched_cancellations");
  const previous = journal.find(item => item.idx === entry.idx - 1);
  const migration = await readFile(new URL(`../../drizzle/${entry.tag}.sql`, import.meta.url), "utf8");
  const hash = createHash("sha256").update(migration).digest("hex");
  await sql.begin(async tx => {
    await tx`select pg_advisory_xact_lock(3460034)`;
    const [applied] = await tx`select hash, created_at from drizzle.__drizzle_migrations where hash = ${hash}`;
    const [last] = await tx`select hash, created_at from drizzle.__drizzle_migrations order by created_at desc limit 1`;
    if (applied) {
      if (Number(applied.created_at) !== entry.when) {
        await tx`update drizzle.__drizzle_migrations set created_at = ${entry.when} where hash = ${hash}`;
      }
      console.log("0034 already applied; confirming the reader grant.");
    } else {
      if (Number(last?.created_at) !== previous.when) throw new Error("Expected migration 0033 as the latest migration; no change applied.");
      for (const statement of migration.split("--> statement-breakpoint")) {
        if (statement.trim()) await tx.unsafe(statement);
      }
      await tx`insert into drizzle.__drizzle_migrations (hash, created_at) values (${hash}, ${entry.when})`;
    }
    await tx`grant select on public.order_cancellations to creoms_readonly`;
  });
  console.log("0034_dispatched_cancellations and creoms_readonly SELECT grant confirmed.");
} finally {
  await sql.end();
}
