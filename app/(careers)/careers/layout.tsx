import localFont from "next/font/local";
import { CareersToaster } from "./_components/action-toast";

const dmSans = localFont({
  src: "../../fonts/dm-sans.woff2",
  variable: "--font-dm-sans",
  weight: "400 700",
  display: "swap",
});

/** The Careers redesign's tokens and DM Sans (see `.careers-theme` in globals.css); the Storefront is unaffected. */
export default function CareersLayout({ children }: LayoutProps<"/careers">) {
  return (
    <div className={`${dmSans.variable} careers-theme flex flex-1 flex-col bg-background text-foreground`}>
      {children}
      <CareersToaster />
    </div>
  );
}
