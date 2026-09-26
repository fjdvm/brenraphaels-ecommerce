import Image from "next/image";
import type { ReactNode } from "react";

import { ContentPage } from "@/components/shared/content-page";
import { EditorialRow } from "@/components/shared/editorial-row";
import { YouTubeVideo } from "@/components/shared/youtube-video";
import { tagline } from "@/lib/site/store-info";

export const metadata = { title: "Our Journey" };

function Photo({
  src,
  alt,
  width,
  height,
  className,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes="(min-width: 1152px) 660px, 100vw"
      className={className ?? "h-auto w-full"}
    />
  );
}

/** One story: its text on one side and its photos on the other, flipping down the page. */
function Story({
  title,
  mediaSide,
  photos,
  children,
}: {
  title: string;
  mediaSide: "left" | "right";
  photos: ReactNode;
  children: ReactNode;
}) {
  return (
    <EditorialRow
      className="border-t border-outline-variant/50 pt-12"
      mediaSide={mediaSide}
      text={
        <>
          <h3 className="font-serif text-3xl leading-snug text-primary">
            {title}
          </h3>
          <p className="mt-4">{children}</p>
        </>
      }
      media={<div className="space-y-4">{photos}</div>}
    />
  );
}

export default function JourneyPage() {
  return (
    <ContentPage eyebrow={tagline} title="Our Journey" wide>
      <p className="max-w-3xl italic">
        Every step, every partnership, and every feature tells our story.
      </p>
      <section className="space-y-14 pt-8">
        <h2 className="font-serif text-3xl text-primary">
          Strategic Partnerships
        </h2>
        <Story
          title="Bren Raphael's Collaboration with Kota Paradiso"
          mediaSide="right"
          photos={
            <Photo
              src="/images/journey/kota-paradiso.jpg"
              alt="The Bren Raphael's team in purple shirts posing with hand signs after planting ube seedlings at Kota Paradiso"
              width={1200}
              height={1600}
              className="mx-auto h-auto w-full max-w-sm"
            />
          }
        >
          We visited Kota Paradiso for the sustainable sourcing of our premium
          raw ube, and took part in planting ube seedlings.
        </Story>
        <Story
          title="Building Partnerships with ASHI and Local Farmers"
          mediaSide="left"
          photos={
            <>
              <Photo
                src="/images/journey/ashi-meeting.jpg"
                alt="Two group photos of the Bren Raphael's team with ASHI representatives and local farmers, outdoors and in a meeting room"
                width={1290}
                height={1111}
              />
              <Photo
                src="/images/journey/ashi-farmers.jpg"
                alt="A collage of local farmers and the Bren Raphael's team examining freshly harvested purple yam"
                width={1092}
                height={626}
              />
            </>
          }
        >
          We recently met with the Business Development Department of Ahon Sa
          Hirap, Inc. (ASHI), together with local farmers, through DTI OIC PD
          coordination.
        </Story>
      </section>
      <section className="space-y-14 pt-16">
        <div>
          <h2 className="font-serif text-3xl text-primary">
            Events &amp; Features
          </h2>
          <p className="mt-2 italic">
            From local showcases to national features.
          </p>
        </div>
        <Story
          title="Tatak Pinoy Expo 2026"
          mediaSide="right"
          photos={
            <>
              <Photo
                src="/images/journey/tatak-pinoy-1.jpg"
                alt="The Bren Raphael's team at their Tatak Pinoy Expo 2026 booth, beside the price list and displays of purple yam, jars and pouches"
                width={1600}
                height={1066}
              />
              <Photo
                src="/images/journey/tatak-pinoy-2.jpg"
                alt="Three team members at the Tatak Pinoy Expo 2026 booth in front of shelves of Bren Raphael's Ube Jam and Ube Halaya"
                width={1600}
                height={1066}
              />
            </>
          }
        >
          Bren Raphael&apos;s Ube Jam &amp; Halaya was honored to be part of the
          Tatak Pinoy Expo 2026, showcasing proudly Filipino products on a
          national stage alongside leading industries and MSMEs.
        </Story>
        <Story
          title="Featured on Agripreneur"
          mediaSide="left"
          photos={
            <>
              <Photo
                src="/images/journey/agripreneur-1.jpg"
                alt="The Bren Raphael's team in purple uniforms on Agripreneur, with Ralph at the front"
                width={1290}
                height={712}
              />
              <Photo
                src="/images/journey/agripreneur-2.jpg"
                alt="Bernice holding two jars of Ube Jam, with the team behind her, on Agripreneur"
                width={1290}
                height={714}
              />
            </>
          }
        >
          Agripreneur is a television program that highlights inspiring Filipino
          farmers and agribusinesses.
        </Story>
        <div className="border-t border-outline-variant/50 pt-12">
          <h3 className="font-serif text-3xl text-primary">Media Features</h3>
          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <div className="space-y-3">
              <p>Halukay Ube with Sexbomb Monic | Unang Hirit</p>
              <YouTubeVideo
                id="dGstTnnsdFo"
                title="Halukay Ube with Sexbomb Monic | Unang Hirit"
              />
            </div>
            <div className="space-y-3">
              <p>Ultimate ube food trip sa Antipolo | Gud Morning Kapatid</p>
              <YouTubeVideo
                id="iGeXYtSVtMk"
                title="Ultimate ube food trip sa Antipolo | Gud Morning Kapatid"
              />
            </div>
          </div>
        </div>
      </section>
    </ContentPage>
  );
}
