import type { Metadata } from "next";

export const metadata: Metadata = { title: "Complete your profile" };

export default function CompleteProfilePage() {
  return (
    <section className="bg-surface-container-low px-5 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-xl rounded-2xl bg-surface-card p-8 text-center shadow-sm">
        <h1 className="font-serif text-4xl text-primary">Complete your profile</h1>
        <p className="mt-4 text-on-surface-variant">
          Your login is ready. We still need your Customer details and Home Address
          before you can use your account.
        </p>
      </div>
    </section>
  );
}
