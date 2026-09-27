# Delivery fee is quoted by hand after the Order is placed, not calculated at checkout

The live storefront already prices delivery this way: fees vary by location and the site tells Customers their order needs confirmation before it's processed. We kept that process rather than building a fixed fee table by city/province or integrating a live Lalamove/GrabExpress quote API. A Delivery Order is therefore placed with its Delivery fee (and so its true total) unknown; a fee is decided by a human and written onto the Order once it moves to `confirmed`, and the Customer is emailed when that happens. Pickup Orders have no Delivery fee and skip straight to `confirmed`.

## Consequences

- Checkout shows an items subtotal only for Delivery Orders, not a final total; the UI and its copy must make clear the total is still pending, not a bug.
- A Customer commits to an Order (and, for GCash, will later submit Payment proof) before knowing the full amount they owe — GCash Payment proof is deliberately deferred to after `confirmed` for this reason (see CONTEXT.md's Payment proof entry).
- Nothing in this app computes or validates a Delivery fee; a wrong or missing fee is entirely a staff-side (CREOMS) concern.
- Moving to a fixed fee table or a live courier quote later means checkout can show a real total upfront and Delivery Orders could skip `confirmed` as a separate step — a real change to the state machine and the checkout UI, not a config tweak.
- Fee-quoting turnaround time is an operational cost outside this app's control; slow quoting directly delays every downstream email and the Customer's ability to pay.
