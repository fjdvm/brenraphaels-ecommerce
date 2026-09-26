import { ContentPage } from "@/components/shared/content-page";
import { tagline } from "@/lib/site/store-info";

export const metadata = { title: "Our Story" };

export default function AboutPage() {
  return (
    <ContentPage eyebrow={tagline} title="Our Story">
      <p>
        For us, Ralph and Bernice, making Ube Halaya has always been more than a
        tradition, it has been a way of bringing family together.
      </p>
      <p>
        Every Christmas and New Year, our home was filled with the aroma of
        freshly cooked ube halaya, prepared the old-fashioned way with patience,
        love, and care.
      </p>
      <p>
        In 2011, shortly after getting married, we used our wedding gifts as
        capital to start a small sideline selling homemade Ube Halaya to friends
        and workmates.
      </p>
      <p>
        Although the business lasted only six months due to the limitations of
        manual production, the dream never left us.
      </p>
      <p>
        In September 2024, we decided to revisit that dream with greater
        experience and determination.
      </p>
      <p>
        After months of product development, testing, and refinement, Bren
        Raphael&apos;s Ube Jam and Halaya was officially launched on March 30,
        2025.
      </p>
      <p>
        Named after our two sons, Bren and Raphael, our brand represents family,
        passion, and purpose.
      </p>
      <p>
        Every jar we produce carries not only premium ingredients and rich
        flavor, but also the story of a family pursuing a shared dream.
      </p>
      <p>
        Today, our vision goes beyond creating premium-quality ube products. We
        aspire to become a trusted Filipino brand both locally and
        internationally while helping create employment opportunities, support
        local communities, and provide better income opportunities for Filipino
        farmers.
      </p>
      <p>
        At Bren Raphael&apos;s, every jar represents tradition, perseverance,
        faith, and the belief that great things can grow from humble beginnings.
      </p>
      <section>
        <h2 className="font-serif text-2xl text-primary">Our Mission</h2>
        <p>
          To deliver high quality, delicious, and innovative ube products while
          preserving Filipino Tradition
        </p>
      </section>
      <section>
        <h2 className="font-serif text-2xl text-primary">Our Vision</h2>
        <p>
          To become a trusted brand for premium quality ube products locally and
          abroad.
        </p>
      </section>
    </ContentPage>
  );
}
