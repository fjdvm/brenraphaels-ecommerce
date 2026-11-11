import { DM_Sans } from "next/font/google";
import { CareersToaster } from "./_components/action-toast";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
