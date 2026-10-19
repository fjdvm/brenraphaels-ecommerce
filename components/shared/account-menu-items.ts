import { MapPin, MessageCircle, Package, SlidersHorizontal } from "lucide-react";

/** Kept out of the `"use client"` account-menu module: a server component importing an array from there gets a client reference, not the array. */
export const accountMenuItems = [
  { href: "/profile/orders", label: "Orders", icon: Package },
  { href: "/support", label: "Support", icon: MessageCircle },
  { href: "/profile/addresses", label: "Addresses", icon: MapPin },
  { href: "/profile/settings", label: "Account settings", icon: SlidersHorizontal },
];
