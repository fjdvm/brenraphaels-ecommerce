import { afterEach, describe, expect, test, vi } from "vitest";

import { submitContactMessage } from "../lib/contact/contact-message";

const validInput = {
  name: "Jane Doe",
  email: "jane@example.com",
  phone: "0917 123 4567",
  comment: "Do you deliver to Quezon City?",
  website: "",
};

function mailerStub() {
  return { send: vi.fn().mockResolvedValue(undefined) };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Sending the shop a message", () => {
  test("emails a valid message to the shop", async () => {
    const mailer = mailerStub();

    const result = await submitContactMessage(validInput, { mailer });

    expect(result).toEqual({ status: "sent" });
    expect(mailer.send).toHaveBeenCalledWith({
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "0917 123 4567",
      comment: "Do you deliver to Quezon City?",
      topic: "General inquiry",
    });
  });

  test("passes on the chosen topic", async () => {
    const mailer = mailerStub();

    await submitContactMessage({ ...validInput, topic: "Bulk order" }, { mailer });

    expect(mailer.send).toHaveBeenCalledWith(
      expect.objectContaining({ topic: "Bulk order" }),
    );
  });

  test("rejects a topic that is not on the list", async () => {
    const mailer = mailerStub();

    const result = await submitContactMessage(
      { ...validInput, topic: "Something else" },
      { mailer },
    );

    expect(result).toMatchObject({
      status: "invalid",
      fieldErrors: { topic: expect.any(Array) },
    });
    expect(mailer.send).not.toHaveBeenCalled();
  });

  test("needs only an email and a comment", async () => {
    const mailer = mailerStub();

    const result = await submitContactMessage(
      { ...validInput, name: "", phone: "" },
      { mailer },
    );

    expect(result).toEqual({ status: "sent" });
    expect(mailer.send).toHaveBeenCalledWith(
      expect.objectContaining({ name: "", phone: "" }),
    );
  });

  test("tidies the email address", async () => {
    const mailer = mailerStub();

    await submitContactMessage(
      { ...validInput, email: "  Jane@Example.COM " },
      { mailer },
    );

    expect(mailer.send).toHaveBeenCalledWith(
      expect.objectContaining({ email: "jane@example.com" }),
    );
  });

  test("rejects invisible characters in a comment", async () => {
    const mailer = mailerStub();

    const result = await submitContactMessage(
      { ...validInput, comment: "Hello​ there\r\n\r\n\r\n\r\nThanks" },
      { mailer },
    );

    expect(result).toMatchObject({ status: "invalid", fieldErrors: { comment: expect.any(Array) } });
    expect(mailer.send).not.toHaveBeenCalled();
  });

  test.each([
    ["a missing email", { email: "" }, "email"],
    ["an invalid email", { email: "not-an-email" }, "email"],
    ["an empty comment", { comment: "   " }, "comment"],
    ["a comment that is too long", { comment: "a".repeat(2_001) }, "comment"],
    ["a phone number with letters", { phone: "call me" }, "phone"],
    ["a name that is too long", { name: "a".repeat(101) }, "name"],
  ])("rejects %s and sends nothing", async (_label, change, field) => {
    const mailer = mailerStub();

    const result = await submitContactMessage(
      { ...validInput, ...change },
      { mailer },
    );

    expect(result).toMatchObject({ status: "invalid" });
    expect(
      result.status === "invalid" && result.fieldErrors[field],
    ).toBeTruthy();
    expect(mailer.send).not.toHaveBeenCalled();
  });

  test("pretends a message was sent when the hidden field is filled, and sends nothing", async () => {
    const mailer = mailerStub();

    const result = await submitContactMessage(
      { ...validInput, website: "https://spam.example" },
      { mailer },
    );

    expect(result).toEqual({ status: "sent" });
    expect(mailer.send).not.toHaveBeenCalled();
  });

  test("says it failed, and logs why, when the email cannot be sent", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const mailer = { send: vi.fn().mockRejectedValue(new Error("SMTP down")) };

    const result = await submitContactMessage(validInput, { mailer });

    expect(result).toEqual({ status: "failed" });
    expect(logged).toHaveBeenCalled();
  });
});
