import { Card } from "@/components/ui/card";
export function AccountEmptyState({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <Card className="p-6 shadow-sm sm:p-10">
      <h2 className="font-serif text-3xl text-primary">{title}</h2>
      <p className="mt-3 max-w-xl text-on-surface-variant">{description}</p>
      <p className="mt-8 border-t border-outline-variant/60 pt-5 text-sm text-on-surface-variant">
        This part of your account is being prepared.
      </p>
    </Card>
  );
}
