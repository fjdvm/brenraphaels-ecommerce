import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// Containers are square (AGENTS.md "Square containers"). Pills, buttons, badges, avatars and circular icon buttons
// use rounded-full; everything else must not round its corners. A file listed below still rounds a container and
// is migrated by a later square-look ticket; remove its entry when it is clean (a stale entry fails this test).
const root = path.resolve(import.meta.dirname, "..");
const roots = ["app", "components"];
const rounded = /(?<![\w-])rounded(?:-[trbl]{1,2})?(?:-(?!full\b|none\b)[\w\[\]./]+)?(?![\w-])/;
const allowed: Record<string, string> = {
  "app/(careers)/careers/(portal)/applications/page.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/(portal)/loading.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/(portal)/notifications/applicant-notifications-feed.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/(portal)/notifications/page.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/(portal)/page.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/(portal)/profile/applicant-profile-form.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/(portal)/profile/job-alerts-toggle.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/application-documents.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/application-end-state.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/application-interview.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/application-offer.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/application-progress-strip.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/application-sent.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/application-side-panels.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/application-skeleton.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/application-stepper.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/application-submission.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/apply-card.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/document-list.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/document-viewer.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/filter-form.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/job-detail-skeleton.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/job-detail.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/job-postings-list.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/offer-details-form.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/offer-reply-controls.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/reschedule-interview.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/skeletons.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/upload-document-dialog.tsx": "Careers portal: square in the Careers slice",
  "app/(careers)/careers/_components/withdraw-application.tsx": "Careers portal: square in the Careers slice",
  "app/(site)/(protected)/support/layout.tsx": "Storefront account, orders and auth: square in the Account slice",
  "app/(site)/about/page.tsx": "Marketing pages: square in the Marketing slice",
  "app/(site)/contact/page.tsx": "Marketing pages: square in the Marketing slice",
  "app/(site)/page.tsx": "Storefront shop and Home: square in the Shop slice",
  "app/(site)/products/[slug]/page.tsx": "Storefront shop and Home: square in the Shop slice",
  "app/(site)/vision-mission/page.tsx": "Marketing pages: square in the Marketing slice",
  "components/features/about/about-cta.tsx": "Marketing pages: square in the Marketing slice",
  "components/features/about/media-card.tsx": "Marketing pages: square in the Marketing slice",
  "components/features/about/partnerships-carousel.tsx": "Marketing pages: square in the Marketing slice",
  "components/features/about/photo-tile.tsx": "Marketing pages: square in the Marketing slice",
  "components/features/auth/auth-card.tsx": "Storefront account, orders and auth: square in the Account slice",
  "components/features/auth/sign-up-form.tsx": "Storefront account, orders and auth: square in the Account slice",
  "components/features/careers/applicant-auth-card.tsx": "Careers portal: square in the Careers slice",
  "components/features/careers/careers-auth-shell.tsx": "Careers portal: square in the Careers slice",
  "components/features/careers/careers-header-shell.tsx": "Careers portal: square in the Careers slice",
  "components/features/careers/careers-logo.tsx": "Careers portal: square in the Careers slice",
  "components/features/careers/careers-nav-links.tsx": "Careers portal: square in the Careers slice",
  "components/features/careers/hero-images.tsx": "Careers portal: square in the Careers slice",
  "components/features/careers/how-hiring-works.tsx": "Careers portal: square in the Careers slice",
  "components/features/careers/why-work-with-us.tsx": "Careers portal: square in the Careers slice",
  "components/features/catalog/product-card.tsx": "Storefront shop and Home: square in the Shop slice",
  "components/features/catalog/product-gallery.tsx": "Storefront shop and Home: square in the Shop slice",
  "components/features/catalog/product-page-frame.tsx": "Storefront shop and Home: square in the Shop slice",
  "components/features/catalog/product-quick-order.tsx": "Storefront shop and Home: square in the Shop slice",
  "components/features/catalog/products-frame.tsx": "Storefront shop and Home: square in the Shop slice",
  "components/features/contact/contact-form.tsx": "Marketing pages: square in the Marketing slice",
  "components/features/contact/store-map.tsx": "Marketing pages: square in the Marketing slice",
  "components/features/customer/account-empty-state.tsx": "Storefront account, orders and auth: square in the Account slice",
  "components/features/customer/address-forms.tsx": "Storefront account, orders and auth: square in the Account slice",
  "components/features/customer/customer-sidebar.tsx": "Storefront account, orders and auth: square in the Account slice",
  "components/features/customer/notifications-feed.tsx": "Storefront account, orders and auth: square in the Account slice",
  "components/features/customer/settings-card.tsx": "Storefront account, orders and auth: square in the Account slice",
  "components/features/customer/skeletons.tsx": "Storefront account, orders and auth: square in the Account slice",
  "components/features/faq/faq-browser.tsx": "Marketing pages: square in the Marketing slice",
  "components/features/home/bestsellers.tsx": "Storefront shop and Home: square in the Shop slice",
  "components/features/home/kind-words.tsx": "Storefront shop and Home: square in the Shop slice",
  "components/features/home/video-card.tsx": "Storefront shop and Home: square in the Shop slice",
  "components/features/orders/add-to-cart.tsx": "Storefront account, orders and auth: square in the Account slice",
  "components/features/orders/cart-skeleton.tsx": "Storefront account, orders and auth: square in the Account slice",
  "components/features/orders/cart-thumbnail.tsx": "Storefront account, orders and auth: square in the Account slice",
  "components/features/orders/cart.tsx": "Storefront account, orders and auth: square in the Account slice",
  "components/features/orders/checkout-skeleton.tsx": "Storefront account, orders and auth: square in the Account slice",
  "components/features/orders/checkout.tsx": "Storefront account, orders and auth: square in the Account slice",
  "components/features/orders/order-feedback-form.tsx": "Storefront account, orders and auth: square in the Account slice",
  "components/features/orders/orders-browser.tsx": "Storefront account, orders and auth: square in the Account slice",
  "components/features/orders/payment-proof-form.tsx": "Storefront account, orders and auth: square in the Account slice",
  "components/features/orders/return-request-form.tsx": "Storefront account, orders and auth: square in the Account slice",
  "components/features/orders/returns-list.tsx": "Storefront account, orders and auth: square in the Account slice",
  "components/features/support/open-ticket-form.tsx": "Storefront account, orders and auth: square in the Account slice",
  "components/features/support/skeletons.tsx": "Storefront account, orders and auth: square in the Account slice",
  "components/features/support/ticket-thread.tsx": "Storefront account, orders and auth: square in the Account slice",
  "components/shared/auth-shell.tsx": "Shared shell logo/loader image: square in the Shell slice",
  "components/shared/footer.tsx": "Shared shell logo/loader image: square in the Shell slice",
  "components/shared/header.tsx": "Shared shell logo/loader image: square in the Shell slice",
  "components/shared/page-transition.tsx": "Shared shell logo/loader image: square in the Shell slice",
};

function sources(dir: string): string[] {
  let names: string[];
  try { names = readdirSync(dir); } catch { return []; }
  return names.flatMap((name) => {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) return name === "node_modules" ? [] : sources(file);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [file] : [];
  });
}

const rounding = roots
  .flatMap((r) => sources(path.join(root, r)))
  .map((file) => path.relative(root, file).split(path.sep).join("/"))
  .filter((file) => rounded.test(readFileSync(path.join(root, file), "utf8")));

describe("square containers", () => {
  it("rounds no container outside the allowlist", () => {
    expect(rounding.filter((file) => !(file in allowed))).toEqual([]);
  });

  it("lists only files that still round a container", () => {
    expect(Object.keys(allowed).filter((file) => !rounding.includes(file))).toEqual([]);
  });
});
