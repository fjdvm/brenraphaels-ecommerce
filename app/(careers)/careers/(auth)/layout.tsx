import { CareersAuthShell } from "@/components/features/careers/careers-auth-shell";

export default function CareersAuthLayout({ children }: LayoutProps<"/careers">) {
  return <CareersAuthShell>{children}</CareersAuthShell>;
}
