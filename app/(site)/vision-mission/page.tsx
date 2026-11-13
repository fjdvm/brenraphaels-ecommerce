import { Eye, Heart, Shield, Star, User, type LucideIcon } from "lucide-react";

import { AboutCta } from "@/components/features/about/about-cta";
import { AboutPageHeader } from "@/components/features/about/about-page-header";
import { PhotoTile } from "@/components/features/about/photo-tile";
import {
  SectionHeading,
  eyebrowClass,
} from "@/components/features/about/section-heading";
import { cn } from "@/lib/utils";

export const metadata = { title: "Our Vision and Mission" };

const values: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Star,
    title: "Tradition",
    text: "Recipes cooked the old-fashioned way, as our family has for generations.",
  },
  {
    icon: Shield,
    title: "Perseverance",
    text: "A dream paused in 2011, revived in 2024 and launched in 2025.",
  },
  {
    icon: Heart,
    title: "Faith",
    text: "The belief that great things grow from humble beginnings.",
  },
  {
    icon: User,
    title: "Community",
    text: "Creating jobs and better income for Filipino farmers.",
  },
];

/** One half of the vision and mission pair. */
function Statement({
  icon: Icon,
  label,
  children,
  inverted = false,
}: {
  icon: LucideIcon;
  label: string;
  children: string;
  inverted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-6 p-8 sm:p-[60px]",
        inverted ? "bg-primary" : "bg-lavender-soft",
      )}
    >
      <span className="grid size-14 place-items-center rounded-full bg-white text-primary">
        <Icon aria-hidden className="size-[25px]" strokeWidth={1.5} />
      </span>
      <p className={cn(eyebrowClass, inverted && "text-[#c9a8f0]")}>{label}</p>
      <p
        className={cn(
          "font-serif text-3xl leading-[1.2] sm:text-[40px]",
          inverted ? "text-white" : "text-primary",
        )}
      >
        {children}
      </p>
    </div>
  );
}

export default function VisionMissionPage() {
  return (
    <div className="bg-surface">
      <AboutPageHeader title="Vision & Mission">
        What guides every batch we cook and every jar we seal.
      </AboutPageHeader>

      <section className="mx-auto max-w-[1440px] px-5 pb-[100px] pt-10 sm:px-10">
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <Statement icon={Eye} label="Our vision" inverted>
            To become a trusted brand for premium quality ube products locally
            and abroad.
          </Statement>
          <Statement icon={Heart} label="Our mission">
            To deliver high quality, delicious, and innovative ube products
            while preserving Filipino tradition.
          </Statement>
        </div>
      </section>

      <section className="mx-auto flex max-w-[1440px] flex-col gap-10 px-5 py-[100px] sm:px-10">
        <SectionHeading eyebrow="What every jar represents" title="Our values" />
        <ul className="grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {values.map(({ icon: Icon, title, text }) => (
            <li
              key={title}
              className="flex flex-col items-start gap-4 border border-line bg-white p-9"
            >
              <span className="grid size-[52px] place-items-center rounded-full bg-lavender text-primary">
                <Icon aria-hidden className="size-[23px]" strokeWidth={1.5} />
              </span>
              <h3 className="font-serif text-[28px] leading-[1.25] text-primary">
                {title}
              </h3>
              <p className="text-sm leading-normal tracking-[0.35px] text-body">
                {text}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 pb-[100px] sm:px-10">
        <PhotoTile
          src="/images/about/sweet-journey.jpg"
          alt="Family & team photo"
          sizes="(min-width: 1440px) 1360px, 100vw"
          className="h-[320px] sm:h-[520px]"
        />
      </section>

      <AboutCta />
    </div>
  );
}
