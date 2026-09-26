import { ContentPage } from "@/components/shared/content-page";
export const metadata = { title: "Careers" };
export default function CareersPage() {
  return (
    <ContentPage
      eyebrow="Craft & culinary careers"
      title="Build the future of premium treats."
    >
      <p>
        We&apos;re building a thoughtful team around heritage flavors and warm
        customer experiences. Future opportunities will be posted here.
      </p>
      <p>
        To introduce yourself, email{" "}
        <a
          className="font-semibold text-primary underline"
          href="mailto:careers@brenraphaels.com"
        >
          careers@brenraphaels.com
        </a>
        .
      </p>
    </ContentPage>
  );
}
