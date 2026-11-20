import postgres from "postgres";

// Read-only report for #667: how many Pickup Orders exist, by status, so the owner can approve their deletion (#671).
// Run: node --env-file=<env file with DATABASE_URL_UNPOOLED> scripts/db/pickup-orders-report.mjs
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL_UNPOOLED is required");
const sql = postgres(url, { max: 1, ssl: "require", connect_timeout: 10, onnotice: () => {} });
try {
  const rows = await sql`select status, count(*)::int as orders from public.orders where fulfillment_method = 'pickup' group by status order by orders desc, status`;
  const total = rows.reduce((sum, row) => sum + row.orders, 0);
  console.log(`Pickup Orders by status (${total} in all):`);
  for (const row of rows) console.log(`  ${row.status.padEnd(18)} ${row.orders}`);
  if (rows.length === 0) console.log("  none");
} finally {
  await sql.end();
}
