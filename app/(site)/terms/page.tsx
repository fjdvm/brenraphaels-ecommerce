import { ContentPage } from "@/components/shared/content-page";
export const metadata = { title: "Terms of Service" };
export default function TermsPage() {
  return (
    <ContentPage eyebrow="Legal" title="Terms of Service">
      <section>
        <h2 className="font-serif text-2xl text-primary">1. Introduction</h2>
        <p>
          By accessing or using our website and purchasing our artisanal
          products, you agree to these Terms of Service.
        </p>
      </section>
      <section>
        <h2 className="font-serif text-2xl text-primary">
          2. Products &amp; Orders
        </h2>
        <p>
          Products are subject to availability, and orders are subject to
          confirmation before processing. We may limit quantities per customer
          or order.
        </p>
      </section>
      <section>
        <h2 className="font-serif text-2xl text-primary">
          3. Pricing &amp; Payment
        </h2>
        <p>
          Prices may change without notice. We accept Cash on Delivery (COD)
          and GCash.
        </p>
      </section>
      <section>
        <h2 className="font-serif text-2xl text-primary">
          4. Perishable Product Handling
        </h2>
        <p>
          Our ube jam and halaya are perishable. Please ensure someone can
          receive deliveries promptly, and follow the storage guidance in our
          FAQ.
        </p>
      </section>
      <section>
        <h2 className="font-serif text-2xl text-primary">5. Governing Law</h2>
        <p>
          These terms are governed by the laws of the Republic of the
          Philippines.
        </p>
      </section>
    </ContentPage>
  );
}
