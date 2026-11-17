import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";

import { customers } from "../db/schema";
import type { AuditEvent } from "../audit/gateway";
import { changedFieldNames, recordProfileUpdated } from "./profile-audit";
import { composeFullName, nameFields } from "./sign-up-schema";

export const customerNameSchema = z.object(nameFields);
export type CustomerName = z.input<typeof customerNameSchema>;

export type CustomerNameStore = {
  /** Saves the name and returns the names of the fields that changed. */
  update(
    userId: string,
    name: z.output<typeof customerNameSchema>,
  ): Promise<string[]>;
};

export function createCustomerNameStore<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<TQueryResult, TSchema>): CustomerNameStore {
  return {
    async update(userId, name) {
      const [before] = await db
        .select({
          firstName: customers.firstName,
          middleName: customers.middleName,
          lastName: customers.lastName,
        })
        .from(customers)
        .where(eq(customers.id, userId));
      await db
        .update(customers)
        .set({ ...name, fullName: composeFullName(name) })
        .where(eq(customers.id, userId));
      return changedFieldNames(before ?? {}, {
        firstName: name.firstName,
        middleName: name.middleName || null,
        lastName: name.lastName,
      });
    },
  };
}

/** Changes the name belonging to the authenticated Customer only. */
export async function updateCustomerName(
  input: CustomerName,
  dependencies: {
    userId: string;
    customerNameStore: CustomerNameStore;
    audit?: (event: AuditEvent) => Promise<void>;
  },
) {
  const name = customerNameSchema.parse(input);
  const changed = await dependencies.customerNameStore.update(dependencies.userId, name);
  await recordProfileUpdated(changed, dependencies);
}
