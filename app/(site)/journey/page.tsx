import { ContentPage } from "@/components/shared/content-page";
import { tagline } from "@/lib/site/store-info";

export const metadata = { title: "Our Journey" };

export default function JourneyPage() {
  return (
    <ContentPage eyebrow={tagline} title="Our Journey">
      <p className="italic">
        Every step, every partnership, and every feature tells our story.
      </p>
      <section className="space-y-6">
        <h2 className="font-serif text-3xl text-primary">
          Strategic Partnerships
        </h2>
        <article>
          <h3 className="font-serif text-2xl text-primary">
            Bren Raphael&apos;s Collaboration with Kota Paradiso
          </h3>
          <p className="mt-2">
            We visited Kota Paradiso for the sustainable sourcing of our premium
            raw ube, and took part in planting ube seedlings.
          </p>
        </article>
        <article>
          <h3 className="font-serif text-2xl text-primary">
            Building Partnerships with ASHI and Local Farmers
          </h3>
          <p className="mt-2">
            We recently met with the Business Development Department of Ahon Sa
            Hirap, Inc. (ASHI), together with local farmers, through DTI OIC PD
            coordination.
          </p>
        </article>
      </section>
      <section className="space-y-6">
        <h2 className="font-serif text-3xl text-primary">Events &amp; Features</h2>
        <p className="italic">From local showcases to national features.</p>
        <article>
          <h3 className="font-serif text-2xl text-primary">
            Tatak Pinoy Expo 2026
          </h3>
          <p className="mt-2">
            Bren Raphael&apos;s Ube Jam &amp; Halaya was honored to be part of
            the Tatak Pinoy Expo 2026, showcasing proudly Filipino products on a
            national stage alongside leading industries and MSMEs.
          </p>
        </article>
        <article>
          <h3 className="font-serif text-2xl text-primary">
            Featured on Agripreneur
          </h3>
          <p className="mt-2">
            Agripreneur is a television program that highlights inspiring
            Filipino farmers and agribusinesses.
          </p>
        </article>
        <article>
          <h3 className="font-serif text-2xl text-primary">Media Features</h3>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Halukay Ube with Sexbomb Monic | Unang Hirit</li>
            <li>Ultimate ube food trip sa Antipolo | Gud Morning Kapatid</li>
          </ul>
        </article>
      </section>
    </ContentPage>
  );
}
