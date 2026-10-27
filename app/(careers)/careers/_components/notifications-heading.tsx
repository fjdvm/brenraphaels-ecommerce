import { eyebrowClass } from "@/components/features/about/section-heading";

export function NotificationsHeading() {
  return (
    <div className="flex flex-col gap-4">
      <p className={eyebrowClass}>Careers</p>
      <h1 className="font-serif text-4xl leading-[1.2] text-primary sm:text-[54px]">Notifications</h1>
      <p className="leading-[1.6] tracking-[0.35px] text-body">New Job Postings and updates, newest first.</p>
    </div>
  );
}
