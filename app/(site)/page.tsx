import Link from "next/link";

export default function Home() {
  return (
    <div className="bg-surface">
      <section className="relative grid min-h-[620px] place-items-center overflow-hidden border-b border-outline-variant/50 bg-[radial-gradient(circle_at_20%_20%,#dfd1f4,transparent_38%),radial-gradient(circle_at_80%_75%,#d6bde6,transparent_35%)] px-5 text-center">
        <div className="max-w-3xl space-y-7">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">
            Handcrafted in small batches
          </p>
          <h1 className="font-serif text-5xl leading-tight text-primary sm:text-7xl">
            Nature&apos;s purple elegance, crafted for you.
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-8 text-on-surface-variant">
            Discover artisanal ube delicacies inspired by heritage recipes, made
            with the warmth and care of home.
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
          {["Heritage recipes", "Real purple yam", "Made with care"].map(
            (title) => (
              <article
                key={title}
                className="border border-outline-variant/50 bg-surface-card p-8"
              >
                <h2 className="font-serif text-3xl text-primary">{title}</h2>
                <p className="mt-3 leading-7 text-on-surface-variant">
                  Thoughtfully prepared to celebrate the rich, comforting
                  character of Filipino ube halaya.
                </p>
              </article>
            ),
          )}
        </div>
      </section>
    </div>
  );
}
