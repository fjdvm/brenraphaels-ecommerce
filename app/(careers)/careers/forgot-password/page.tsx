"use client";

import { useActionState } from "react";
import { submitApplicantForgotPassword } from "./actions";
import { BackLink } from "../_components/back-link";
export default function ApplicantForgotPasswordPage() { const [state, action, pending] = useActionState(submitApplicantForgotPassword, {}); return <section className="mx-auto max-w-md py-16"><BackLink href="/careers" className="text-sm underline">Back</BackLink><h1 className="mt-8 font-serif text-4xl text-primary">Reset password</h1><form action={action} className="mt-6 grid gap-4"><input required name="email" type="email" placeholder="Email address" className="rounded border p-3"/><button disabled={pending} className="rounded bg-primary p-3 font-semibold text-on-primary">Email reset link</button></form>{state.message ? <p className="mt-4 text-sm" role="alert">{state.message}</p> : null}</section>; }
