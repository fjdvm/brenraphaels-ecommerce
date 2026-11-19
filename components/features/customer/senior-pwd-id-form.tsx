"use client";

import { useActionState } from "react";

import { sendSeniorPwdId, type SeniorPwdIdState } from "@/app/(site)/(protected)/profile/senior-pwd-actions";
import { SeniorPwdFields } from "@/components/features/auth/senior-pwd-fields";
import { Button } from "@/components/ui/button";

const initialState: SeniorPwdIdState = {};

/** The ID form for a Customer with no ID on file, or whose last one was declined, revoked or expired. */
export function SeniorPwdIdForm() {
  const [state, action, pending] = useActionState(sendSeniorPwdId, initialState);
  return (
    <form action={action} className="flex flex-col gap-5">
      <input name="seniorPwd" type="hidden" value="yes" />
      <SeniorPwdFields askFirst={false} errors={state.fieldErrors ?? {}} />
      {state.message ? <p className="text-sm text-red-700" role="alert">{state.message}</p> : null}
      <div className="flex items-center justify-end">
        <Button disabled={pending} size="pill-sm" type="submit" variant="pill">
          {pending ? "Sending…" : "Send my ID"}
        </Button>
      </div>
    </form>
  );
}
