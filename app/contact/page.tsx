import { ContentPage } from "@/components/shared/content-page";
export const metadata = { title: "Contact" };
export default function ContactPage() {
  return (
    <ContentPage eyebrow="Customer care" title="We're here to help.">
      <p>
        Have a question about our ube jam, an order, or our policies? We&apos;d
        love to hear from you.
      </p>
      <p>
        Email us at{" "}
        <a
          className="font-semibold text-primary underline"
          href="mailto:hello@brenraphaels.com"
        >
          hello@brenraphaels.com
        </a>{" "}
        and our team will get back to you as soon as possible.
      </p>
    </ContentPage>
  );
}
