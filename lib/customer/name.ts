import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";

import { customers } from "../db/schema";
import { composeFullName, nameFields } from "./sign-up-schema";

export const customerNameSchema = z.object(nameFields);
export type CustomerName = z.input<typeof customerNameSchema>;

export type CustomerNameStore = {
  update(
    userId: string,
    name: z.output<typeof customerNameSchema>,
  ): Promise<void>;
};

export function createCustomerNameStore<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<TQueryResult, TSchema>): CustomerNameStore {
  return {
    async update(userId, name) {
      await db
        .update(customers)
        .set({ ...name, fullName: composeFullName(name) })
        .where(eq(customers.id, userId));
    },
  };
}

/** Changes the name belonging to the authenticated Customer only. */
export async function updateCustomerName(
  input: CustomerName,
  dependencies: { userId: string; customerNameStore: CustomerNameStore },
) {
  const name = customerNameSchema.parse(input);
  await dependencies.customerNameStore.update(dependencies.userId, name);
}
