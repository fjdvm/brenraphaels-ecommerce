const steps = [
  { title: "Apply", text: "Send your profile and résumé for an open role." },
  { title: "Review", text: "Our team reviews your application and gets back to you." },
  { title: "Interview", text: "We'll message you to schedule a short interview." },
  { title: "Welcome", text: "Join the Bren Raphael's family!" },
];

/** The four hiring steps; the header's "How hiring works" link scrolls here. */
export function HowHiringWorks() {
  return (
    <section id="how-hiring-works" className="mx-auto w-full max-w-[1440px] scroll-mt-6 px-5 pb-[100px] pt-[60px] sm:px-10">
      <h2 className="font-serif text-[22px] leading-[1.3] text-primary">How hiring works</h2>
      <ol className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => (
          <li key={step.title} className="flex flex-col items-start gap-3 bg-surface-soft p-[30px]">
            <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-primary text-[13px] font-medium tracking-[0.35px] text-white">
              {index + 1}
            </span>
            <h3 className="font-serif text-lg leading-[1.35] text-primary">{step.title}</h3>
            <p className="text-sm leading-normal tracking-[0.35px] text-body">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
