import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

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
  },
  {
    id: "7kh6RzlDcH4",
    title:
      "PATOK na NEGOSYO | ONE of the BIGGEST MAKER of UBE JAM & HALAYA in Philippines | KAFOODTRIP",
  },
  {
    id: "ihuFz1MJPDA",
    title: "KUMITA AT YUMAMAN SA PAGGAWA NG UBE! | My Puhunan: Kaya Mo! | ABS-CBN News",
  },
];

const customerMessages = [
  {
    src: "/images/home/customer-rita-daniela.jpg",
    width: 1290,
    height: 1087,
    alt: 'A business chat from missritadaniela reading "SOOOO GOOD!", then "Definitely!!!" after Bren Raphael\'s replied "Thank you so much mam!"',
  },
  {
    src: "/images/home/customer-saudi-arabia.jpg",
    width: 1290,
    height: 1390,
    alt: 'A customer\'s message with a photo of a pouch of Smooth Ube Halaya: "Hi, nadala ko na sya dito sa saudi. Thank you! Ang sarap!!!!"',
  },
  {
    src: "/images/home/customer-germany.jpg",
    width: 1290,
    height: 1487,
    alt: 'A customer\'s message with a photo of Ube Halaya: "Nakarating po ng germany ung Ube. Sayang 2 lang nabili ko sa SM north"',
  },
  {
    src: "/images/home/customer-france.jpg",
    width: 1290,
    height: 1566,
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
      <section className="relative grid min-h-[620px] place-items-center overflow-hidden border-b border-outline-variant/50 bg-[radial-gradient(circle_at_20%_20%,#dfd1f4,transparent_38%),radial-gradient(circle_at_80%_75%,#d6bde6,transparent_35%)] px-5 text-center">
        <div className="max-w-3xl space-y-7">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">
            {tagline}
          </p>
          <h1 className="font-serif text-5xl leading-tight text-primary sm:text-7xl">
            Premium Ube Jam &amp; Ube Halaya
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-8 text-on-surface-variant">
            Rich, creamy, and proudly homemade.
          </p>
          <Link
            href="/about"
            className="inline-flex bg-primary px-8 py-4 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-primary-container"
          >
            Our story
          </Link>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 pt-16 sm:px-8">
        <Image
          src="/images/home/hero-products.jpg"
          alt="Bren Raphael's Ube Halaya pouches and boxes, Ube Jam jars and ube powder styled with fresh purple yam"
          width={1600}
          height={1067}
          priority
          sizes="(min-width: 1152px) 1152px, 100vw"
          className="h-auto w-full"
        />
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
        className="mx-auto max-w-4xl space-y-6 px-5 pb-20 leading-7 text-on-surface-variant sm:px-8"
      >
        <p>
          Bren Raphael&apos;s Ube Jam &amp; Halaya was featured on DTI Asenso,
          highlighting our journey as a growing Filipino brand committed to
          crafting premium ube products and sharing our story with a wider
          audience.
        </p>
        <YouTubeVideo {...recognitionVideos[0]} />
        <p>
          Also visited by popular food vlogger Kafoodtrip, helping showcase our
          products to more ube lovers.
        </p>
        <YouTubeVideo {...recognitionVideos[1]} />
        <YouTubeVideo {...recognitionVideos[2]} />
      </section>
      <section className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
        <h2 className="text-center font-serif text-4xl text-primary">
          What Our Customers Say
        </h2>
        <div className="mt-10 grid items-start gap-6 sm:grid-cols-2">
          {customerMessages.map(({ src, width, height, alt }) => (
            <Image
              key={src}
              src={src}
              alt={alt}
              width={width}
              height={height}
              sizes="(min-width: 640px) 50vw, 100vw"
              className="h-auto w-full border border-outline-variant/50"
            />
          ))}
        </div>
      </section>
    </div>
  );
}
