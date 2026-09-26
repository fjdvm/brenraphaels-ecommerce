import type { ReactNode } from "react";

import { ContentPage } from "@/components/shared/content-page";
import { DepthCarousel } from "@/components/shared/depth-carousel";
import { YouTubeVideo } from "@/components/shared/youtube-video";
import { tagline } from "@/lib/site/store-info";

export const metadata = { title: "Our Journey" };

const eyebrow = "text-xs font-bold uppercase tracking-[0.2em] text-secondary";

/** The text beside a card: the story's title and what happened. */
function StoryText({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <>
      <h3 className="font-serif text-2xl leading-snug text-primary sm:text-3xl">
        {title}
      </h3>
      <p className="mt-4">{children}</p>
    </>
  );
}

const kotaParadiso = (
  <StoryText title="Bren Raphael's Collaboration with Kota Paradiso">
    We visited Kota Paradiso for the sustainable sourcing of our premium raw
    ube, and took part in planting ube seedlings.
  </StoryText>
);

const ashi = (
  <StoryText title="Building Partnerships with ASHI and Local Farmers">
    We recently met with the Business Development Department of Ahon Sa Hirap,
    Inc. (ASHI), together with local farmers, through DTI OIC PD coordination.
  </StoryText>
);

const tatakPinoy = (
  <StoryText title="Tatak Pinoy Expo 2026">
    Bren Raphael&apos;s Ube Jam &amp; Halaya was honored to be part of the Tatak
    Pinoy Expo 2026, showcasing proudly Filipino products on a national stage
    alongside leading industries and MSMEs.
  </StoryText>
);

const agripreneur = (
  <StoryText title="Featured on Agripreneur">
    Agripreneur is a television program that highlights inspiring Filipino
    farmers and agribusinesses.
  </StoryText>
);

const mediaFeatures = [
  {
    id: "dGstTnnsdFo",
    title: "Halukay Ube with Sexbomb Monic | Unang Hirit",
  },
  {
    id: "iGeXYtSVtMk",
    title: "Ultimate ube food trip sa Antipolo | Gud Morning Kapatid",
  },
];

export default function JourneyPage() {
  return (
    <ContentPage eyebrow={tagline} title="Our Journey" wide>
      <p className="max-w-3xl italic">
        Every step, every partnership, and every feature tells our story.
      </p>
      <div className="space-y-20 pt-8">
        <DepthCarousel
          label="Strategic partnerships"
          mediaSide="right"
          cardWidth={440}
          cardHeight={330}
          intro={
            <h2 className="font-serif text-4xl text-primary">
              Strategic Partnerships
            </h2>
          }
          items={[
            {
              key: "kota-paradiso",
              src: "/images/journey/kota-paradiso.jpg",
              alt: "The Bren Raphael's team in purple shirts posing with hand signs after planting ube seedlings at Kota Paradiso",
              text: kotaParadiso,
            },
            {
              key: "ashi-meeting",
              src: "/images/journey/ashi-meeting.jpg",
              alt: "Two group photos of the Bren Raphael's team with ASHI representatives and local farmers, outdoors and in a meeting room",
              text: ashi,
            },
            {
              key: "ashi-farmers",
              src: "/images/journey/ashi-farmers.jpg",
              alt: "A collage of local farmers and the Bren Raphael's team examining freshly harvested purple yam",
              text: ashi,
            },
          ]}
        />
        <div className="border-t border-outline-variant/50 pt-16">
          <DepthCarousel
            label="Events and features"
            mediaSide="left"
            cardWidth={440}
            cardHeight={330}
            intro={
              <>
                <h2 className="font-serif text-4xl text-primary">
                  Events &amp; Features
                </h2>
                <p className="mt-3 italic">
                  From local showcases to national features.
                </p>
              </>
            }
            items={[
              {
                key: "tatak-pinoy-1",
                src: "/images/journey/tatak-pinoy-1.jpg",
                alt: "The Bren Raphael's team at their Tatak Pinoy Expo 2026 booth, beside the price list and displays of purple yam, jars and pouches",
                text: tatakPinoy,
              },
              {
                key: "tatak-pinoy-2",
                src: "/images/journey/tatak-pinoy-2.jpg",
                alt: "Three team members at the Tatak Pinoy Expo 2026 booth in front of shelves of Bren Raphael's Ube Jam and Ube Halaya",
                text: tatakPinoy,
              },
              {
                key: "agripreneur-1",
                src: "/images/journey/agripreneur-1.jpg",
                alt: "The Bren Raphael's team in purple uniforms on Agripreneur, with Ralph at the front",
                text: agripreneur,
              },
              {
                key: "agripreneur-2",
                src: "/images/journey/agripreneur-2.jpg",
                alt: "Bernice holding two jars of Ube Jam, with the team behind her, on Agripreneur",
                text: agripreneur,
              },
            ]}
          />
        </div>
        <div className="border-t border-outline-variant/50 pt-16">
          <DepthCarousel
            label="Media features"
            mediaSide="right"
            cardWidth={480}
            cardHeight={270}
            intro={
              <>
                <p className={eyebrow}>On air</p>
                <h2 className="mt-3 font-serif text-4xl text-primary">
                  Media Features
                </h2>
              </>
            }
            items={mediaFeatures.map(({ id, title }) => ({
              key: id,
              src: `/images/journey/video-${id}.jpg`,
              alt: title,
              text: (
                <h3 className="font-serif text-2xl leading-snug text-primary sm:text-3xl">
                  {title}
                </h3>
              ),
              player: <YouTubeVideo id={id} title={title} autoplay />,
            }))}
          />
        </div>
      </div>
    </ContentPage>
  );
}
