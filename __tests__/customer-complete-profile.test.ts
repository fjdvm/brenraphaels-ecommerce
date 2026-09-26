import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { completeCustomerProfile } from "../lib/customer/complete-profile";
import {
  splitFullName,
  type CompleteProfileInput,
} from "../lib/customer/complete-profile-schema";
import { createCustomerStore } from "../lib/customer/sign-up";
import { classifyVisitor } from "../lib/customer/visitor";
import { createVisitorStore } from "../lib/customer/visitor-store";

let client: PGlite;

const identity = {
  userId: "neon-user-1",
  email: "jane@example.com",
  fullName: "Jane Doe",
};

const validDetails: CompleteProfileInput = {
  firstName: "Jane",
  lastName: "Doe",
  contactNumber: "09171234567",
  street: "123 Katipunan Avenue",
  barangay: "Loyola Heights",
  city: "Quezon City",
  province: "Metro Manila",
  postalCode: "1108",
  marketingOptIn: "yes",
  terms: true,
};

beforeEach(async () => {
  client = new PGlite();
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
});

afterEach(async () => {
  await client.close();
});

function complete(input: CompleteProfileInput, who = identity) {
  return completeCustomerProfile(input, {
    identity: who,
    customerStore: createCustomerStore(drizzle(client)),
  });
}

describe("Completing a Customer's profile", () => {
  test("saves the Customer and their first Address as the Default address", async () => {
    await expect(complete(validDetails)).resolves.toEqual({ status: "completed" });

    expect(
      await client.query(
        "select id, email, full_name, contact_number, marketing_opt_in from customers",
      ),
    ).toMatchObject({
      rows: [
        {
          id: "neon-user-1",
          email: "jane@example.com",
          full_name: "Jane Doe",
          contact_number: "09171234567",
          marketing_opt_in: true,
        },
      ],
    });
    expect(
      await client.query(
        "select customer_id, label, barangay, country, is_default from addresses",
      ),
    ).toMatchObject({
      rows: [
        {
          customer_id: "neon-user-1",
          label: "Home",
          barangay: "Loyola Heights",
          country: "Philippines",
          is_default: true,
        },
      ],
    });
  });

  test("turns a Visitor who needed to finish their details into a complete Customer", async () => {
    const visitorStore = createVisitorStore(drizzle(client));
    await expect(
      classifyVisitor(identity, { visitorStore }),
    ).resolves.toMatchObject({ state: "needs-details" });

    await complete(validDetails);

    await expect(
      classifyVisitor(identity, { visitorStore }),
    ).resolves.toMatchObject({ state: "customer" });
  });

  test("takes the email from the login, never from the submitted details", async () => {
    await complete({ ...validDetails, email: "someone-else@example.com" } as CompleteProfileInput);

    expect(await client.query("select email from customers")).toMatchObject({
      rows: [{ email: "jane@example.com" }],
    });
  });

  test("saves a middle name when there is one and a Marketing opt-in of no", async () => {
    await complete({ ...validDetails, middleName: " Marie ", marketingOptIn: "no" });

    expect(
      await client.query(
        "select middle_name, full_name, marketing_opt_in from customers",
      ),
    ).toMatchObject({
      rows: [{ middle_name: "Marie", full_name: "Jane Marie Doe", marketing_opt_in: false }],
    });
  });

  test("reports what is wrong and saves nothing when the details are invalid", async () => {
    const outcome = await complete({
      ...validDetails,
      contactNumber: "not-a-contact-number",
      terms: false,
      marketingOptIn: undefined,
    } as unknown as CompleteProfileInput);

    expect(outcome).toMatchObject({
      status: "invalid",
      fieldErrors: {
        contactNumber: [expect.stringContaining("valid PH mobile number")],
        terms: [expect.stringContaining("Terms of Service")],
        marketingOptIn: [expect.any(String)],
      },
    });
    expect(await client.query("select id from customers")).toMatchObject({ rows: [] });
    expect(await client.query("select id from addresses")).toMatchObject({ rows: [] });
  });

  test("requires the Marketing opt-in answer rather than assuming one", async () => {
    const outcome = await complete({
      ...validDetails,
      marketingOptIn: undefined,
    } as unknown as CompleteProfileInput);

    expect(outcome).toMatchObject({ status: "invalid" });
  });

  test("leaves no partial rows when saving the Address fails", async () => {
    await client.query(
      "alter table addresses add constraint postal_code_cannot_be_0000 check (postal_code <> '0000')",
    );

    await expect(complete({ ...validDetails, postalCode: "0000" })).rejects.toThrow();

    expect(await client.query("select id from customers")).toMatchObject({ rows: [] });
    expect(await client.query("select id from addresses")).toMatchObject({ rows: [] });
  });

  test("lets the Customer try again after a failed completion", async () => {
    await client.query(
      "alter table addresses add constraint postal_code_cannot_be_0000 check (postal_code <> '0000')",
    );
    await expect(complete({ ...validDetails, postalCode: "0000" })).rejects.toThrow();

    await expect(complete(validDetails)).resolves.toEqual({ status: "completed" });

    expect(await client.query("select id from customers")).toMatchObject({
      rows: [{ id: "neon-user-1" }],
    });
  });

  test("does not overwrite or duplicate a Customer who already completed their details", async () => {
    await complete(validDetails);

    await expect(
      complete({ ...validDetails, contactNumber: "09999999999", street: "Elsewhere" }),
    ).resolves.toEqual({ status: "already-complete" });

    expect(await client.query("select contact_number from customers")).toMatchObject({
      rows: [{ contact_number: "09171234567" }],
    });
    expect(await client.query("select street from addresses")).toMatchObject({
      rows: [{ street: "123 Katipunan Avenue" }],
    });
  });

  test("tells the Customer when their email already belongs to another Customer, saving nothing", async () => {
    await complete(validDetails, { ...identity, userId: "neon-user-old" });

    await expect(complete({ ...validDetails, street: "Elsewhere" })).resolves.toEqual({
      status: "email-taken",
    });

    expect(await client.query("select id from customers")).toMatchObject({
      rows: [{ id: "neon-user-old" }],
    });
    expect(await client.query("select street from addresses")).toMatchObject({
      rows: [{ street: "123 Katipunan Avenue" }],
    });
  });

  test("saves once when the same Customer submits twice at the same time", async () => {
    const outcomes = await Promise.all([complete(validDetails), complete(validDetails)]);

    expect(outcomes.map((outcome) => outcome.status).sort()).toEqual([
      "already-complete",
      "completed",
    ]);
    expect(await client.query("select id from addresses")).toMatchObject({
      rows: [expect.anything()],
    });
  });
});

describe("Pre-filling the name from the login", () => {
  test.each([
    ["Jane Doe", { firstName: "Jane", middleName: "", lastName: "Doe" }],
    ["Jane Marie Doe", { firstName: "Jane", middleName: "Marie", lastName: "Doe" }],
    ["  Jane   Doe  ", { firstName: "Jane", middleName: "", lastName: "Doe" }],
    ["Madonna", { firstName: "Madonna", middleName: "", lastName: "" }],
    ["", { firstName: "", middleName: "", lastName: "" }],
  ])("splits %j into its parts", (fullName, parts) => {
    expect(splitFullName(fullName)).toEqual(parts);
  });
});
