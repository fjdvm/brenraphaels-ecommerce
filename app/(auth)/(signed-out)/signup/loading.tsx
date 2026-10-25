import { SignUpForm } from "@/components/features/auth/sign-up-form";
import { listProvinces } from "@/lib/address/locations";

export default function SignUpLoading() {
  return <SignUpForm provinces={listProvinces()} />;
}
