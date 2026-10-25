import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import {
  Bestsellers,
  BestsellersFallback,
} from "@/components/features/home/bestsellers";
import { Reveal } from "@/components/shared/reveal";
import { KindWords } from "@/components/features/home/kind-words";
import { VideoCard } from "@/components/features/home/video-card";
import { WelcomeModal } from "@/components/features/home/welcome-modal";
import { completeProfilePath } from "@/lib/auth/route-access";
import { currentVisitor } from "@/lib/customer/current-visitor";
import { tagline } from "@/lib/site/store-info";

const recognitionVideos = [
  {
    id: "1NdE5vCMzPo",
    title:
      "UBE WORLD DOMINATION: Mag-Asawa, Umasenso Dahil sa Ube | DTI: Asenso Pilipino S3EP1",
    kicker: "DTI: Asenso Pilipino \u00b7 S3 EP1",
    headline: "Ube World Domination: Mag-asawa, Umasenso Dahil sa Ube",
  },
  {
    id: "7kh6RzlDcH4",
    title:
      "PATOK na NEGOSYO | ONE of the BIGGEST MAKER of UBE JAM & HALAYA in Philippines | KAFOODTRIP",
    kicker: "Kafoodtrip",
    headline:
      "Patok na Negosyo: One of the Biggest Makers of Ube Jam & Halaya in the Philippines",
  },
  {
    id: "ihuFz1MJPDA",
    title:
      "KUMITA AT YUMAMAN SA PAGGAWA NG UBE! | My Puhunan: Kaya Mo! | ABS-CBN News",
    kicker: "ABS-CBN News \u00b7 My Puhunan: Kaya Mo!",
    headline: "Kumita at Yumaman sa Paggawa ng Ube!",
  },
];

const customerMessages = [
  {
    src: "/images/home/customer-rita-daniela.jpg",
    place: "A business chat from missritadaniela",
    quote: "SOOOO GOOD! Definitely!!!",
    alt: 'A business chat from missritadaniela reading "SOOOO GOOD!", then "Definitely!!!" after Bren Raphael\'s replied "Thank you so much mam!"',
  },
  {
    src: "/images/home/customer-saudi-arabia.jpg",
    place: "A customer in Saudi Arabia",
    quote: "Hi, nadala ko na sya dito sa saudi. Thank you! Ang sarap!!!!",
    alt: 'A customer\'s message with a photo of a pouch of Smooth Ube Halaya: "Hi, nadala ko na sya dito sa saudi. Thank you! Ang sarap!!!!"',
  },
  {
    src: "/images/home/customer-germany.jpg",
    place: "A customer in Germany",
    quote:
      "Nakarating po ng germany ung Ube. Sayang 2 lang nabili ko sa SM north",
    alt: 'A customer\'s message with a photo of Ube Halaya: "Nakarating po ng germany ung Ube. Sayang 2 lang nabili ko sa SM north"',
  },
  {
    src: "/images/home/customer-france.jpg",
    place: "A customer in France",
    quote:
      "Sobrang sarap po sa mga Ube lover like me - 1 of the best!.. How to order po?",
    alt: 'A customer\'s message from France with a photo of Ube Halaya with Tidbits: "Sobrang sarap po sa mga Ube lover like me - 1 of the best!.. How to order po?"',
  },
];

const featuredPress = [
  "DTI \u00b7 Asenso Pilipino",
  "GMA \u00b7 Unang Hirit",
  "Tatak Pinoy Expo 2026",
  "Kota Paradiso",
];

const collections = [
  {
    title: "Ube Halaya",
    eyebrow: "Bestseller",
    cta: "Shop halaya",
    description:
      "Traditional Filipino ube dessert \u2014 smooth and velvety, or with soft ube chunks.",
    src: "/images/home/ube-halaya.jpg",
    alt: "A pouch of Bren Raphael's Smooth Ube Halaya beside a tub of halaya, grated ube and cut purple yam",
  },
  {
    title: "Ube Jam",
    cta: "Shop jam",
    description: "Spreadable, glossy and rich \u2014 perfect on pandesal.",
    src: "/images/home/ube-jam.jpg",
    alt: "Two open jars of Bren Raphael's Ube Jam, with tidbits and smooth, on wooden slices beside cut purple yam",
  },
  {
    title: "Ube Powder",
    cta: "Shop powder",
    description: "Dehydrated, finely milled purple yam for baking.",
    src: "/images/home/ube-powder.jpg",
    alt: "A wooden bowl of ube powder beside cut purple yam and a bowl of grated ube",
  },
];

