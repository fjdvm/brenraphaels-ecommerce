import type { ReactNode } from "react";

import { AboutCta } from "@/components/features/about/about-cta";
import { AboutPageHeader } from "@/components/features/about/about-page-header";
import { PhotoShade, PhotoTile } from "@/components/features/about/photo-tile";
import { eyebrowClass } from "@/components/features/about/section-heading";

export const metadata = { title: "Our Story" };

const sectionClass = "mx-auto flex max-w-[1440px] flex-col gap-[50px] px-5 pt-16 sm:px-10 lg:pt-[100px]";
const chapterTitleClass =
  "font-serif text-5xl leading-[1.1] text-primary sm:text-6xl lg:text-[72px]";

/** A numbered chapter: its eyebrow and headline year on the left, the story on the right. */
function Chapter({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:gap-[60px]">
      <div className="flex flex-col gap-3 lg:w-[420px] lg:shrink-0">
        <p className={eyebrowClass}>{eyebrow}</p>
        <h2 className={chapterTitleClass}>{title}</h2>
      </div>
      <div className="flex flex-col gap-5 leading-[1.6] tracking-[0.35px] text-body lg:flex-1">
        {children}
      </div>
    </div>
  );
}

/** A wide photo beside a narrower one. */
function PhotoPair({ wide, narrow }: { wide: ReactNode; narrow: ReactNode }) {
  return (
    <div className="flex flex-col gap-5 lg:flex-row">
      {wide}
      {narrow}
    </div>
  );
}

const wideClass = "h-[320px] sm:h-[520px] lg:flex-1";
const narrowClass = "h-[320px] sm:h-[520px] lg:w-[440px] lg:shrink-0";

export default function AboutPage() {
  return (
    <div className="bg-surface">
      <AboutPageHeader title="Our Story">
        Named after our two sons, Bren and Raphael — our brand represents
        family, passion and purpose.
      </AboutPageHeader>

      <section className="mx-auto max-w-[1440px] px-5 sm:px-10">
        <PhotoTile
          src="/images/about/sweet-journey.jpg"
          alt="A collage of the Bren Raphael's family and team"
          sizes="(min-width: 1440px) 1360px, 100vw"
          priority
          className="h-[420px] sm:h-[620px]"
        >
          <PhotoShade />
          <h2 className="absolute inset-x-6 bottom-8 font-serif text-3xl leading-[1.2] text-white sm:inset-x-[60px] sm:bottom-[60px] sm:text-5xl lg:max-w-[835px] lg:text-[54px]">
            A sweet journey — a story of family, love, faith and dreams.
          </h2>
        </PhotoTile>
      </section>

      <section className={sectionClass}>
        <Chapter eyebrow="01 · Where it began" title="2011">
          <p>
            For us, Ralph and Bernice, making Ube Halaya has always been more
            than a tradition — it has been a way of bringing family together.
          </p>
          <p>
            Every Christmas and New Year, our home was filled with the aroma of
            freshly cooked ube halaya, prepared the old-fashioned way with
            patience, love and care.
          </p>
          <p>
            In 2011, shortly after getting married, we used our wedding gifts as
            capital to start a small sideline selling homemade Ube Halaya to
            friends and workmates. Although the business lasted only six months
            due to the limitations of manual production, the dream never left
            us.
          </p>
        </Chapter>
        <PhotoPair
          wide={
            <PhotoTile
              src="/images/about/jam-and-powder.jpg"
              alt="Ube jam jars and a bowl of ube powder on a wooden table among purple yams"
              sizes="(min-width: 1024px) 900px, 100vw"
              className={wideClass}
            />
          }
          narrow={
            <PhotoTile
              src="/images/home/ube-halaya.jpg"
              alt="A pouch of Smooth Ube Halaya beside a tub of freshly made halaya, ube powder and sliced purple yam"
              sizes="(min-width: 1024px) 440px, 100vw"
              className={narrowClass}
            />
          }
        />
      </section>

      <section className={sectionClass}>
        <Chapter eyebrow="02 · The dream returns" title="2024 – 2025">
          <p>
            In September 2024, we decided to revisit that dream with greater
            experience and determination.
          </p>
          <p>
            After months of product development, testing and refinement, Bren
            Raphael&apos;s Ube Jam and Halaya was officially launched on March
            30, 2025.
          </p>
        </Chapter>
        <PhotoPair
          wide={
            <PhotoTile
              src="/images/about/brand-banner.jpg"
              alt="Bren Raphael's launch — logo & products"
              sizes="(min-width: 1024px) 900px, 100vw"
              className={wideClass}
            />
          }
          narrow={
            <PhotoTile
              src="/images/home/hero-products.jpg"
              alt="Ube jam & halaya jars"
              sizes="(min-width: 1024px) 440px, 100vw"
              className={narrowClass}
            />
          }
        />
      </section>

      <section className={`${sectionClass} pb-[100px]`}>
        <Chapter eyebrow="03 · Where we're headed" title="Today">
          <p>
            Every jar we produce carries not only premium ingredients and rich
            flavor, but also the story of a family pursuing a shared dream.
          </p>
          <p>
            Our vision goes beyond creating premium-quality ube products. We
            aspire to become a trusted Filipino brand both locally and
            internationally — while helping create employment opportunities,
            support local communities, and provide better income for Filipino
            farmers.
          </p>
          <p>
            At Bren Raphael&apos;s, every jar represents tradition,
            perseverance, faith, and the belief that great things can grow from
            humble beginnings.
          </p>
        </Chapter>
        <figure className="flex flex-col gap-4 bg-primary p-8 sm:p-[60px]">
          <blockquote className="font-serif text-3xl leading-[1.2] text-white sm:text-5xl lg:text-[54px]">
            “Great things can grow <br className="hidden lg:block" />
            from humble beginnings.”
          </blockquote>
          <figcaption className="leading-[1.6] tracking-[0.35px] text-[#c9a8f0]">
            — Ralph &amp; Bernice, founders
          </figcaption>
        </figure>
      </section>

      <AboutCta />
    </div>
  );
}
