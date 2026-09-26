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
          Products are subject to availability. Our ube jam and halaya are
          handcrafted in small batches, and we may limit quantities per customer
          or order.
        </p>
      </section>
      <section>
        <h2 className="font-serif text-2xl text-primary">
          3. Pricing &amp; Payment
        </h2>
        <p>
          Prices may change without notice. Payment must be completed when
          placing an order through a supported payment method.
        </p>
      </section>
      <section>
        <h2 className="font-serif text-2xl text-primary">
          4. Perishable Product Handling
        </h2>
        <p>
          Our products contain real dairy and no artificial preservatives.
          Please ensure someone can receive and refrigerate deliveries promptly.
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
