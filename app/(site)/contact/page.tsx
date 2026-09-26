import { ContactForm } from "@/components/features/contact/contact-form";
import { ContentPage } from "@/components/shared/content-page";
import { EditorialRow } from "@/components/shared/editorial-row";
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
    <ContentPage eyebrow="Customer care" title="Contact Us" wide>
      <div className="space-y-14">
        <EditorialRow
          mediaSide="right"
          media={<ContactForm />}
          text={
            <div className="space-y-8">
              <section>
                <h2 className="font-serif text-3xl text-primary">Email</h2>
                <p className="mt-3">
                  <a
                    className="font-semibold text-primary underline"
                    href={`mailto:${email}`}
                  >
                    {email}
                  </a>
                </p>
              </section>
              <section>
                <h2 className="font-serif text-3xl text-primary">Store</h2>
                <p className="mt-3">{address}</p>
              </section>
            </div>
          }
        />
        <EditorialRow
          className="border-t border-outline-variant/50 pt-12"
          mediaSide="left"
          media={
            <section className="border border-outline-variant/50 bg-surface-card p-8">
              <h2 className="font-serif text-3xl text-primary">
                Store Schedule
              </h2>
              <ul className="mt-6 divide-y divide-outline-variant/50">
                {storeSchedule.map(({ days, hours }) => (
                  <li
                    key={days}
                    className="flex flex-wrap items-baseline justify-between gap-x-6 py-4"
                  >
                    <span>{days}</span>
                    <span className="font-serif text-xl text-primary">
                      {hours}
                    </span>
                  </li>
                ))}
                <li className="py-4 font-semibold text-secondary">
                  {closedDay}
                </li>
              </ul>
            </section>
          }
          text={
            <section>
              <h2 className="font-serif text-3xl text-primary">Phone</h2>
              <ul className="mt-3 space-y-2">
                {phones.map(({ label, number }) => (
                  <li key={label}>
                    <strong>{label}:</strong> {number}
                  </li>
                ))}
              </ul>
            </section>
          }
        />
      </div>
    </ContentPage>
  );
}
