import { readdirSync, readFileSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { customers, ticketMessages, tickets } from "../lib/db/schema";
import { createTicketStore } from "../lib/support/tickets";

let client: PGlite;

const customer = {
  id: "customer-1",
  firstName: "Jane",
  lastName: "Doe",
  fullName: "Jane Doe",
  email: "jane@example.com",
  contactNumber: "09171234567",
  marketingOptIn: false,
};

beforeEach(() => {
  client = new PGlite();
});

afterEach(async () => {
  await client.close();
});

describe("Ticket schema", () => {
  test("a new Ticket is Open, Normal Priority and unclaimed", async () => {
    const database = drizzle(client);
    await migrate(database, { migrationsFolder: "drizzle" });
    await database.insert(customers).values(customer);

    const ticket = await createTicketStore(database).open("customer-1", {
      subject: "Where is my Order?",
      category: "Delivery Issue",
      body: "It has not arrived yet.",
    });
    const [row] = await database.select().from(tickets);

    expect(ticket.status).toBe("open");
    expect(row).toMatchObject({
      status: "open",
      priority: "normal",
      claimedById: null,
      claimedByName: null,
      resolvedAt: null,
    });
    const [message] = await database.select().from(ticketMessages);
    expect(message.fileId).toBeNull();
  });

  test("the Ticket status default applies even when the insert names no status", async () => {
    const database = drizzle(client);
    await migrate(database, { migrationsFolder: "drizzle" });
    await database.insert(customers).values(customer);

    const [row] = await database.insert(tickets).values({ customerId: "customer-1", subject: "Hi", category: "Other" }).returning();

    expect(row.status).toBe("open");
  });

  test("existing Tickets keep their Messages and map closed to Completed, open to Open", async () => {
    // Apply everything before the new migration, as production is today, then seed old-shape Tickets.
    const migrationSql = readFileSync("drizzle/0015_ticket_crms_fields.sql", "utf8");
    const previousSql = readdirSync("drizzle")
      .filter((name) => name.endsWith(".sql") && name < "0015")
      .sort();
    for (const name of previousSql) {
      for (const statement of readFileSync(`drizzle/${name}`, "utf8").split("--> statement-breakpoint")) {
        if (statement.trim()) await client.exec(statement);
      }
    }
    await client.exec(`
      INSERT INTO customers (id, first_name, last_name, full_name, email, contact_number, marketing_opt_in)
        VALUES ('customer-1', 'Jane', 'Doe', 'Jane Doe', 'jane@example.com', '09171234567', false);
      INSERT INTO tickets (customer_id, subject, category, status) VALUES
        ('customer-1', 'Still open', 'Other', 'open'),
        ('customer-1', 'Already closed', 'Other', 'closed');
      INSERT INTO ticket_messages (ticket_id, sender, body) VALUES (1, 'customer', 'one'), (2, 'customer', 'two');
    `);

    for (const statement of migrationSql.split("--> statement-breakpoint")) {
      if (statement.trim()) await client.exec(statement);
    }

    const rows = await drizzle(client).select().from(tickets).orderBy(tickets.id);
    expect(rows.map((row) => [row.status, row.priority])).toEqual([
      ["open", "normal"],
      ["completed", "normal"],
    ]);
    const store = createTicketStore(drizzle(client));
    expect((await store.get(2, "customer-1"))?.messages.map((message) => message.body)).toEqual(["two"]);
  });
});
