# Order assistant (storefront core)

A signed-in Customer asks about their own Orders and the shop through `POST /api/assistant/messages`
(`{ message, chatId?, pageOrderId?, pickedOrderId? }`). Spec: fjdvm/epic-crms#471, ticket #491.

- **Our code decides, the model words.** `lib/assistant/answer.ts` picks the Order (typed number, picker or page, only from the
  Customer's own; a number that is not theirs is the same as one that does not exist), renders the facts
  (`facts.ts`), and hands off by rule (`policy.ts`). The model only writes the reply around the facts.
- **Fact check** (`fact-check.ts`): every date, time, link, peso amount and Order number must be in the facts; no other status; no promises.
  A failure returns the Order card and `ticketButton: true`.
- **Model sees** the masked question, the last 6 turns and the status words, dates and courier link. No name, address, phone, email or amounts.
- **Limits, fixed in `policy.ts`**: 30 messages per Customer per Manila day, 500 characters, 1,000 model calls a day across the assistant, chats kept 90 days.
- **Keys**: `ASSISTANT_GROQ_API_KEY`, then `ASSISTANT_GEMINI_API_KEY`. Separate from the CREOMS Staff keys. With none set the assistant is unavailable and answers with the card.
- **Stored**: `assistant_chats` and `assistant_messages` keep the Customer, the Order looked up and exactly what was sent. The daily
  job `/api/cron/assistant-chat-retention` (workflow `assistant-chat-retention.yml`) deletes chats past the retention unless `ticket_id` is set.
- **Read-only**: `readers.ts` only selects. A test fails if the module imports an Order, Ticket or Return write path.

## Handoff (ticket #493)

- `POST /api/assistant/handoff` `{ chatId }` writes the **Handoff summary** from the Customer's own chat and their Order's status words (`lib/assistant-handoff/handoff.ts`)
  and returns it. It opens no Ticket and tells the team nothing. A Customer asking for a person, or any always-handoff reason, leads here.
- The summary goes through the same fact check as answers, in `handoff` mode: it may say what the Customer asked for ("asked for a refund") but not promise or suggest an outcome.
  A summary that fails, or a model that is down or over budget, is **dropped** (`status: "dropped"`, `summary: null`) and the Customer writes their own.
- `POST /api/assistant/handoff/send` `{ chatId, summary? }` is the only place a chat becomes a Ticket, only when the Customer presses "Send to our team". The Ticket has
  the Order as its Linked order, the reason and the approved (or the Customer's own) words as its first Message, and `assistant_chats.ticket_id` attaches the chat. Pressing twice opens one Ticket.
- The summary lives in `assistant_handoffs` (status, summary, sent text and source, what the model saw, the Ticket), never on the Ticket, apart from the Staff-facing Ticket summary.
- This code is outside `lib/assistant/` on purpose: that folder stays read-only (a test enforces it), and this is the one Customer-approved write path.
