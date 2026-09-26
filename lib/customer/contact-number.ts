import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";

import { customers } from "../db/schema";
import { phoneField } from "../validators/fields";

const philippineMobileNumber = /^(\+63|0)9\d{9}$/;

/** The Contact number format accepted when a Customer signs up or updates it. */
export const customerContactNumberSchema = z.object({
  contactNumber: phoneField("Contact number", {
    pattern: philippineMobileNumber,
    patternMessage: "Enter a valid PH mobile number, e.g. 09171234567",
  }),
});

export type CustomerContactNumber = z.input<typeof customerContactNumberSchema>;

export type ContactNumberStore = {
  update(userId: string, contactNumber: string): Promise<void>;
};

export function createContactNumberStore<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<TQueryResult, TSchema>): ContactNumberStore {
  return {
    async update(userId, contactNumber) {
      await db
        .update(customers)
        .set({ contactNumber })
        .where(eq(customers.id, userId));
    },
  };
}

/** Changes the Contact number belonging to the authenticated Customer only. */
export async function updateCustomerContactNumber(
  input: CustomerContactNumber,
  dependencies: { userId: string; contactNumberStore: ContactNumberStore },
) {
  const { contactNumber } = customerContactNumberSchema.parse(input);
  await dependencies.contactNumberStore.update(dependencies.userId, contactNumber);
}
