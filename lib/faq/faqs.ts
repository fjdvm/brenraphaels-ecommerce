import type { FaqGroup } from "./faq-search";

/** The questions customers ask most, grouped by topic. */
export const faqGroups: FaqGroup[] = [
  {
    heading: "Our Ube",
    faqs: [
      {
        question: "What is the difference between ube halaya and ube jam?",
        answer: {
          paragraphs: [
            "Ube Halaya: A traditional Filipino dessert with a thicker texture and a more balanced sweetness. It can be enjoyed on its own as a rich, satisfying treat.",
            "Ube Jam: Smoother and more spreadable, with a slightly sweeter taste. Perfect for pairing with bread, crackers, and other snacks."
          ]
        }
      },
      {
        question: "What is your shelf life?",
        answer: {
          paragraphs: [
            "Ube Halaya: 1–3 days at room temperature, and up to 30 days when refrigerated at 2–4°C.",
            "Ube Jam: Up to 3 weeks shelf life. It can stay at room temperature for up to 24 hours only."
          ]
        }
      },
      {
        question: "Why does ube sometimes appear pale in color?",
        answer: {
          paragraphs: [
            "We do not use artificial food coloring. The color of our ube reflects its natural origin, so variations in shade are normal and a sign of authenticity."
          ]
        }
      },
      {
        question: "Is your ube made from 100% real ube?",
        answer: {
          paragraphs: [
            "Yes, our products are made from real ube. We focus on delivering authentic flavor and quality, which is why we do not rely on artificial flavoring to achieve taste."
          ]
        }
      },
      {
        question: "What makes your ube products premium quality?",
        answer: {
          paragraphs: [
            "Our ube products are crafted using carefully selected ingredients and a consistent cooking process to ensure rich flavor, smooth texture, and high quality in every batch. We prioritize freshness and authenticity, which is why we maintain strict quality standards from production to packaging."
          ]
        }
      },
      {
        question: "Where do you source your raw ube?",
        answer: {
          paragraphs: [
            "Our raw ube is sourced from trusted farmers across different regions in the Philippines, including Pangasinan, Batangas, Mindanao, and Laguna. We are also currently coordinating with local farmer associations in Rizal to support and develop sustainable ube farming through direct partnerships and future planting initiatives."
          ]
        }
      }
    ]
  },
  {
    heading: "Ordering",
    faqs: [
      {
        question: "Do you accept Senior Citizen and PWD discounts?",
        answer: {
          paragraphs: [
            "Yes, we offer a 5% discount for Senior Citizens and PWD customers as a goodwill gesture. However, our products (Ube Jam and Ube Halaya) are not included under Basic Necessities and Prime Commodities (BNPC) based on the Price Act (Republic Act No. 7581) and DTI guidelines.",
            "Our discount policy is as follows:"
          ],
          bullets: [
            "5% discount per item",
            "1 item per valid ID",
            "For personal consumption only",
            "Add your Senior Citizen or PWD ID when you sign up, or later in Account settings. Once our team verifies it, the discount is applied automatically at checkout"
          ],
          after: [
            "This policy is aligned with the Expanded Senior Citizens Act of 2010 (Republic Act No. 9994), which ensures that discounts are intended for the exclusive use and benefit of the customer and not for bulk purchase or resale."
          ]
        }
      },
      {
        question: "How can I place an order?",
        answer: {
          paragraphs: [
            "You can place your order through our website or by contacting our official social media pages. Simply choose your preferred product, select the quantity, and send us your order details for confirmation.",
            "Once we have received your payment, our team will process your order immediately and prepare it for dispatch. Delivery will be booked via trusted couriers such as Lalamove, GrabExpress, or other available delivery services.",
            "You will be notified once your order is ready for pickup and on its way to you."
          ]
        }
      }
    ]
  },
  {
    heading: "Payment",
    faqs: [
      {
        question: "Payment Methods",
        answer: {
          paragraphs: [
            "We accept the following payment options:"
          ],
          bullets: [
            "Cash on Delivery (COD)",
            "GCash"
          ]
        }
      }
    ]
  },
  {
    heading: "Shipping",
    faqs: [
      {
        question: "Shipping & Delivery",
        answer: {
          bullets: [
            "Delivery fees may vary depending on your location",
            "Orders are subject to confirmation before processing",
            "For questions or special requests, feel free to contact us"
          ]
        }
      }
    ]
  },
  {
    heading: "Pickup",
    faqs: [
      {
        question: "Store Pickup",
        answer: {
          bullets: [
            "Available for pre-orders and confirmed orders",
            "For paid orders, simply present your payment confirmation upon pickup",
            "For Cash on Delivery, payment will be collected upon pickup",
            "Please present your order confirmation for verification"
          ]
        }
      }
    ]
  }
];
