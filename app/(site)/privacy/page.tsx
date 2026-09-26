import { ContentPage } from "@/components/shared/content-page";
import { address, email } from "@/lib/site/store-info";

export const metadata = { title: "Privacy Policy" };

const collected = [
  "Contact details (name, address, phone number, email)",
  "Account information (email, password, delivery addresses, marketing preference)",
  "Payment information",
  "Transaction information (items viewed, purchased or returned)",
  "Communications with us",
  "Device information (IP address, browser data)",
  "Usage information (how you interact with the site)",
];

const purposes = [
  "Providing and tailoring our services",
  "Processing orders and arranging delivery",
  "Marketing and advertising, where you have opted in",
  "Security and fraud prevention",
  "Communicating with you",
  "Legal compliance",
];

const recipients = [
  "Neon, which hosts our database and sign-in service",
  "Brevo, which sends our emails",
  "Vercel, which hosts this website",
  "Couriers such as Lalamove and GrabExpress, and payment providers such as GCash",
  "Marketing partners and affiliates, where you have opted in",
  "Third parties, where you have given consent",
  "Legal authorities or in a business transaction, where the law requires it",
];

const rights = [
  "Access the personal information we hold about you",
  "Ask us to delete it",
  "Ask us to correct it",
  "Ask for a portable copy of it",
  "Manage your communication preferences",
];

function List({ items }: { items: string[] }) {
  return (
    <ul className="mt-2 list-disc space-y-1 pl-6">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export default function PrivacyPage() {
  return (
    <ContentPage eyebrow="Legal" title="Privacy Policy">
      <section>
        <h2 className="font-serif text-2xl text-primary">1. Overview</h2>
        <p>
          Bren Raphael&apos;s Ube Jam &amp; Halaya operates this store and
          website. This policy describes how we collect, use and disclose your
          personal information.
        </p>
      </section>
      <section>
        <h2 className="font-serif text-2xl text-primary">
          2. Personal Information We Collect
        </h2>
        <p>We may collect:</p>
        <List items={collected} />
      </section>
      <section>
        <h2 className="font-serif text-2xl text-primary">
          3. Where It Comes From
        </h2>
        <p>
          We collect it directly from you, automatically through our services
          and cookies, and from service providers and partners.
        </p>
      </section>
      <section>
        <h2 className="font-serif text-2xl text-primary">
          4. How We Use Information
        </h2>
        <p>We use personal information for:</p>
        <List items={purposes} />
      </section>
      <section>
        <h2 className="font-serif text-2xl text-primary">
          5. Who We Share It With
        </h2>
        <p>We do not sell or rent personal information. We may share it with:</p>
        <List items={recipients} />
      </section>
      <section>
        <h2 className="font-serif text-2xl text-primary">
          6. Third-Party Links
        </h2>
        <p>
          Our site links to other platforms. We do not guarantee and are not
          responsible for the privacy or security of those sites.
        </p>
      </section>
      <section>
        <h2 className="font-serif text-2xl text-primary">
          7. Children&apos;s Data
        </h2>
        <p>
          Our services are not intended for minors, and we do not knowingly
          collect personal information about children under the age of majority.
        </p>
      </section>
      <section>
        <h2 className="font-serif text-2xl text-primary">
          8. Security and Retention
        </h2>
        <p>
          No security measure is perfect or impenetrable. We keep personal
          information for as long as we need it to run your account and our
          services, comply with the law and resolve disputes.
        </p>
      </section>
      <section>
        <h2 className="font-serif text-2xl text-primary">9. Your Rights</h2>
        <p>Depending on where you live, you may:</p>
        <List items={rights} />
        <p className="mt-2">
          To make a request, contact us using the details below.
        </p>
      </section>
      <section>
        <h2 className="font-serif text-2xl text-primary">10. Complaints</h2>
        <p>
          You can contact us with a complaint, or lodge one with your local data
          protection authority.
        </p>
      </section>
      <section>
        <h2 className="font-serif text-2xl text-primary">
          11. International Transfers
        </h2>
        <p>
          Our service providers may process personal information outside the
          Philippines.
        </p>
      </section>
      <section>
        <h2 className="font-serif text-2xl text-primary">
          12. Changes to This Policy
        </h2>
        <p>
          We may update this Privacy Policy from time to time and will post the
          revised version on this page.
        </p>
      </section>
      <section>
        <h2 className="font-serif text-2xl text-primary">13. Contact Us</h2>
        <p>
          Email{" "}
          <a
            className="font-semibold text-primary underline"
            href={`mailto:${email}`}
          >
            {email}
          </a>
          , call +63 908 246 6856, or write to us at {address}.
        </p>
      </section>
    </ContentPage>
  );
}
