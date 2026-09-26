import Image from "next/image";

import { ContentPage } from "@/components/shared/content-page";
import { EditorialRow } from "@/components/shared/editorial-row";
import { tagline } from "@/lib/site/store-info";

export const metadata = { title: "Our Story" };

const eyebrow = "text-xs font-bold uppercase tracking-[0.2em] text-secondary";
const row =
  "border-t border-outline-variant/50 pt-12 first:border-t-0 first:pt-0";

export default function AboutPage() {
  return (
    <ContentPage eyebrow={tagline} title="Our Story" wide>
      <div className="space-y-14">
        <EditorialRow
          className={row}
          mediaSide="right"
          text={
            <div className="space-y-4">
              <p className={eyebrow}>Where it began</p>
              <p>
                For us, Ralph and Bernice, making Ube Halaya has always been
                more than a tradition, it has been a way of bringing family
                together.
              </p>
              <p>
                Every Christmas and New Year, our home was filled with the aroma
                of freshly cooked ube halaya, prepared the old-fashioned way
                with patience, love, and care.
              </p>
              <p>
                In 2011, shortly after getting married, we used our wedding
                gifts as capital to start a small sideline selling homemade Ube
                Halaya to friends and workmates.
              </p>
              <p>
                Although the business lasted only six months due to the
                limitations of manual production, the dream never left us.
              </p>
            </div>
          }
          media={
            <Image
              src="/images/about/sweet-journey.jpg"
              alt="A collage of the Bren Raphael's family and team, titled A Sweet Journey — A Story of Family, Love, Faith, and Dreams"
              width={739}
              height={525}
              sizes="(min-width: 1152px) 660px, 100vw"
              className="h-auto w-full"
            />
          }
        />
        <EditorialRow
          className={row}
          mediaSide="left"
          text={
            <div className="space-y-4">
              <p className={eyebrow}>The dream returns</p>
              <p>
                In September 2024, we decided to revisit that dream with greater
                experience and determination.
              </p>
              <p>
                After months of product development, testing, and refinement,
                Bren Raphael&apos;s Ube Jam and Halaya was officially launched
                on March 30, 2025.
              </p>
              <p>
                Named after our two sons, Bren and Raphael, our brand represents
                family, passion, and purpose.
              </p>
            </div>
          }
          media={
            <Image
              src="/images/about/brand-banner.jpg"
              alt="The Bren Raphael's logo, A Taste of Heritage, A Spoonful of Love. Premium handcrafted ube products made to bring authentic Filipino flavors closer to every home and business."
              width={739}
              height={417}
              sizes="(min-width: 1152px) 660px, 100vw"
              className="h-auto w-full"
            />
          }
        />
        <EditorialRow
          className={row}
          mediaSide="right"
          text={
            <div className="space-y-4">
              <p className={eyebrow}>Where we&apos;re headed</p>
              <p>
                Every jar we produce carries not only premium ingredients and
                rich flavor, but also the story of a family pursuing a shared
                dream.
              </p>
              <p>
                Today, our vision goes beyond creating premium-quality ube
                products. We aspire to become a trusted Filipino brand both
                locally and internationally while helping create employment
                opportunities, support local communities, and provide better
                income opportunities for Filipino farmers.
              </p>
              <p>
                At Bren Raphael&apos;s, every jar represents tradition,
                perseverance, faith, and the belief that great things can grow
                from humble beginnings.
              </p>
            </div>
          }
          media={
            <div className="grid gap-6 sm:grid-cols-2">
              <section className="border border-outline-variant/50 bg-surface-card p-6">
                <h2 className="font-serif text-2xl text-primary">
                  Our Mission
                </h2>
                <p className="mt-3">
                  To deliver high quality, delicious, and innovative ube
                  products while preserving Filipino Tradition
                </p>
              </section>
              <section className="border border-outline-variant/50 bg-surface-card p-6">
                <h2 className="font-serif text-2xl text-primary">Our Vision</h2>
                <p className="mt-3">
                  To become a trusted brand for premium quality ube products
                  locally and abroad.
                </p>
              </section>
            </div>
          }
        />
      </div>
    </ContentPage>
  );
}
