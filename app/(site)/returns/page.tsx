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
          accept returns for a change of mind.
        </p>
      </section>
      <section>
        <h2 className="font-serif text-2xl text-primary">
          2. Damaged, Defective or Wrong Items
        </h2>
        <p>
          If an item arrives damaged, defective, or is not what you ordered,
          you can report it from My orders within 24 hours of delivery. Include
          photos of the item and its packaging, and a short video if you have
          one.
        </p>
        <p>
          Our Staff check the batch code and expiry date on the item, and
          compare it against the retention sample we keep for every batch.
        </p>
        <p>
          Marking your order as received ends the 24-hour window, so please
          check your items before you do.
        </p>
      </section>
      <section>
        <h2 className="font-serif text-2xl text-primary">
          3. Refunds, Replacements &amp; Disposal
        </h2>
        <p>
          Once your report is verified, we will issue a refund or send a fresh
          replacement. Damaged goods are disposed of for food safety, so they
          usually do not come back to us. You do not need to ship them back.
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
