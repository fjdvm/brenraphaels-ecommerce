import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { jobPostings } from "../lib/careers/schema.ts";

function inDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

const postings = [
  {
    id: "production-assistant",
    title: "Production Assistant",
    department: "Kitchen",
    employmentType: "Full-time",
    location: "Quezon City, Philippines",
    deadline: inDays(60),
    description:
      "We're looking for a hands-on Production Assistant to join our small-batch kitchen team, helping us cook, jar, and pack Bren Raphael's Ube Jam & Halaya with the same care we've put in since day one.",
    requirements:
      "- Comfortable on your feet in a working kitchen\n- Food handling experience preferred, not required\n- Can lift 20kg and follow batch recipes precisely",
    requiredDocuments: ["Resume", "Government ID"],
    screeningCriteria: ["Food handling experience", "Can lift 20kg"],
    status: "open",
  },
  {
    id: "packaging-fulfillment-associate",
    title: "Packaging & Fulfillment Associate",
    department: "Operations",
    employmentType: "Part-time",
    location: "Quezon City, Philippines",
    deadline: inDays(45),
    description:
      "Help us get every order out the door looking as good as it tastes. You'll pack, box, and prepare shipments for pickup, delivery, and courier drop-off.",
    requirements:
      "- Detail-oriented with orders and labeling\n- Able to work standing shifts and meet daily fulfillment cutoffs\n- Prior warehouse or packing experience is a plus",
    requiredDocuments: ["Resume", "Government ID"],
    screeningCriteria: ["Attention to detail", "Availability for standing shifts"],
    status: "open",
  },
  {
    id: "customer-care-associate",
    title: "Customer Care Associate",
    department: "Customer Care",
    employmentType: "Full-time",
    location: "Remote (Philippines)",
    deadline: inDays(30),
    description:
      "Be the friendly voice behind Bren Raphael's — answering questions, helping customers place and track orders, and following up after delivery.",
    requirements:
      "- Excellent written English and a friendly, patient tone\n- Comfortable working across chat and social channels\n- Reliable internet connection for remote work",
    requiredDocuments: ["Resume"],
    screeningCriteria: ["Written communication sample", "Availability for remote work"],
    status: "open",
  },
];

async function main() {
  const connectionString = process.env.CAREERS_DATABASE_URL_UNPOOLED || process.env.CAREERS_DATABASE_URL;
  if (!connectionString) throw new Error("CAREERS_DATABASE_URL_UNPOOLED (or CAREERS_DATABASE_URL) is required.");

  const client = postgres(connectionString, { prepare: false });
  const db = drizzle(client);
  try {
    for (const posting of postings) {
      const values = { ...posting, deadline: new Date(posting.deadline), updatedAt: new Date() };
      await db.insert(jobPostings).values(values).onConflictDoUpdate({ target: jobPostings.id, set: values });
    }
    console.log(`Seeded ${postings.length} Job Postings.`);
  } finally {
    await client.end();
  }
}

await main();
