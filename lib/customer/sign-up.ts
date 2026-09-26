import { eq } from "drizzle-orm";
import { z } from "zod";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { addresses, customers } from "../db/schema";

const emailMaximumLength = 256;
const nameMaximumLength = 100;
const passwordMaximumLength = 128;
const addressFieldMaximumLength = 100;
const contactNumberMaximumLength = 30;

const philippineMobileNumber = /^(\+63|0)9\d{9}$/;
const nameCharacters = /^[a-zA-Z\s'-]+$/;
const addressCharacters = /^[a-zA-Z0-9\s,.#\-/'&]+$/;
const postalCodeCharacters = /^[a-zA-Z0-9\s-]+$/;

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(passwordMaximumLength, `Must be ${passwordMaximumLength} characters or fewer`)
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

export const customerSignUpSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Full name is required")
      .max(nameMaximumLength, `Must be ${nameMaximumLength} characters or fewer`)
      .regex(nameCharacters, "Can only contain letters, spaces, hyphens, and apostrophes"),
    email: z
      .string()
      .trim()
      .max(emailMaximumLength, `Must be ${emailMaximumLength} characters or fewer`)
      .email("Enter a valid email address"),
    password,
    confirmPassword: z.string().max(passwordMaximumLength),
    contactNumber: z
      .string()
      .trim()
      .max(contactNumberMaximumLength, `Must be ${contactNumberMaximumLength} characters or fewer`)
      .regex(
        philippineMobileNumber,
        "Enter a valid PH mobile number, e.g. 09171234567",
      ),
    street: addressField("Street address"),
    barangay: addressField("Barangay"),
    city: addressField("City or municipality"),
    province: addressField("Province"),
    postalCode: z
      .string()
      .trim()
      .min(1, "Postal code is required")
      .max(addressFieldMaximumLength, `Must be ${addressFieldMaximumLength} characters or fewer`)
      .regex(postalCodeCharacters, "Contains characters that are not allowed"),
    marketingOptIn: z.enum(["yes", "no"], {
      message: "Please let us know if you'd like to receive marketing emails",
    }),
    terms: z.literal(true, {
      error: "You must accept the Terms of Service",
    }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

function addressField(name: string) {
  return z
    .string()
    .trim()
    .min(1, `${name} is required`)
    .max(addressFieldMaximumLength, `Must be ${addressFieldMaximumLength} characters or fewer`)
    .regex(addressCharacters, "Contains characters that are not allowed");
}

export type CustomerSignUp = z.input<typeof customerSignUpSchema>;

type CustomerDetails = {
  userId: string;
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

export type CustomerStore = {
  hasEmail(email: string): Promise<boolean>;
  /** Returns false when a Customer with this email was already saved. */
  save(details: CustomerDetails): Promise<boolean>;
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
          fullName: details.fullName,
          email: details.email,
          contactNumber: details.contactNumber,
          marketingOptIn: details.marketingOptIn,
          })
          .onConflictDoNothing({ target: customers.email })
          .returning({ id: customers.id });

        if (!customer) {
          return false;
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

        return true;
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
  const existingCustomer = await dependencies.customerStore.hasEmail(email);
  const login = await dependencies.auth.createLogin({
    email,
    password: signUp.password,
    fullName: signUp.fullName,
  });

  if (existingCustomer) {
    // Neon Auth sends only when this is an unverified email, while returning a
    // neutral response for an existing verified login.
    await dependencies.auth.sendVerificationEmail(email);
    return { email };
  }

  try {
    await dependencies.customerStore.save({
      userId: login.userId,
      fullName: signUp.fullName,
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
