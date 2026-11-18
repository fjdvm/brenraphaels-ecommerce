import { expect, test } from "vitest";

import { stableMessageId } from "../lib/email/stable-message-id";

test("the same event always gets the same Message-ID, and no id means none", () => {
  const sender = { address: "shop@brenraphaels.test" };
  expect(stableMessageId(sender, { id: "order-7-rejected-2" })).toEqual({ messageId: "<order-7-rejected-2@brenraphaels.test>" });
  expect(stableMessageId(sender, { id: "order-7-rejected-2" })).toEqual(stableMessageId(sender, { id: "order-7-rejected-2" }));
  expect(stableMessageId(sender)).toEqual({});
});
