import { ContactForm } from "@/components/features/contact/contact-form";
import { ContentPage } from "@/components/shared/content-page";
import {
  address,
  closedDay,
  email,
  phones,
  storeSchedule,
} from "@/lib/site/store-info";

export const metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <ContentPage eyebrow="Customer care" title="Contact Us">
      <ContactForm />
      <section>
        <h2 className="font-serif text-2xl text-primary">Store</h2>
        <p>{address}</p>
      </section>
      <section>
        <h2 className="font-serif text-2xl text-primary">Email</h2>
        <p>
          <a
            className="font-semibold text-primary underline"
            href={`mailto:${email}`}
          >
            {email}
          </a>
        </p>
      </section>
      <section>
        <h2 className="font-serif text-2xl text-primary">Phone</h2>
        <ul className="space-y-1">
          {phones.map(({ label, number }) => (
            <li key={label}>
              <strong>{label}:</strong> {number}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="font-serif text-2xl text-primary">Store Schedule</h2>
        <ul className="space-y-1">
          {storeSchedule.map(({ days, hours }) => (
            <li key={days}>
              {days} = {hours}
            </li>
          ))}
          <li className="font-semibold">{closedDay}</li>
        </ul>
      </section>
    </ContentPage>
  );
}
