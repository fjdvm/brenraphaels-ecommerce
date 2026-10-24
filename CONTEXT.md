# Bren Raphael's Storefront

The online shop where people buy Bren Raphael's Ube Jam & Halaya. This context covers how people become Customers, prove they own their email, keep their personal details, browse products, place and pay for Orders, and give Feedback. This context is Customer-facing only: it has no staff or admin UI, and it shares no data, accounts, or vocabulary with the [Careers](./app/(careers)/CONTEXT.md) context living alongside it in this same app — see [Context Map](./CONTEXT-MAP.md). A Customer and an Applicant are unrelated identities, even for the same person.

CREOMS (Customer Relationship & E-commerce Ordering Management System) is a separate application, built later. It manages Orders from the staff side (quoting delivery fees, verifying payment, advancing status) and, once built, answers Support Tickets from the staff side. For Orders, CREOMS reads them through a read-only database role and changes them only through this app's Order status endpoint, so the transition rules and Customer emails stay here — this app owns and remains the source of truth for Order data (see [ADR-0003](./docs/adr/0003-ecommerce-and-creoms-integrate-over-api-not-shared-database.md)). Support Tickets are the exception: this app and CREOMS share one Neon database for Ticket data, with this app as the sole owner of that schema and its migrations (see [ADR-0007](./docs/adr/0007-support-tickets-integrate-via-shared-database.md)). Either way, CREOMS's own staff sign in through a separate service (br-auth-service), not Neon Auth, so staff identity never lives in this app's database.

## Language

**Customer**:
A person who shops at the store, identified by their email address. A Customer has a Contact number, a Marketing opt-in answer, and one or more Addresses. Staff and admins are not Customers.
_Avoid_: User, account, profile, shopper

**Sign-up**:
A person becoming a Customer by giving their email, a password, and their personal information.
_Avoid_: Registration, enrollment

**Verified**:
A Customer whose email address is proven to be theirs by confirming a message sent to it. A Customer who is not Verified cannot sign in.
_Avoid_: Confirmed, activated

**Contact number**:
A Philippine mobile number the shop can use to reach the Customer about an order. It is collected at sign-up, or on the complete-profile form for a login whose details were never saved, but is not itself verified.
_Avoid_: Phone, mobile, cellphone

**Marketing opt-in**:
The Customer's explicit yes-or-no answer to receiving promotional emails, asked at sign-up with no pre-selected answer.
_Avoid_: Newsletter subscription, consent flag

**Unsubscribe link**:
A public link in the footer of every Marketing Email, unique to one Customer and not guessable. Opening it, without signing in, sets that Customer's Marketing opt-in to no at once and shows a confirmation page. Opening it again changes nothing. A link that is invalid or has been altered changes nothing and says so.
_Avoid_: Opt-out link

**Address**:
A place the shop can deliver to, with a label (Home, Work, Other). A Customer gives their first Address at sign-up and may add, edit, or remove Addresses afterwards.
_Avoid_: Location, shipping info

**Default address**:
The one Address of a Customer that is pre-selected when they need to choose where to deliver.
_Avoid_: Primary address, main address

**Visitor**:
Anyone using the site, classified as signed out, signed in but still needing to finish their details, or a complete Customer.
_Avoid_: User, guest

**Order**:
A Customer's request to buy one or more Sizes, placed against one fulfillment method (Pickup or Delivery) and one payment method (Cash on Delivery or GCash). Only a Customer can place an Order. A Delivery Order keeps its own copy of the chosen Address as it was at checkout, so editing or deleting that Address later never changes the Order.
_Avoid_: Purchase, transaction

**Order status**:
Where an Order is in its lifecycle: `placed`, `confirmed` (Delivery fee quoted, Pickup Orders skip straight here), `awaiting payment` and `paid` (GCash Orders only; Cash on Delivery Orders skip both), `preparing`, `dispatched`, `delivered`, `received` (the Customer confirms they have it, ending their right to request a Return), or `cancelled`. A Customer may cancel their own Order any time before it is `dispatched`. Staff can cancel an Order up to `preparing`; a `dispatched` Order cannot be cancelled yet.
_Avoid_: Order state, fulfillment status

**Return**:
A Customer's request concerning one or more whole Order line items, identified by an RMA number, with a reason, note, evidence photos and optional video. Its statuses are Requested, Approved, Goods received, Refunded, Replaced, Declined and Cancelled by the Customer while Requested. Staff decide whether goods must come back. A Return never changes the Order's status; Refunded, Replaced and Declined are final.
_Avoid_: Refund request (when replacement is also possible), RMA (alone)

