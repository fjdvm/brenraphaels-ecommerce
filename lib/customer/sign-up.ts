import { and, eq, isNotNull } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import type { AuditEvent } from "../audit/gateway";
import { addresses, customers, welcomeEmails } from "../db/schema";
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
  /** The id of the Deleted Customer with this email, if there is one. */
  findDeletedId?(email: string): Promise<string | null>;
  save(details: CustomerDetails): Promise<SaveCustomerOutcome>;
};

/** Claims the one welcome email a Customer gets; true only the first time. */
export type WelcomeEmailStore = {
  claim(customerId: string): Promise<boolean>;
  release(customerId: string): Promise<void>;
};

export function createWelcomeEmailStore<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<TQueryResult, TSchema>): WelcomeEmailStore {
  return {
    async claim(customerId) {
      const rows = await db
        .insert(welcomeEmails)
        .values({ customerId })
        .onConflictDoNothing()
        .returning({ id: welcomeEmails.customerId });
      return rows.length === 1;
    },
    async release(customerId) {
      await db.delete(welcomeEmails).where(eq(welcomeEmails.customerId, customerId));
    },
  };
}

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
    async findDeletedId(email) {
      const [customer] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.email, email), isNotNull(customers.deletedAt)))
        .limit(1);
      return customer?.id ?? null;
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

/** A short failure reason with every email address (and the recipient) removed. */
function failureReason(error: unknown, recipient: string) {
  const message = error instanceof Error ? error.message : String(error);
  const cleaned = message
    .replaceAll(recipient, "[email]")
    .replace(/[^\s<>"']+@[^\s<>"']+/g, "[email]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  return cleaned || "Unknown error";
}

export async function signUpCustomer(
  input: CustomerSignUp,
  dependencies: {
    auth: NeonAuth;
    customerStore: CustomerStore;
    /** Writes the "registration" Audit Event. Optional; a failure never fails sign-up. */
    audit?: (event: AuditEvent) => Promise<void>;
    /** Sends the welcome email once per Customer. A failure never fails sign-up. */
    welcome?: {
      store: WelcomeEmailStore;
      send(email: string, firstName: string): Promise<void>;
    };
    /**
     * Removes a Deleted Customer's old login so signing up again creates a fresh
     * one with the new password. The profile is restored only after the email is
     * verified (see `restoreReturningCustomer`).
     */
    removeLogin?: (userId: string) => Promise<void>;
  },
) {
  const signUp = customerSignUpSchema.parse(input);
  const email = signUp.email.toLowerCase();
  const fullName = composeFullName(signUp);
  const existingCustomer = await dependencies.customerStore.hasEmail(email);
  const deletedId = dependencies.removeLogin
    ? await dependencies.customerStore.findDeletedId?.(email)
    : null;
  if (deletedId && dependencies.removeLogin) {
    try {
      await dependencies.removeLogin(deletedId);
    } catch (error) {
      throw new SignUpAuthError(error);
    }
  }
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

  let outcome: SaveCustomerOutcome;
  try {
    outcome = await dependencies.customerStore.save({
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

  if (outcome !== "email-taken" && dependencies.audit) {
    // The key makes a retried or double-submitted sign-up record it once. No
    // email address or field value goes in the event.
    const customer = { type: "customer", id: login.userId, display_name: "Customer" };
    try {
      await dependencies.audit({
        source: "Ecommerce",
        action: "registration",
        outcome: "success",
        actor: customer,
        subject: customer,
        target: customer,
        description: "Customer registered",
        occurred_at: new Date().toISOString(),
        idempotency_key: `registration:${login.userId}`,
      });
    } catch (error) {
      console.error("Registration audit event failed", error);
    }
  }

  if (outcome !== "email-taken" && dependencies.welcome) {
    const { store, send } = dependencies.welcome;
    const customer = { type: "customer", id: login.userId, display_name: "Customer" };
    // One event per outcome and Customer: the key makes a retry record it once.
    // The reason never carries an email address.
    const recordOutcome = async (result: "sent" | "failed", reason?: string) => {
      if (!dependencies.audit) return;
      try {
        await dependencies.audit({
          source: "Ecommerce",
          action: "welcome_email",
          outcome: result === "sent" ? "success" : "failure",
          actor: customer,
          subject: customer,
          target: customer,
          description:
            result === "sent"
              ? "Welcome email sent"
              : `Welcome email failed: ${reason}`,
          occurred_at: new Date().toISOString(),
          idempotency_key: `welcome-email:${result}:${login.userId}`,
        });
      } catch (error) {
        console.error("Welcome email audit event failed", error);
      }
    };
    // The claim is the idempotency key: a retry or double submit finds it taken.
    try {
      if (await store.claim(login.userId)) {
        try {
          await send(email, signUp.firstName);
          await recordOutcome("sent");
        } catch (error) {
          // Free the claim so a retried sign-up can still send the one email.
          await store.release(login.userId);
          await recordOutcome("failed", failureReason(error, email));
          throw error;
        }
      }
    } catch (error) {
      console.error("Welcome email failed", error);
    }
  }

  return { email };
}
