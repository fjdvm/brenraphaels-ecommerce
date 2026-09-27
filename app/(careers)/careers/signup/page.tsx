"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitApplicantSignUp } from "./actions";
export default function ApplicantSignUpPage() { const [state, action, pending] = useActionState(submitApplicantSignUp, {}); return <section className="mx-auto max-w-md py-16"><Link className="text-sm underline" href="/">Back to home</Link><h1 className="mt-8 font-serif text-4xl text-primary">Become an Applicant</h1><form action={action} className="mt-6 grid gap-4"><input required name="name" placeholder="Full name" className="rounded border p-3"/><input required name="email" type="email" placeholder="Email address" className="rounded border p-3"/><input required name="password" type="password" minLength={8} placeholder="Password" className="rounded border p-3"/><button disabled={pending} className="rounded bg-primary p-3 font-semibold text-on-primary">Create Applicant account</button></form>{state.message ? <p className="mt-4 text-sm" role="alert">{state.message}</p> : null}<p className="mt-5 text-sm">Already an Applicant? <Link className="underline" href="/careers/signin">Sign in</Link></p></section>; }
