import { asc, desc, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { addresses, customers } from "../db/schema";
import type { VisitorStore } from "./visitor";

export function createVisitorStore<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<TQueryResult, TSchema>): VisitorStore {
  return {
    async findCustomer(userId) {
      const [customer] = await db
        .select({
          userId: customers.id,
          firstName: customers.firstName,
          middleName: customers.middleName,
          lastName: customers.lastName,
          fullName: customers.fullName,
          email: customers.email,
          contactNumber: customers.contactNumber,
        })
        .from(customers)
        .where(eq(customers.id, userId))
        .limit(1);
      if (!customer) {
        return undefined;
      }

      const customerAddresses = await db
        .select({
          id: addresses.id,
          label: addresses.label,
          street: addresses.street,
          barangay: addresses.barangay,
          city: addresses.city,
          province: addresses.province,
          postalCode: addresses.postalCode,
          country: addresses.country,
          isDefault: addresses.isDefault,
        })
        .from(addresses)
        .where(eq(addresses.customerId, userId))
        .orderBy(desc(addresses.isDefault), asc(addresses.id));

      return { ...customer, addresses: customerAddresses };
    },
  };
}
