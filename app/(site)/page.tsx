import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DepthCarousel } from "@/components/shared/depth-carousel";
import { MorphSlider } from "@/components/shared/morph-slider";
import { YouTubeVideo } from "@/components/shared/youtube-video";
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
    body: "Bren Raphael\u2019s Ube Jam & Halaya was featured on DTI Asenso, highlighting our journey as a growing Filipino brand committed to crafting premium ube products and sharing our story with a wider audience.",
  },
  {
    id: "7kh6RzlDcH4",
    title:
      "PATOK na NEGOSYO | ONE of the BIGGEST MAKER of UBE JAM & HALAYA in Philippines | KAFOODTRIP",
    kicker: "Kafoodtrip",
    headline:
      "Patok na Negosyo: One of the Biggest Makers of Ube Jam & Halaya in the Philippines",
    body: "Also visited by popular food vlogger Kafoodtrip, helping showcase our products to more ube lovers.",
  },
  {
    id: "ihuFz1MJPDA",
    title:
      "KUMITA AT YUMAMAN SA PAGGAWA NG UBE! | My Puhunan: Kaya Mo! | ABS-CBN News",
    kicker: "ABS-CBN News \u00b7 My Puhunan: Kaya Mo!",
    headline: "Kumita at Yumaman sa Paggawa ng Ube!",
    body: "Watch our feature on ABS-CBN News.",
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

const productLines = [
  {
    title: "Ube Powder",
    image: {
      src: "/images/home/ube-powder.jpg",
      width: 1600,
      height: 1067,
      alt: "A wooden bowl of ube powder beside cut purple yam and a bowl of grated ube",
    },
    description:
      "Premium ube powder sourced from steamed, fresh ube root. Carefully dehydrated and finely powderized to preserve the natural purple hue and distinctive earthy-sweet flavor that defines authentic Filipino ube.",
  },
  {
    title: "Ube Jam",
    image: {
      src: "/images/home/ube-jam.jpg",
      width: 1600,
      height: 2400,
      alt: "Two open jars of Bren Raphael's Ube Jam, with tidbits and smooth, on wooden slices beside cut purple yam",
    },
    description:
      "A rich and creamy ube spread made from premium purple yam, carefully cooked to achieve a smooth, glossy texture. Available in smooth or with real ube bits for added texture, it delivers a rich and indulgent flavor in every bite. Perfect for spreading, mixing, or using as a filling for your favorite breads and desserts for a classic and satisfying ube experience.",
  },
  {
    title: "Ube Halaya",
    image: {
      src: "/images/home/ube-halaya.jpg",
      width: 1600,
      height: 2400,
      alt: "A pouch of Bren Raphael's Smooth Ube Halaya beside a tub of halaya, grated ube and cut purple yam",
    },
    description:
      "A rich and creamy traditional Filipino ube dessert made from premium purple yam, available in two delightful textures: smooth and velvety, or enhanced with soft ube chunks for added bite. Perfect to enjoy on its own or as a delicious topping for halo-halo and other classic desserts.",
  },
];

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

export default async function Home({ searchParams }: HomeProps) {
  const visitor = await visitorToWelcome((await searchParams).welcome);
  if (visitor?.state === "needs-details") {
    redirect(completeProfilePath);
  }

  return (
    <div className="bg-surface">
      {visitor?.state === "customer" ? (
        <WelcomeModal firstName={visitor.customer.firstName} />
      ) : null}
      <section className="relative grid min-h-[620px] place-items-center overflow-hidden border-b border-outline-variant/50 px-5 text-center">
        <Image
          src="/images/home/hero-products.jpg"
          alt="Bren Raphael's Ube Halaya pouches and boxes, Ube Jam jars and ube powder styled with fresh purple yam"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div aria-hidden className="absolute inset-0 bg-on-primary-fixed/65" />
        <div className="relative max-w-3xl space-y-7">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-fixed-dim">
            {tagline}
          </p>
          <h1 className="font-serif text-5xl leading-tight text-white sm:text-7xl">
            Premium Ube Jam &amp; Ube Halaya
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-8 text-primary-fixed">
            Rich, creamy, and proudly homemade.
          </p>
          <Link
            href="/about"
            className="inline-flex bg-white px-8 py-4 text-sm font-bold uppercase tracking-widest text-primary transition hover:bg-primary-fixed"
          >
            Our story
          </Link>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div className="grid gap-8 md:grid-cols-3">
          {productLines.map(({ title, description, image }) => (
            <article
              key={title}
              className="border border-outline-variant/50 bg-surface-card p-8"
            >
              <Image
                src={image.src}
                alt={image.alt}
                width={image.width}
                height={image.height}
                sizes="(min-width: 768px) 33vw, 100vw"
                className="mb-6 h-72 w-full object-cover"
              />
              <h2 className="font-serif text-3xl text-primary">{title}</h2>
              <p className="mt-3 leading-7 text-on-surface-variant">
                {description}
              </p>
            </article>
          ))}
        </div>
      </section>
      <section
        aria-label="Recognition"
        className="border-t border-outline-variant/50 px-5 py-20 sm:px-8"
      >
        <div className="mx-auto max-w-6xl">
          <MorphSlider
            label="Featured videos"
            mediaSide="right"
            intro={
              <>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">
                  Featured
                </p>
                <h2 className="mt-3 font-serif text-4xl text-primary">
                  Recognition
                </h2>
              </>
            }
            items={recognitionVideos.map(
              ({ id, title, kicker, headline, body }) => ({
                key: id,
                image: `/images/home/video-${id}.jpg`,
                alt: title,
                text: (
                  <>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-secondary">
                      {kicker}
                    </p>
                    <h3 className="mt-3 font-serif text-2xl leading-snug text-primary sm:text-3xl">
                      {headline}
                    </h3>
                    <p className="mt-4 leading-7 text-on-surface-variant">
                      {body}
                    </p>
                  </>
                ),
                player: <YouTubeVideo id={id} title={title} autoplay />,
              }),
            )}
          />
        </div>
      </section>
      <section className="border-t border-outline-variant/50 px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <DepthCarousel
            label="Customer messages"
            mediaSide="left"
            intro={
              <>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">
                  Kind words
                </p>
                <h2 className="mt-3 font-serif text-4xl text-primary">
                  What Our Customers Say
                </h2>
              </>
            }
            items={customerMessages.map(({ src, place, quote, alt }) => ({
              key: src,
              src,
              alt,
              text: (
                <>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-secondary">
                    {place}
                  </p>
                  <blockquote className="mt-3 font-serif text-2xl leading-snug text-primary sm:text-3xl">
                    &ldquo;{quote}&rdquo;
                  </blockquote>
                </>
              ),
            }))}
          />
        </div>
      </section>
    </div>
  );
}