**Resolution**:
Refund or replacement for a Return. The Customer states a preference; Staff choose the final Resolution on approval, which may differ. A refund includes proof visible to the Customer and reduces Total spent; a replacement ends when Staff have sent it and does not reduce Total spent or create another Order.
_Avoid_: Outcome, store credit

**Refund window**:
The 24 hours after an Order is delivered during which the Customer may request a Return for damaged, defective or wrong items. Marking the Order received closes it early. The window binds only the request; an in-time Return remains valid however long Staff take, and Staff cannot override the window.
_Avoid_: Grace period, return deadline

**Fulfillment method**:
How a Customer's Order reaches them: Pickup (from the store, no fee) or Delivery (to one of the Customer's Addresses).
_Avoid_: Shipping method

**Delivery fee**:
The courier cost of a Delivery Order, decided by staff by hand (not calculated by this app) after the Order is `placed`, and written onto the Order when it moves to `confirmed`. A Pickup Order has no Delivery fee.
_Avoid_: Shipping fee, quote

**Payment method**:
How a Customer will pay for an Order: Cash on Delivery, settled in cash when the Order arrives, or GCash, which requires a Payment proof.
_Avoid_: Payment type

**Payment proof**:
A GCash reference number, and optionally a screenshot, a Customer submits against their Order as evidence of payment. Staff verify it in CREOMS; this app neither verifies it nor decides whether the Order is `paid`.
_Avoid_: Payment confirmation, receipt

**Catalog**:
The collection of Products that any Visitor can browse. It does not include a Cart or Orders.
_Avoid_: Inventory, storefront

**Product**:
A flavor or kind the shop sells (e.g. "Ube Halaya Smooth"), with a name, description, and images, offered in one or more Sizes. A weight-only difference is a Size of the same Product; a difference in kind (e.g. 80 vs. 120 mesh Ube Powder) is a separate Product.
_Avoid_: Item, SKU

**Size**:
A specific purchasable weight of a Product (e.g. 250g, 500g), each with its own price and its own available/sold-out flag, set by staff with no quantity tracked.
_Avoid_: Variant, option, SKU

**Cart**:
The Sizes and quantities a Visitor or Customer intends to buy, held before an Order is placed. A signed-out Visitor's Cart is kept client-side and merges into the Customer's Cart on sign-in. Checkout, and so placing an Order, requires being a Verified, complete Customer.
_Avoid_: Basket, bag

**Visitor feedback report**:
A Visitor's report of a problem or suggestion about the storefront. A report creates an issue for the shop team and does not require an Order.
_Avoid_: Order feedback, review

**Order feedback**:
A Customer's optional rating and free text about their experience with a `delivered` Order, given once, not editable afterward. Visible to the Customer on their own Order and to CREOMS, never shown publicly.
_Avoid_: Review, comment, rating (alone)

**Feedback request**:
The one email and in-app Notification sent to a Customer 2 days after an Order was Delivered, linking to that Order's Feedback form. Sent at most once per Order, with no reminder, and not sent if the Customer has already given Order feedback or the Order has no delivered at time. Each one is recorded.
_Avoid_: Survey, review request

**Delivered at**:
The moment an Order became `delivered`, recorded when it happens. Orders delivered before it was recorded have none and are never sent a Feedback request.

### Support

**Ticket**:
A Customer's request for help: a Subject, a Category, and a thread of Messages, shown to the Customer as a chat. Staff give it a Priority (Low, Normal, High, Urgent; Normal by default), may claim it (recorded as an opaque staff id plus a display-name snapshot), and may mark it Resolved. Its status is Open, Resolved or Completed; the Customer who opened it may close it (Completed) or reopen it themselves; staff answer it from CREOMS once built. A Ticket may optionally reference one of the Customer's own Orders.
_Avoid_: Support request, case, conversation (alone)

**Category**:
One of a fixed list a Ticket is filed under at creation, chosen by the Customer: Order Issue, Payment Issue, Delivery Issue, Product Question, Account, or Other. Used by staff to triage.
_Avoid_: Type, tag

**Subject**:
The short, free-text summary line a Customer gives their Ticket, distinct from its Category.
_Avoid_: Title, headline

**Message**:
One entry in a Ticket's thread, sent by the Customer or by staff, permanent once sent — never edited or deleted. A Message may carry one image attachment.
_Avoid_: Follow-up, reply, comment
