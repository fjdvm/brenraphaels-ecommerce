import { Clock, Mail, MapPin, Phone } from "lucide-react";
import type { ReactNode } from "react";

import { AboutPageHeader } from "@/components/features/about/about-page-header";
import { PhotoTile } from "@/components/features/about/photo-tile";
import { SectionHeading } from "@/components/features/about/section-heading";
import { ContactForm } from "@/components/features/contact/contact-form";
import { address, email, phones, storeSchedule } from "@/lib/site/store-info";

export const metadata = { title: "Contact" };

const shopPlace = "Marigman St., San Roque, Antipolo";

function InfoRow({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-[18px]">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white text-primary">
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-1.5">
        <h2 className="font-serif text-[22px] leading-[1.3] text-primary">{title}</h2>
        <div className="flex flex-col leading-[1.6] tracking-[0.35px] text-body">{children}</div>
      </div>
    </div>
  );
}

const dash = (days: string) => days.replace(" - ", " – ");

export default function ContactPage() {
  return (
    <>
      <AboutPageHeader eyebrow="Customer care" title="Contact Us">
        We&apos;d love to hear from you — questions, feedback or bulk orders.
      </AboutPageHeader>

      <section className="mx-auto flex max-w-[1440px] flex-col gap-5 px-5 pb-[100px] pt-10 sm:px-10 lg:flex-row">
        <div className="flex flex-col gap-5 lg:w-[560px] lg:shrink-0">
          <div className="flex flex-col gap-7 rounded-[40px] bg-lavender-soft p-8 sm:p-11">
            <InfoRow icon={<Mail aria-hidden className="size-[22px]" strokeWidth={1.5} />} title="Email">
              <a className="w-fit text-primary hover:underline" href={`mailto:${email}`}>
                {email}
              </a>
            </InfoRow>
            <InfoRow icon={<MapPin aria-hidden className="size-[22px]" strokeWidth={1.5} />} title="Store">
              <p>{address}</p>
            </InfoRow>
            <InfoRow icon={<Phone aria-hidden className="size-[22px]" strokeWidth={1.5} />} title="Phone">
              {phones.map(({ label, number }) => (
                <p key={label}>
                  {label} · {number}
                </p>
              ))}
            </InfoRow>
          </div>
          <PhotoTile alt={`Map — ${shopPlace}`} sizes="560px" className="h-[300px]" />
        </div>
        <ContactForm />
      </section>

      <section className="mx-auto flex max-w-[1440px] flex-col gap-[30px] px-5 pb-[100px] sm:px-10">
        <SectionHeading eyebrow="Visit us" title="Store schedule" />
        <ul className="grid gap-5 md:grid-cols-3">
          {storeSchedule.map(({ days, hours }) => (
            <li
              key={days}
              className="flex flex-col items-start gap-3.5 rounded-[40px] border border-line bg-white p-10"
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-lavender text-primary">
                <Clock aria-hidden className="size-5" strokeWidth={1.5} />
              </span>
              <p className="text-xs font-medium uppercase leading-normal tracking-[0.15em] text-muted">
                {dash(days)}
              </p>
              <p className="font-serif text-3xl leading-[1.2] text-primary sm:text-[40px]">
                {dash(hours)}
              </p>
            </li>
          ))}
          <li
            data-theme="dark"
            className="flex flex-col items-start gap-3.5 rounded-[40px] bg-primary p-10 text-white"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-white text-primary">
              <Clock aria-hidden className="size-5" strokeWidth={1.5} />
            </span>
            <p className="text-xs font-medium uppercase leading-normal tracking-[0.15em] text-tertiary-fixed-dim">
              Sunday
            </p>
            <p className="font-serif text-3xl leading-[1.2] sm:text-[40px]">Closed</p>
          </li>
        </ul>
      </section>
    </>
  );
}
