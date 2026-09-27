import { defineConfig } from "drizzle-kit";
const url = process.env.CAREERS_DATABASE_URL_UNPOOLED;
if (!url) throw new Error("CAREERS_DATABASE_URL_UNPOOLED is required for Careers migrations.");
export default defineConfig({ dialect: "postgresql", schema: "./lib/careers/schema.ts", out: "./drizzle-careers", dbCredentials: { url } });
