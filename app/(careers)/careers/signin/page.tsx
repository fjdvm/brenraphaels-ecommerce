"use client";

import Link from "next/link";
import { useActionState } from "react";
import { PasswordInput } from "@/components/ui/password-input";
import { submitApplicantSignIn } from "./actions";
import { BackLink } from "../_components/back-link";
export default function ApplicantSignInPage() { const [state, action, pending] = useActionState(submitApplicantSignIn, {}); return <section className="mx-auto max-w-md py-16"><BackLink href="/careers" className="text-sm underline">Back</BackLink><h1 className="mt-8 font-serif text-4xl text-primary">Applicant sign in</h1><form action={action} className="mt-6 grid gap-4"><input required name="email" type="email" placeholder="Email address" className="rounded border p-3"/><PasswordInput required name="password" autoComplete="current-password" placeholder="Password" className="rounded"/><button disabled={pending} className="rounded bg-primary p-3 font-semibold text-on-primary">Sign in</button></form>{state.message ? <p className="mt-4 text-sm" role="alert">{state.message}</p> : null}<Link className="mt-5 inline-block text-sm underline" href="/careers/forgot-password">Forgot your password?</Link></section>; }