const eyebrowClass = "text-xs font-medium uppercase tracking-[0.15em]";
const pillClass =
  "inline-flex items-center justify-center gap-2.5 rounded-full text-lg tracking-wide transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const smallPillClass =
  "inline-flex items-center gap-2.5 rounded-full bg-white px-[22px] py-2.5 text-sm font-medium text-primary transition hover:bg-primary-fixed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
const ghostLinkClass =
  "inline-flex items-center gap-2.5 py-2.5 text-lg text-primary hover:underline";

type HomeProps = {
  searchParams: Promise<{ welcome?: string | string[] }>;
};

/** Only asks who is signed in when the welcome was requested; a failed lookup just skips it. */
async function visitorToWelcome(welcome: string | string[] | undefined) {
  if (welcome !== "1") {
    return undefined;
  }
  try {
    return await currentVisitor();
  } catch {
    return undefined;
  }
}

/** Reads the query and session behind its own boundary so the page itself never waits on them. */
async function WelcomeGate({ searchParams }: HomeProps) {
  const visitor = await visitorToWelcome((await searchParams).welcome);
  if (visitor?.state === "needs-details") {
    redirect(completeProfilePath);
  }
  return visitor?.state === "customer" ? (
    <WelcomeModal firstName={visitor.customer.firstName} />
  ) : null;
}

