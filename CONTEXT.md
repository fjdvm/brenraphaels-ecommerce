# Bren Raphael's Storefront

The online shop where people buy Bren Raphael's Ube Jam & Halaya. This context covers how people become Customers, prove they own their email, keep their personal details, browse products, place and pay for Orders, and give Feedback. This context is Customer-facing only: it has no staff or admin UI, and it shares no data, accounts, or vocabulary with the [Careers](./app/(careers)/CONTEXT.md) context living alongside it in this same app — see [Context Map](./CONTEXT-MAP.md). A Customer and an Applicant are unrelated identities, even for the same person.

CREOMS (Customer Relationship & E-commerce Ordering Management System) is a separate application, with its own database and its own auth, built later. It manages Orders from the staff side (quoting delivery fees, verifying payment, advancing status). This app and CREOMS integrate over an API/webhook, not a shared database — this app owns and remains the source of truth for Order data.

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
Where an Order is in its lifecycle: `placed`, `confirmed` (Delivery fee quoted, Pickup Orders skip straight here), `awaiting payment` and `paid` (GCash Orders only; Cash on Delivery Orders skip both), `preparing`, `dispatched`, `delivered`, or `cancelled`. A Customer may cancel their own Order any time before it is `dispatched`; cancellation past that point is staff-only, in CREOMS.
_Avoid_: Order state, fulfillment status

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

**Product**:
A flavor or kind the shop sells (e.g. "Ube Halaya Smooth"), with a name, description, and images, offered in one or more Sizes. A weight-only difference is a Size of the same Product; a difference in kind (e.g. 80 vs. 120 mesh Ube Powder) is a separate Product.
_Avoid_: Item

**Size**:
A specific purchasable weight of a Product (e.g. 250g, 500g), each with its own price and its own available/sold-out flag, set by staff with no quantity tracked.
_Avoid_: Variant, SKU

**Cart**:
The Sizes and quantities a Visitor or Customer intends to buy, held before an Order is placed. A signed-out Visitor's Cart is kept client-side and merges into the Customer's Cart on sign-in. Checkout, and so placing an Order, requires being a Verified, complete Customer.
_Avoid_: Basket, bag

**Feedback**:
A Customer's optional rating and free text about their experience with a `delivered` Order, given once, not editable afterward. Visible to the Customer on their own Order and to CREOMS, never shown publicly.
_Avoid_: Review, comment, rating (alone)
