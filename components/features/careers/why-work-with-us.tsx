import { Flag, House, Sprout } from "lucide-react";

import { eyebrowClass } from "@/components/features/about/section-heading";

const reasons = [
  { icon: House, title: "A family business", text: "Grow with a team built on family, faith and perseverance." },
  { icon: Flag, title: "Proudly Filipino", text: "Help bring authentic ube flavors closer to every home." },
  { icon: Sprout, title: "Real impact", text: "Support local communities and better income for Filipino farmers." },
];

/** The three reasons to work here; the header's "Life at Bren Raphael's" link scrolls here. */
export function WhyWorkWithUs() {
  return (
    <section id="life" className="scroll-mt-6">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-5 pb-[100px] pt-20 sm:px-10">
        <div className="flex flex-col gap-2">
          <p className={eyebrowClass}>Life at Bren Raphael&apos;s</p>
          <h2 className="font-serif text-3xl leading-[1.2] text-primary sm:text-[32px]">Why work with us</h2>
        </div>
        <ul className="grid gap-5 md:grid-cols-3">
          {reasons.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex flex-col items-start gap-3 bg-surface-soft p-[30px]">
              <span aria-hidden className="flex size-11 items-center justify-center rounded-full bg-white text-primary">
                <Icon className="size-[22px]" strokeWidth={1.5} />
              </span>
              <h3 className="font-serif text-lg leading-[1.3] text-primary">{title}</h3>
              <p className="text-[15px] leading-[23px] tracking-[0.35px] text-body">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
