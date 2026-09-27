import { ContentPage } from "@/components/shared/content-page";
import { tagline } from "@/lib/site/store-info";

export const metadata = { title: "Our Vision and Mission" };

export default function VisionMissionPage() {
  return (
    <ContentPage eyebrow={tagline} title="Our Vision and Mission" wide>
      <div className="grid gap-6 md:grid-cols-2">
        <section className="border border-outline-variant/50 bg-surface-card p-8">
          <h2 className="font-serif text-3xl text-primary">Our Vision</h2>
          <p className="mt-4">
            To become a trusted brand for premium quality ube products locally
            and abroad.
          </p>
        </section>
        <section className="border border-outline-variant/50 bg-surface-card p-8">
          <h2 className="font-serif text-3xl text-primary">Our Mission</h2>
          <p className="mt-4">
            To deliver high quality, delicious, and innovative ube products
            while preserving Filipino Tradition
          </p>
        </section>
      </div>
    </ContentPage>
  );
}
