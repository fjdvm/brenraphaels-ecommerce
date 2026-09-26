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
            </div>
          }
        />
        <section className="border-t border-outline-variant/50 pt-12">
          <h2 className="font-serif text-3xl text-primary">Store Schedule</h2>
          <ul className="mt-8 grid gap-6 sm:grid-cols-3">
            {storeSchedule.map(({ days, hours }) => (
              <li
                key={days}
                className="border border-outline-variant/50 bg-surface-card p-8"
              >
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-secondary">
                  {days}
                </p>
                <p className="mt-3 font-serif text-3xl text-primary">{hours}</p>
              </li>
            ))}
            <li className="flex items-center border border-outline-variant/50 bg-primary p-8">
              <p className="font-serif text-3xl text-white">{closedDay}</p>
            </li>
          </ul>
        </section>
      </div>
    </ContentPage>
  );
}
