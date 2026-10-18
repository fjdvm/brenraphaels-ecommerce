import { FaqBrowser } from "@/components/features/faq/faq-browser";
import { faqGroups } from "@/lib/faq/faqs";

export const metadata = { title: "FAQ" };

export default function FaqPage() {
  return <FaqBrowser groups={faqGroups} />;
}
