import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { addresses, customers } from "../db/schema";
import {
  composeFullName,
  customerSignUpSchema,
  type CustomerSignUp,
} from "./sign-up-schema";

export { customerSignUpSchema, type CustomerSignUp };

type CustomerDetails = {
  userId: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  fullName: string;
  email: string;
  contactNumber: string;
  marketingOptIn: boolean;
  address: {
    street: string;
    barangay: string;
    city: string;
    province: string;
    postalCode: string;
  };
};

export type SaveCustomerOutcome =
  | "saved"
  /** This login's own Customer details were already saved; nothing was changed. */
  | "already-saved"
  /** Another login's Customer already has this email; nothing was saved. */
  | "email-taken";

export type CustomerStore = {
  hasEmail(email: string): Promise<boolean>;
  save(details: CustomerDetails): Promise<SaveCustomerOutcome>;
};

export type NeonAuth = {
  createLogin(details: {
    email: string;
    password: string;
    fullName: string;
  }): Promise<{ userId: string }>;
  sendVerificationEmail(email: string): Promise<void>;
};

export class CustomerDetailsSaveError extends Error {
  constructor(cause: unknown) {
    super("The login was created but Customer details could not be saved.", {
      cause,
    });
    this.name = "CustomerDetailsSaveError";
  }
}

export class SignUpAuthError extends Error {
  constructor(cause: unknown) {
    super("Neon Auth could not create the login or send the confirmation email.", {
      cause,
    });
    this.name = "SignUpAuthError";
  }
}

export function createCustomerStore<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<TQueryResult, TSchema>): CustomerStore {
  return {
    async hasEmail(email) {
      const [customer] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.email, email))
        .limit(1);
      return Boolean(customer);
    },
    async save(details) {
      return db.transaction(async (transaction) => {
        const [customer] = await transaction
          .insert(customers)
          .values({
          id: details.userId,
          firstName: details.firstName,
          middleName: details.middleName,
          lastName: details.lastName,
          fullName: details.fullName,
          email: details.email,
          contactNumber: details.contactNumber,
          marketingOptIn: details.marketingOptIn,
          })
          // No target, so a clash on the id (a double submit) is handled too.
          .onConflictDoNothing()
          .returning({ id: customers.id });

        if (!customer) {
          const [own] = await transaction
            .select({ id: customers.id })
            .from(customers)
            .where(eq(customers.id, details.userId))
            .limit(1);
          return own ? "already-saved" : "email-taken";
        }

        await transaction.insert(addresses).values({
          customerId: details.userId,
          label: "Home",
          street: details.address.street,
          barangay: details.address.barangay,
          city: details.address.city,
          province: details.address.province,
          postalCode: details.address.postalCode,
          country: "Philippines",
          isDefault: true,
        });

        return "saved";
      });
    },
  };
}

export async function signUpCustomer(
  input: CustomerSignUp,
  dependencies: { auth: NeonAuth; customerStore: CustomerStore },
) {
  const signUp = customerSignUpSchema.parse(input);
  const email = signUp.email.toLowerCase();
  const fullName = composeFullName(signUp);
  const existingCustomer = await dependencies.customerStore.hasEmail(email);
  let login: { userId: string };
  try {
    login = await dependencies.auth.createLogin({
      email,
      password: signUp.password,
      fullName,
    });
  } catch (error) {
    throw new SignUpAuthError(error);
  }

  if (existingCustomer) {
    // Neon Auth sends only when this is an unverified email, while returning a
    // neutral response for an existing verified login.
    try {
      await dependencies.auth.sendVerificationEmail(email);
    } catch (error) {
      throw new SignUpAuthError(error);
    }
    return { email };
  }

  try {
    await dependencies.customerStore.save({
      userId: login.userId,
      firstName: signUp.firstName,
      middleName: signUp.middleName || null,
      lastName: signUp.lastName,
      fullName,
      email,
      contactNumber: signUp.contactNumber,
      marketingOptIn: signUp.marketingOptIn === "yes",
      address: {
        street: signUp.street,
        barangay: signUp.barangay,
        city: signUp.city,
        province: signUp.province,
        postalCode: signUp.postalCode,
      },
    });
  } catch (error) {
    throw new CustomerDetailsSaveError(error);
  }

  return { email };
}
