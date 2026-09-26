import { and, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";

import { addresses } from "../db/schema";
import { textField } from "../validators/fields";

const addressFieldMaximumLength = 100;
const addressCharacters = /^[\p{L}\p{M}\p{N}\s,.#\-/'&]+$/u;
const postalCodeCharacters = /^[\p{L}\p{N}\s-]+$/u;

function addressField(label: string) {
  return textField(label, {
    min: 1,
    max: addressFieldMaximumLength,
    pattern: addressCharacters,
    patternMessage: "Contains characters that are not allowed",
  });
}

export const customerAddressSchema = z.object({
  label: z.enum(["Home", "Work", "Other"]),
  street: addressField("Street address"),
  barangay: addressField("Barangay"),
  city: addressField("City or municipality"),
  province: addressField("Province"),
  postalCode: textField("Postal code", {
    min: 1,
    max: addressFieldMaximumLength,
    pattern: postalCodeCharacters,
    patternMessage: "Contains characters that are not allowed",
  }),
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
  add(userId: string, input: z.output<typeof customerAddressSchema>): Promise<void>;
  update(
    userId: string,
    addressId: number,
    input: z.output<typeof customerAddressSchema>,
  ): Promise<boolean>;
  setDefault(userId: string, addressId: number): Promise<boolean>;
  delete(userId: string, addressId: number): Promise<"deleted" | "last-address" | "not-found">;
};

export function createAddressStore<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<TQueryResult, TSchema>): AddressStore {
  return {
    async add(userId, input) {
      await db.insert(addresses).values({
        customerId: userId,
        ...input,
        country: "Philippines",
        isDefault: false,
      });
    },
    async update(userId, addressId, input) {
      const updated = await db
        .update(addresses)
        .set(input)
        .where(and(eq(addresses.id, addressId), eq(addresses.customerId, userId)))
        .returning({ id: addresses.id });
      return updated.length === 1;
    },
    async setDefault(userId, addressId) {
      return db.transaction(async (transaction) => {
        const [address] = await transaction
          .select({ id: addresses.id })
          .from(addresses)
          .where(and(eq(addresses.id, addressId), eq(addresses.customerId, userId)))
          .limit(1);
        if (!address) {
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
          .where(eq(addresses.customerId, userId));
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
  await dependencies.addressStore.add(
    dependencies.userId,
    customerAddressSchema.parse(input),
  );
}

export async function updateCustomerAddress(
  addressId: number,
  input: CustomerAddressInput,
  dependencies: { userId: string; addressStore: AddressStore },
) {
  const updated = await dependencies.addressStore.update(
    dependencies.userId,
    addressId,
    customerAddressSchema.parse(input),
  );
  if (!updated) {
    throw new CustomerAddressNotFoundError();
  }
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
