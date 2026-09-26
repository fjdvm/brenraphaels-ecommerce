import { ContentPage } from "@/components/shared/content-page";
export const metadata = { title: "Return & Refund Policy" };
export default function ReturnsPage() {
  return (
    <ContentPage eyebrow="Customer care" title="Return & Refund Policy">
      <section>
        <h2 className="font-serif text-2xl text-primary">
          1. Perishable Goods Policy
        </h2>
        <p>
          Because our artisanal Ube Jam and Halaya are perishable, we cannot
          accept returns after delivery.
        </p>
      </section>
      <section>
        <h2 className="font-serif text-2xl text-primary">
          2. Damaged or Defective Items
        </h2>
        <p>
          If a shipment arrives damaged, unsealed, or compromised, notify us
          within 24 hours and include photos of the container and packaging.
        </p>
      </section>
      <section>
        <h2 className="font-serif text-2xl text-primary">
          3. Refunds &amp; Replacements
        </h2>
        <p>
          After a valid claim for damaged goods or a fulfillment error is
          verified, we will issue a refund or send a fresh replacement.
        </p>
      </section>
      <section>
        <h2 className="font-serif text-2xl text-primary">
          4. Order Cancellation
        </h2>
        <p>
          Orders may be cancelled within two hours of placement or before
          fulfillment begins. Once handed to a courier, they can no longer be
          cancelled.
        </p>
      </section>
    </ContentPage>
  );
}
