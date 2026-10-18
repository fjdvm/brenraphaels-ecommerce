import { AboutCta } from "@/components/features/about/about-cta";
import { AboutPageHeader } from "@/components/features/about/about-page-header";
import { EventsCarousel } from "@/components/features/about/events-carousel";
import { MediaCard } from "@/components/features/about/media-card";
import { PartnershipsCarousel } from "@/components/features/about/partnerships-carousel";
import { SectionHeading } from "@/components/features/about/section-heading";
import { socialLinks } from "@/lib/site/store-info";

export const metadata = { title: "Our Journey" };

const partnerships = [
  {
    src: "/images/journey/kota-paradiso.jpg",
    alt: "The Bren Raphael's team in purple shirts posing with hand signs after planting ube seedlings at Kota Paradiso",
    title: "Bren Raphael's collaboration with Kota Paradiso",
    text: "We visited Kota Paradiso for the sustainable sourcing of our premium raw ube, and took part in planting ube seedlings.",
  },
  {
    src: "/images/journey/ashi-meeting.jpg",
    alt: "Two group photos of the Bren Raphael's team with ASHI representatives and local farmers, outdoors and in a meeting room",
    title: "Building partnerships with ASHI and local farmers",
    text: "We recently met with the Business Development Department of Ahon Sa Hirap, Inc. (ASHI), together with local farmers, through DTI OIC PD coordination.",
  },
  {
    src: "/images/journey/ashi-farmers.jpg",
    alt: "A collage of local farmers and the Bren Raphael's team examining freshly harvested purple yam",
    title: "Building partnerships with ASHI and local farmers",
    text: "We recently met with the Business Development Department of Ahon Sa Hirap, Inc. (ASHI), together with local farmers, through DTI OIC PD coordination.",
  },
];

const tatakPinoy = {
  badge: "2026",
  title: "Tatak Pinoy Expo 2026",
  text: "Honored to showcase proudly Filipino products on a national stage alongside leading industries and MSMEs.",
};

const agripreneur = {
  badge: "On TV",
  title: "Featured on Agripreneur",
  text: "Agripreneur is a television program that highlights inspiring Filipino farmers and agribusinesses.",
};

const events = [
  {
    ...tatakPinoy,
    src: "/images/journey/tatak-pinoy-1.jpg",
    alt: "The Bren Raphael's team at their Tatak Pinoy Expo 2026 booth, beside the price list and displays of purple yam, jars and pouches",
  },
  {
    ...tatakPinoy,
    src: "/images/journey/tatak-pinoy-2.jpg",
    alt: "Three team members at the Tatak Pinoy Expo 2026 booth in front of shelves of Bren Raphael's Ube Jam and Ube Halaya",
  },
  {
    ...agripreneur,
    src: "/images/journey/agripreneur-1.jpg",
    alt: "The Bren Raphael's team in purple uniforms on Agripreneur, with Ralph at the front",
  },
  {
    ...agripreneur,
    src: "/images/journey/agripreneur-2.jpg",
    alt: "Bernice holding two jars of Ube Jam, with the team behind her, on Agripreneur",
  },
];

export default function JourneyPage() {
  return (
    <div className="bg-surface">
      <AboutPageHeader title="Our Journey">
        Every step, every partnership and every feature tells our story.
      </AboutPageHeader>

      <section className="mx-auto max-w-[1440px] px-5 pb-[100px] pt-10 sm:px-10">
        <PartnershipsCarousel items={partnerships} />
      </section>

      <section className="mx-auto max-w-[1440px] px-5 pb-[100px] sm:px-10">
        <EventsCarousel items={events} />
      </section>

      <section className="bg-[#f3f0f6]">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-10 px-5 py-[100px] sm:px-10">
          <SectionHeading eyebrow="On air" title="Media features" />
          <div className="grid gap-5 lg:grid-cols-2">
            <MediaCard
              id="dGstTnnsdFo"
              thumbnail="/images/journey/video-dGstTnnsdFo.jpg"
              title="Halukay Ube with Sexbomb Monic | Unang Hirit"
              kicker="GMA · Unang Hirit"
              headline="Halukay Ube with Sexbomb Monic"
              fallbackHref={socialLinks[0].href}
            />
            <MediaCard
              id="1NdE5vCMzPo"
              thumbnail="/images/home/video-1NdE5vCMzPo.jpg"
              title="DTI: Asenso Pilipino S3 EP1 — Ube World Domination: Mag-asawa, Umasenso Dahil sa Ube"
              kicker="DTI: Asenso Pilipino · S3 EP1"
              headline="Ube World Domination: Mag-asawa, Umasenso Dahil sa Ube"
              fallbackHref={socialLinks[0].href}
            />
          </div>
        </div>
      </section>

      <div className="pt-[100px]">
        <AboutCta />
      </div>
    </div>
  );
}
