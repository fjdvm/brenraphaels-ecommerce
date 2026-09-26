import { ContentPage } from "@/components/shared/content-page";
export const metadata = { title: "FAQ" };
const faqs = [
  [
    "What makes Bren Raphael's Ube Halaya special?",
    "Our Ube Jam & Halaya is handcrafted in Baguio City using 100% genuine Cordillera purple yam, fresh carabao's milk, real butter, and zero artificial preservatives or fillers.",
  ],
  [
    "How long does the Ube Halaya last?",
    "Unopened, refrigerated jars last up to 3 weeks. Once opened, consume within 7–10 days. For longer shelf life, you can freeze unopened jars for up to 3 months.",
  ],
  [
    "Is your Ube Halaya gluten-free?",
    "Yes. Our traditional Ube Halaya contains only pure purple yam, milk, butter, and sugar. No wheat flour or gluten-containing starches are added.",
  ],
  [
    "How long does shipping take?",
    "Standard Metro Manila delivery takes 1–3 business days. Provincial Luzon takes 3–5 business days, and Visayas/Mindanao takes 5–7 business days via insulated courier packaging.",
  ],
  [
    "What is your return & refund policy?",
    "Due to the perishable nature of our products, returns are accepted only for damaged or incorrect items reported within 48 hours of delivery.",
  ],
  [
    "How can I contact customer support?",
    "You can fill out the form on our Contact Us page or email our team for help.",
  ],
];
export default function FaqPage() {
  return (
    <ContentPage
      eyebrow="Frequently asked questions"
      title="Everything you need to know."
    >
      {faqs.map(([question, answer]) => (
        <article key={question}>
          <h2 className="font-serif text-2xl text-primary">{question}</h2>
          <p className="mt-2">{answer}</p>
        </article>
      ))}
    </ContentPage>
  );
}
