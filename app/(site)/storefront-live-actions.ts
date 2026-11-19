"use server";

import { liveInboxUrl } from "@/lib/notifications/inbox";

/** The shared recipient CREOMS nudges when a shop setting changes. It holds no personal data: any visitor may listen. */
const STOREFRONT_CHANNEL = "storefront-public";

/** The address for the shop-wide live line, or null when it cannot be issued; the page then just stays as loaded. */
export async function storefrontLiveUrl(): Promise<string | null> {
  try {
    return await liveInboxUrl(STOREFRONT_CHANNEL);
  } catch (error) {
    console.error("Live shop settings pass could not be issued", error);
    return null;
  }
}
