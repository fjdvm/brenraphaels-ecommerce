import { ContentPage } from "@/components/shared/content-page";
export const metadata = { title: "Privacy Policy" };
export default function PrivacyPage() {
  return (
    <ContentPage eyebrow="Legal" title="Privacy Policy">
      <section>
        <h2 className="font-serif text-2xl text-primary">
          1. Information We Collect
        </h2>
        <p>
          We collect information you provide when placing an order, creating an
          account, subscribing to updates, or contacting support. This may
          include your name, email address, phone number, shipping address, and
          payment information.
        </p>
      </section>
      <section>
        <h2 className="font-serif text-2xl text-primary">
          2. How We Use Information
        </h2>
        <p>
          We use personal information to process orders, fulfill shipments,
          communicate updates, send opted-in marketing, and improve our
          offerings.
        </p>
      </section>
      <section>
        <h2 className="font-serif text-2xl text-primary">
          3. Information Sharing
        </h2>
        <p>
          We do not sell or rent personal information. We share it only with
          trusted providers necessary to operate the business, including payment
          processors and couriers.
        </p>
      </section>
      <section>
        <h2 className="font-serif text-2xl text-primary">4. Data Security</h2>
        <p>
          We use reasonable security measures to protect personal information
          from unauthorized access, alteration, or disclosure.
        </p>
      </section>
      <section>
        <h2 className="font-serif text-2xl text-primary">5. Contact Us</h2>
        <p>
          Contact our support team if you have questions regarding this policy.
        </p>
      </section>
    </ContentPage>
  );
}
