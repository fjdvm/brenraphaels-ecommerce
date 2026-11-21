import { FileText, MapPin, MessageCircle, MessageSquarePlus, Package, SlidersHorizontal, Truck, UserRound } from "lucide-react";

/** Kept out of the `"use client"` account-menu module: a server component importing an array from there gets a client reference, not the array. */
export const accountMenuItems = [
  { href: "/profile/orders", label: "Orders", icon: Package },
  { href: "/profile/delivery", label: "Delivery", icon: Truck },
  { href: "/support", label: "Support", icon: MessageCircle },
  { href: "/profile/addresses", label: "Addresses", icon: MapPin },
  { href: "/profile/settings", label: "Account settings", icon: SlidersHorizontal },
  { href: "/profile/feedback", label: "Feedback", icon: MessageSquarePlus },
];

/** The signed-in Applicant's menu on Careers; the portal tabs that are not header nav links. */
export const careersAccountMenuItems = [
  { href: "/careers/profile", label: "Your profile", icon: UserRound },
  { href: "/careers/applications", label: "Your applications", icon: FileText },
];
