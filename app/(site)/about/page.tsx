import { ContentPage } from "@/components/shared/content-page";
export const metadata = { title: "Our Story" };
export default function AboutPage() {
  return (
    <ContentPage eyebrow="Our heritage" title="Made for the love of ube.">
      <p>
        Bren Raphael&apos;s celebrates the familiar comfort of Filipino ube
        halaya. We bring traditional recipes to every small batch, with a focus
        on ingredients, care, and sharing something sweet.
      </p>
      <p>
        Our purple yam treats are made to be enjoyed around the table, gifted to
        loved ones, and remembered long after the last spoonful.
      </p>
    </ContentPage>
  );
}