export default function Home({ searchParams }: HomeProps) {
  return (
    <div className="bg-surface">
      <Suspense fallback={null}>
        <WelcomeGate searchParams={searchParams} />
      </Suspense>
      <section className="relative grid min-h-[708px] place-items-center overflow-hidden px-5 pb-24 pt-[184px] text-center lg:min-h-[848px]">
        <Image
          src="/images/home/hero-products.jpg"
          alt="Bren Raphael's Ube Halaya pouches and boxes, Ube Jam jars and ube powder styled with fresh purple yam"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div data-theme="dark" aria-hidden className="absolute inset-0 bg-on-primary-fixed/55" />
        <div className="relative flex max-w-3xl flex-col items-center gap-6">
          <p className={`${eyebrowClass} text-primary-fixed-dim`}>{tagline}</p>
          <h1 className="font-serif text-5xl leading-[1.1] text-white sm:text-7xl">
            Premium Ube Jam &amp; Ube Halaya
          </h1>
          <p className="max-w-[520px] leading-relaxed text-white">
            Rich, creamy and proudly homemade in Antipolo, Rizal &mdash; made with
            real purple yam, the heritage way.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-4">
            <Link
              href="/products"
              className={`${pillClass} bg-white px-9 py-4 text-primary hover:bg-primary-fixed focus-visible:outline-white`}
            >
              Shop the collection <span aria-hidden>&rarr;</span>
            </Link>
            <Link
              href="/about"
              className={`${pillClass} border border-white px-9 py-4 text-white hover:bg-white/10 focus-visible:outline-white`}
            >
              Our story
            </Link>
          </div>
        </div>
      </section>
      <Reveal>
      <section
        aria-label="As featured on"
        className="border-b border-outline-variant/50 px-5 py-10 sm:px-10"
      >
        <div className="flex flex-col items-center justify-between gap-4 text-on-surface-variant/70 lg:flex-row">
          <p className={eyebrowClass}>As featured on</p>
          {featuredPress.map((name) => (
            <p key={name} className="font-serif text-[22px] leading-[1.3] opacity-85">
              {name}
            </p>
          ))}
        </div>
      </section>
      </Reveal>
      <Reveal>
      <section className="space-y-[50px] px-5 py-[100px] sm:px-10">
        <div className="flex flex-wrap items-end justify-between gap-[30px]">
          <div className="space-y-4 text-primary">
            <p className={eyebrowClass}>Our products</p>
            <h2 className="font-serif text-4xl leading-[1.2] sm:text-[54px]">
              Made with real ube,
              <br />
              from our kitchen to yours.
            </h2>
          </div>
          <Link href="/products" className={ghostLinkClass}>
            View all products <span aria-hidden>&rarr;</span>
          </Link>
        </div>
        <div className="grid gap-5 lg:grid-cols-[1.9fr_1.5fr] lg:grid-rows-2">
          {collections.map(({ title, eyebrow, cta, description, src, alt }, index) => (
            <article
              key={title}
              className={`relative isolate flex min-h-[350px] items-end overflow-hidden rounded-[40px] ${
                index === 0 ? "min-h-[480px] lg:row-span-2" : ""
              }`}
            >
              <Image
                src={src}
                alt={alt}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="-z-10 object-cover"
              />
              <div
                data-theme="dark"
                aria-hidden
                className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent from-30% to-on-primary-fixed/85"
              />
              <div className="flex w-full flex-wrap items-end justify-between gap-4 p-8 text-white lg:p-10">
                <div className="space-y-2.5">
                  {eyebrow ? (
                    <p className={`${eyebrowClass} text-primary-fixed-dim`}>{eyebrow}</p>
                  ) : null}
                  <h3
                    className={`font-serif leading-[1.2] ${index === 0 ? "text-5xl lg:text-[54px]" : "text-[40px]"}`}
                  >
                    {title}
                  </h3>
                  <p className={`max-w-[420px] leading-relaxed ${index === 0 ? "" : "text-sm"}`}>
                    {description}
                  </p>
                </div>
                <Link href="/products" className={smallPillClass}>
                  {cta} <span aria-hidden>&rarr;</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
      </Reveal>
      <Reveal>
      <section className="space-y-[50px] px-5 pb-[100px] sm:px-10">
        <div className="space-y-4 text-primary">
          <p className={eyebrowClass}>Shop</p>
          <h2 className="font-serif text-4xl leading-[1.2] sm:text-[40px]">Bestsellers</h2>
        </div>
        <Suspense fallback={<BestsellersFallback />}>
          <Bestsellers />
        </Suspense>
      </section>
      </Reveal>
      <Reveal>
      <section className="px-5 pb-[100px] sm:px-10">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="relative min-h-[360px] overflow-hidden rounded-[40px] bg-primary-fixed lg:min-h-[600px]">
            <Image
              src="/images/about/sweet-journey.jpg"
              alt="A collage of the Bren Raphael's family and team making ube halaya together"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
          <div className="flex flex-col justify-center gap-6 rounded-[40px] bg-[#f4eefc] p-8 sm:p-[60px]">
            <div className="space-y-4 text-primary">
              <p className={eyebrowClass}>Our story</p>
              <h2 className="font-serif text-4xl leading-[1.2] sm:text-[54px]">
                A family recipe,
                <br />
                shared since 2011.
              </h2>
              <p className="max-w-[460px] leading-relaxed tracking-wide text-on-surface-variant">
                For Ralph and Bernice, making ube halaya was always more than
                tradition &mdash; it was how the family came together every
                Christmas and New Year. In 2025, that recipe became
                Bren Raphael&rsquo;s, named after their two sons.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/about"
                className={`${pillClass} bg-primary px-9 py-4 text-white hover:bg-primary-container`}
              >
                Read our story <span aria-hidden>&rarr;</span>
              </Link>
              <Link href="/journey" className={ghostLinkClass}>
                Our journey
              </Link>
            </div>
          </div>
        </div>
      </section>
      </Reveal>
      <Reveal>
      <section
        aria-label="Recognition"
        className="space-y-[50px] bg-surface-container-low px-5 py-[100px] sm:px-10"
      >
        <div className="flex flex-wrap items-end justify-between gap-[30px]">
          <div className="space-y-4 text-primary">
            <p className={eyebrowClass}>On air &amp; on stage</p>
            <h2 className="font-serif text-4xl leading-[1.2] sm:text-[54px]">Recognition</h2>
          </div>
          <Link href="/journey" className={ghostLinkClass}>
            See all features <span aria-hidden>&rarr;</span>
          </Link>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {recognitionVideos.map((video) => (
            <VideoCard key={video.id} {...video} />
          ))}
        </div>
      </section>
      </Reveal>
      <Reveal>
      <section
        aria-label="Customer messages"
        className="px-5 py-[100px] sm:px-10"
      >
        <KindWords messages={customerMessages} />
      </section>
      </Reveal>
    </div>
  );
}
