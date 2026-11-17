import { and, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";

import type { AuditEvent } from "../audit/gateway";
import { addresses } from "../db/schema";
import { changedFieldNames, recordProfileUpdated } from "./profile-audit";
import { addressFields, addressLabels } from "./address-fields";

export const customerAddressSchema = z.object({
  label: z.enum(addressLabels),
  ...addressFields,
});

export type CustomerAddressInput = z.input<typeof customerAddressSchema>;

export class CustomerAddressNotFoundError extends Error {
  constructor() {
    super("Address not found.");
    this.name = "CustomerAddressNotFoundError";
  }
}

export class LastCustomerAddressError extends Error {
  constructor() {
    super("A Customer must have at least one Address.");
    this.name = "LastCustomerAddressError";
  }
}

export type AddressStore = {
  add(userId: string, input: z.output<typeof customerAddressSchema>): Promise<number>;
  update(
    userId: string,
    addressId: number,
    input: z.output<typeof customerAddressSchema>,
  ): Promise<string[] | null>;
  setDefault(userId: string, addressId: number): Promise<boolean>;
  delete(userId: string, addressId: number): Promise<"deleted" | "last-address" | "not-found">;
};

export function createAddressStore<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<TQueryResult, TSchema>): AddressStore {
  return {
    async add(userId, input) {
      const [address] = await db.insert(addresses).values({
        customerId: userId,
        ...input,
        country: "Philippines",
        isDefault: false,
      }).returning({ id: addresses.id });
      return address.id;
    },
    async update(userId, addressId, input) {
      const owned = and(eq(addresses.id, addressId), eq(addresses.customerId, userId));
      const [before] = await db.select().from(addresses).where(owned);
      if (!before) return null;
      await db.update(addresses).set(input).where(owned);
      return changedFieldNames<Record<string, unknown>>(before, input);
    },
    async setDefault(userId, addressId) {
      return db.transaction(async (transaction) => {
        // Lock the Customer's Addresses so concurrent changes are applied one at a time.
        const customerAddresses = await transaction
          .select({ id: addresses.id })
          .from(addresses)
          .where(eq(addresses.customerId, userId))
          .for("update");
        if (!customerAddresses.some(({ id }) => id === addressId)) {
          return false;
        }

        await transaction
          .update(addresses)
          .set({ isDefault: false })
          .where(eq(addresses.customerId, userId));
        await transaction
          .update(addresses)
          .set({ isDefault: true })
          .where(eq(addresses.id, addressId));
        return true;
      });
    },
    async delete(userId, addressId) {
      return db.transaction(async (transaction) => {
        const customerAddresses = await transaction
          .select({ id: addresses.id, isDefault: addresses.isDefault })
          .from(addresses)
          .where(eq(addresses.customerId, userId))
          .for("update");
        const address = customerAddresses.find(({ id }) => id === addressId);
        if (!address) {
          return "not-found";
        }
        if (customerAddresses.length === 1) {
          return "last-address";
        }

        if (address.isDefault) {
          const replacement = customerAddresses.find(({ id }) => id !== addressId);
          await transaction
            .update(addresses)
            .set({ isDefault: false })
            .where(eq(addresses.id, addressId));
          await transaction
            .update(addresses)
            .set({ isDefault: true })
            .where(eq(addresses.id, replacement!.id));
        }
        await transaction.delete(addresses).where(eq(addresses.id, addressId));
        return "deleted";
      });
    },
  };
}

export async function addCustomerAddress(
  input: CustomerAddressInput,
  dependencies: { userId: string; addressStore: AddressStore },
) {
  return dependencies.addressStore.add(
    dependencies.userId,
    customerAddressSchema.parse(input),
  );
}

export async function updateCustomerAddress(
  addressId: number,
  input: CustomerAddressInput,
  dependencies: {
    userId: string;
    addressStore: AddressStore;
    audit?: (event: AuditEvent) => Promise<void>;
  },
) {
  const changed = await dependencies.addressStore.update(
    dependencies.userId,
    addressId,
    customerAddressSchema.parse(input),
  );
  if (!changed) {
    throw new CustomerAddressNotFoundError();
  }
  await recordProfileUpdated(changed, dependencies);
}

export async function setCustomerDefaultAddress(
  addressId: number,
  dependencies: { userId: string; addressStore: AddressStore },
) {
  if (!(await dependencies.addressStore.setDefault(dependencies.userId, addressId))) {
    throw new CustomerAddressNotFoundError();
  }
}

export async function deleteCustomerAddress(
  addressId: number,
  dependencies: { userId: string; addressStore: AddressStore },
) {
  const result = await dependencies.addressStore.delete(dependencies.userId, addressId);
  if (result === "not-found") {
    throw new CustomerAddressNotFoundError();
  }
  if (result === "last-address") {
    throw new LastCustomerAddressError();
  }
}
