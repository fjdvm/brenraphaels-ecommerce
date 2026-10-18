"use client";

import { ArrowRight, MessageCircle, Minus, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useState } from "react";

import { AboutPageHeader } from "@/components/features/about/about-page-header";
import { Button } from "@/components/ui/button";
import { filterFaqGroups, type FaqGroup } from "@/lib/faq/faq-search";
import { cn } from "@/lib/utils";

const slug = (heading: string) => heading.toLowerCase().replace(/\s+/g, "-");

function SearchBox({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <form
      role="search"
      onSubmit={(event) => event.preventDefault()}
      className="flex w-full items-center gap-3 rounded-full border border-line bg-white py-2 pl-6 pr-2 lg:max-w-[720px]"
    >
      <label htmlFor={id} className="sr-only">
        Search questions
      </label>
      <Search aria-hidden className="size-5 shrink-0 text-muted" />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={100}
        placeholder="Search questions — e.g. shelf life, GCash, pickup"
        className="min-w-0 flex-1 bg-transparent leading-[1.6] tracking-[0.35px] text-ink outline-none placeholder:text-muted"
      />
      <Button type="submit" variant="pill" size="pill-sm">
        Search
      </Button>
    </form>
  );
}

function Question({
  faq,
  defaultOpen,
}: {
  faq: FaqGroup["faqs"][number];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const { paragraphs, bullets, after } = faq.answer;
  return (
    <div className="border-b border-line">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
          className="flex w-full items-center gap-[30px] py-6 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            className={cn(
              "flex-1 font-serif text-lg leading-[1.35]",
              open ? "text-primary" : "text-ink",
            )}
          >
            {faq.question}
          </span>
          <span
            aria-hidden
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full border",
              open ? "border-primary bg-primary text-white" : "border-line bg-white text-primary",
            )}
          >
            {open ? <Minus className="size-4" /> : <Plus className="size-4" />}
          </span>
        </button>
      </h3>
      <div
        id={panelId}
        hidden={!open}
        className="flex max-w-[760px] flex-col gap-2 pb-6 leading-[1.6] tracking-[0.35px] text-body"
      >
        {paragraphs?.map((text) => <p key={text}>{text}</p>)}
        {bullets ? (
          <ul className="list-disc space-y-1 pl-6">
            {bullets.map((text) => <li key={text}>{text}</li>)}
          </ul>
        ) : null}
        {after?.map((text) => <p key={text}>{text}</p>)}
      </div>
    </div>
  );
}

function HelpCard() {
  return (
    <div
      data-theme="dark"
      className="flex flex-col items-start gap-3.5 rounded-[40px] bg-primary p-[30px] text-white"
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-white text-primary">
        <MessageCircle aria-hidden className="size-5" />
      </span>
      <p className="font-serif text-[22px] leading-[1.3]">Still have questions?</p>
      <p className="max-w-[240px] text-sm leading-normal tracking-[0.35px] text-white/85">
        Open a support ticket and chat with our team.
      </p>
      <Button asChild variant="pill" size="pill-sm" className="bg-white text-primary hover:bg-lavender-soft">
        <Link href="/support">
          Contact support <ArrowRight aria-hidden className="size-4" />
        </Link>
      </Button>
    </div>
  );
}

/** The FAQ page: a search box over a category list beside the question groups. */
export function FaqBrowser({ groups }: { groups: FaqGroup[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>();
  const visible = useMemo(() => filterFaqGroups(groups, query), [groups, query]);
  const active = category ?? groups[0]?.heading;

  return (
    <>
      <AboutPageHeader
        eyebrow="Frequently asked questions"
        title={"Everything you\nneed to know."}
        below={<SearchBox value={query} onChange={setQuery} />}
      >
        Can&apos;t find your answer? Our team replies through Support tickets.
      </AboutPageHeader>

      <section className="mx-auto flex max-w-[1440px] flex-col gap-10 px-5 pb-[100px] pt-5 sm:px-10 lg:flex-row lg:gap-20">
        <aside className="flex flex-col gap-1.5 lg:w-[300px] lg:shrink-0">
          <nav aria-label="FAQ categories" className="flex flex-col gap-1.5">
            {groups.map(({ heading, faqs }) => (
              <a
                key={heading}
                href={`#${slug(heading)}`}
                aria-current={active === heading ? "true" : undefined}
                onClick={() => setCategory(heading)}
                className={cn(
                  "flex items-center justify-between rounded-full px-5 py-3.5 text-[15px] tracking-[0.35px]",
                  active === heading ? "bg-lavender text-primary" : "text-body hover:bg-lavender-soft",
                )}
              >
                {heading}
                <span className={cn("text-xs", active === heading ? "text-primary" : "text-muted")}>
                  {faqs.length}
                </span>
              </a>
            ))}
          </nav>
          <div className="mt-[11px]">
            <HelpCard />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-[60px]" aria-live="polite">
          {visible.length === 0 ? (
            <p className="leading-[1.6] tracking-[0.35px] text-body">
              No questions match &ldquo;{query.trim()}&rdquo;. Try another word, or open a
              support ticket and we&apos;ll help.
            </p>
          ) : (
            visible.map(({ heading, faqs }) => (
              <section key={heading} id={slug(heading)} className="scroll-mt-24">
                <h2 className="border-b border-line pb-5 font-serif text-[28px] leading-[1.25] text-primary">
                  {heading}
                </h2>
                {faqs.map((faq) => (
                  <Question
                    key={faq.question}
                    faq={faq}
                    defaultOpen={faq === groups[0]?.faqs[0]}
                  />
                ))}
              </section>
            ))
          )}
        </div>
      </section>
    </>
  );
}
