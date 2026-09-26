import Link from "next/link";
import { redirect } from "next/navigation";

import { WelcomeModal } from "@/components/features/home/welcome-modal";
import { completeProfilePath } from "@/lib/auth/route-access";
import { currentVisitor } from "@/lib/customer/current-visitor";
import { tagline } from "@/lib/site/store-info";

const productLines = [
  {
    title: "Ube Powder",
    description:
      "Premium ube powder sourced from steamed, fresh ube root. Carefully dehydrated and finely powderized to preserve the natural purple hue and distinctive earthy-sweet flavor that defines authentic Filipino ube.",
  },
  {
    title: "Ube Jam",
    description:
      "A rich and creamy ube spread made from premium purple yam, carefully cooked to achieve a smooth, glossy texture. Available in smooth or with real ube bits for added texture, it delivers a rich and indulgent flavor in every bite. Perfect for spreading, mixing, or using as a filling for your favorite breads and desserts for a classic and satisfying ube experience.",
  },
  {
    title: "Ube Halaya",
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
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div className="grid gap-8 md:grid-cols-3">
          {productLines.map(({ title, description }) => (
            <article
              key={title}
              className="border border-outline-variant/50 bg-surface-card p-8"
            >
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
        className="mx-auto max-w-4xl space-y-4 px-5 pb-20 leading-7 text-on-surface-variant sm:px-8"
      >
        <p>
          Bren Raphael&apos;s Ube Jam &amp; Halaya was featured on DTI Asenso,
          highlighting our journey as a growing Filipino brand committed to
          crafting premium ube products and sharing our story with a wider
          audience.
        </p>
        <p>
          Also visited by popular food vlogger Kafoodtrip, helping showcase our
          products to more ube lovers.
        </p>
      </section>
    </div>
  );
}
