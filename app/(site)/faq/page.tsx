import { ChevronDown } from "lucide-react";

import { ContentPage } from "@/components/shared/content-page";

export const metadata = { title: "FAQ" };

type Answer = { paragraphs?: string[]; bullets?: string[]; after?: string[] };

const faqs: [question: string, answer: Answer][] = [
  [
    "1. What is the difference between ube halaya and ube jam?",
    {
      paragraphs: [
        "Ube Halaya: A traditional Filipino dessert with a thicker texture and a more balanced sweetness. It can be enjoyed on its own as a rich, satisfying treat.",
        "Ube Jam: Smoother and more spreadable, with a slightly sweeter taste. Perfect for pairing with bread, crackers, and other snacks.",
      ],
    },
  ],
  [
    "2. What is your shelf life?",
    {
      paragraphs: [
        "Ube Halaya: 1–3 days at room temperature, and up to 30 days when refrigerated at 2–4°C.",
        "Ube Jam: Up to 3 weeks shelf life. It can stay at room temperature for up to 24 hours only.",
      ],
    },
  ],
  [
    "3. Why does ube sometimes appear pale in color?",
    {
      paragraphs: [
        "We do not use artificial food coloring. The color of our ube reflects its natural origin, so variations in shade are normal and a sign of authenticity.",
      ],
    },
  ],
  [
    "4. Is your ube made from 100% real ube?",
    {
      paragraphs: [
        "Yes, our products are made from real ube. We focus on delivering authentic flavor and quality, which is why we do not rely on artificial flavoring to achieve taste.",
      ],
    },
  ],
  [
    "5. What makes your ube products premium quality?",
    {
      paragraphs: [
        "Our ube products are crafted using carefully selected ingredients and a consistent cooking process to ensure rich flavor, smooth texture, and high quality in every batch. We prioritize freshness and authenticity, which is why we maintain strict quality standards from production to packaging.",
      ],
    },
  ],
  [
    "6. Where do you source your raw ube?",
    {
      paragraphs: [
        "Our raw ube is sourced from trusted farmers across different regions in the Philippines, including Pangasinan, Batangas, Mindanao, and Laguna. We are also currently coordinating with local farmer associations in Rizal to support and develop sustainable ube farming through direct partnerships and future planting initiatives.",
      ],
    },
  ],
  [
    "7. Do you accept Senior Citizen and PWD discounts?",
    {
      paragraphs: [
        "Yes, we offer a 5% discount for Senior Citizens and PWD customers as a goodwill gesture. However, our products (Ube Jam and Ube Halaya) are not included under Basic Necessities and Prime Commodities (BNPC) based on the Price Act (Republic Act No. 7581) and DTI guidelines.",
        "Our discount policy is as follows:",
      ],
      bullets: [
        "5% discount per item",
        "1 item per valid ID",
        "For personal consumption only",
      ],
      after: [
        "This policy is aligned with the Expanded Senior Citizens Act of 2010 (Republic Act No. 9994), which ensures that discounts are intended for the exclusive use and benefit of the customer and not for bulk purchase or resale.",
      ],
    },
  ],
  [
    "8. How can I place an order?",
    {
      paragraphs: [
        "You can place your order through our website or by contacting our official social media pages. Simply choose your preferred product, select the quantity, and send us your order details for confirmation.",
        "Once we have received your payment, our team will process your order immediately and prepare it for dispatch. Delivery will be booked via trusted couriers such as Lalamove, GrabExpress, or other available delivery services.",
        "You will be notified once your order is ready for pickup and on its way to you.",
      ],
    },
  ],
  [
    "Payment Methods",
    {
      paragraphs: ["We accept the following payment options:"],
      bullets: ["Cash on Delivery (COD)", "GCash"],
    },
  ],
  [
    "Shipping & Delivery",
    {
      bullets: [
        "Delivery fees may vary depending on your location",
        "Orders are subject to confirmation before processing",
        "For questions or special requests, feel free to contact us",
      ],
    },
  ],
  [
    "Store Pickup",
    {
      bullets: [
        "Available for pre-orders and confirmed orders",
        "For paid orders, simply present your payment confirmation upon pickup",
        "For Cash on Delivery, payment will be collected upon pickup",
        "Please present your order confirmation for verification",
      ],
    },
  ],
];

export default function FaqPage() {
  return (
    <ContentPage
      eyebrow="Frequently asked questions"
      title="Everything you need to know."
    >
      <div className="divide-y divide-outline-variant/60 border-y border-outline-variant/60">
        {faqs.map(([question, { paragraphs, bullets, after }]) => (
          <details key={question} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
              <h2 className="font-serif text-2xl text-primary">{question}</h2>
              <ChevronDown
                aria-hidden
                className="h-5 w-5 shrink-0 text-primary transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="mt-4 space-y-2">
              {paragraphs?.map((text) => <p key={text}>{text}</p>)}
              {bullets ? (
                <ul className="list-disc space-y-1 pl-6">
                  {bullets.map((text) => <li key={text}>{text}</li>)}
                </ul>
              ) : null}
              {after?.map((text) => <p key={text}>{text}</p>)}
            </div>
          </details>
        ))}
      </div>
    </ContentPage>
  );
}
