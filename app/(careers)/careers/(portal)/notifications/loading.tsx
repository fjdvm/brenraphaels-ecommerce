import { NotificationsHeading } from "@/app/(careers)/careers/_components/notifications-heading";
import { CareersNotificationsSkeleton } from "@/app/(careers)/careers/_components/skeletons";

export default function Loading() {
  return (
    <section className="mx-auto w-full max-w-[1440px] px-5 pb-[100px] pt-[50px] sm:px-10">
      <NotificationsHeading />
      <div className="mt-[30px]">
        <CareersNotificationsSkeleton />
      </div>
    </section>
  );
}
