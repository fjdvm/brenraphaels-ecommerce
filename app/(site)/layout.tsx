import { Footer } from "@/components/shared/footer";
import { Header } from "@/components/shared/header";
import { SessionNav } from "@/components/shared/session-nav";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Header
        desktopSession={
          <SessionNav className="hidden items-center gap-5 text-sm font-semibold text-on-surface-variant md:flex" />
        }
        mobileSession={
          <SessionNav className="flex flex-col gap-3 border-t border-outline-variant/60 pt-3 text-sm font-semibold text-on-surface" />
        }
      />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
