"use client";

import { useActionState, useState } from "react";

import type { ApplicantProfile } from "@/lib/careers/profile";

import { BackLink } from "../_components/back-link";
import { Field, RequiredNote, fieldProps } from "../_components/field";
import { SubmitButton } from "../_components/submit-button";
import { submitApplicantDocument, submitApplicantProfile } from "./actions";

type Document = { id: number; name: string; contentType: string; size: number };
type Education = ApplicantProfile["education"][number];
type WorkHistory = ApplicantProfile["workHistory"][number];
type Errors = Record<string, string | undefined>;

const input = "rounded border p-3";

function EducationFields({ item, index, errors, remove }: { item?: Education; index: number; errors: Errors; remove: () => void }) {
  const id = (name: string) => `education-${index}-${name}`;
  return (
    <fieldset className="grid gap-4 rounded border border-outline-variant/60 p-4">
      <legend className="px-1 font-semibold text-primary">Education {index + 1}</legend>
      <Field id={id("school")} label="School" required error={errors[id("school")]}>
        <input {...fieldProps(id("school"), errors[id("school")])} required name="school" maxLength={200} defaultValue={item?.school ?? ""} className={input} />
      </Field>
      <Field id={id("qualification")} label="Qualification" required error={errors[id("qualification")]}>
        <input {...fieldProps(id("qualification"), errors[id("qualification")])} required name="qualification" maxLength={200} defaultValue={item?.qualification ?? ""} className={input} />
      </Field>
      <Field id={id("fieldOfStudy")} label="Field of study" error={errors[id("fieldOfStudy")]}>
        <input {...fieldProps(id("fieldOfStudy"), errors[id("fieldOfStudy")])} name="fieldOfStudy" maxLength={200} defaultValue={item?.fieldOfStudy ?? ""} className={input} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id("startedOn")} label="Started" error={errors[id("startedOn")]}>
          <input {...fieldProps(id("startedOn"), errors[id("startedOn")])} name="educationStartedOn" type="month" defaultValue={item?.startedOn ?? ""} className={input} />
        </Field>
        <Field id={id("completedOn")} label="Completed" error={errors[id("completedOn")]}>
          <input {...fieldProps(id("completedOn"), errors[id("completedOn")])} name="completedOn" type="month" defaultValue={item?.completedOn ?? ""} className={input} />
        </Field>
      </div>
      <button type="button" onClick={remove} className="justify-self-start text-sm font-semibold text-primary underline">Remove education</button>
    </fieldset>
  );
}

function WorkHistoryFields({ item, index, errors, remove }: { item?: WorkHistory; index: number; errors: Errors; remove: () => void }) {
  const id = (name: string) => `workHistory-${index}-${name}`;
  return (
    <fieldset className="grid gap-4 rounded border border-outline-variant/60 p-4">
      <legend className="px-1 font-semibold text-primary">Work history {index + 1}</legend>
      <Field id={id("employer")} label="Employer" required error={errors[id("employer")]}>
        <input {...fieldProps(id("employer"), errors[id("employer")])} required name="employer" maxLength={200} defaultValue={item?.employer ?? ""} className={input} />
      </Field>
      <Field id={id("title")} label="Job title" required error={errors[id("title")]}>
        <input {...fieldProps(id("title"), errors[id("title")])} required name="title" maxLength={200} defaultValue={item?.title ?? ""} className={input} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id("startedOn")} label="Started" error={errors[id("startedOn")]}>
          <input {...fieldProps(id("startedOn"), errors[id("startedOn")])} name="workStartedOn" type="month" defaultValue={item?.startedOn ?? ""} className={input} />
        </Field>
        <Field id={id("endedOn")} label="Ended" error={errors[id("endedOn")]}>
          <input {...fieldProps(id("endedOn"), errors[id("endedOn")])} name="endedOn" type="month" defaultValue={item?.endedOn ?? ""} className={input} />
        </Field>
      </div>
      <Field id={id("description")} label="Work description" error={errors[id("description")]}>
        <textarea {...fieldProps(id("description"), errors[id("description")])} name="description" maxLength={2000} defaultValue={item?.description ?? ""} className={input} />
      </Field>
      <button type="button" onClick={remove} className="justify-self-start text-sm font-semibold text-primary underline">Remove work history</button>
    </fieldset>
  );
}

export function ApplicantProfileForm({ heading, fullName, profile, documents = [] }: { heading: string; fullName: string; profile?: ApplicantProfile; documents?: Document[] }) {
  const [profileState, profileAction] = useActionState(submitApplicantProfile, {});
  const [documentState, documentAction] = useActionState(submitApplicantDocument, {});
  const [education, setEducation] = useState<Array<Education | undefined>>(profile?.education ?? []);
  const [workHistory, setWorkHistory] = useState<Array<WorkHistory | undefined>>(profile?.workHistory ?? []);
  const [seenState, setSeenState] = useState(profileState);
  if (seenState !== profileState) {
    // A rejected save hands back what was typed; re-seed the rows so React's post-action form reset keeps it.
    setSeenState(profileState);
    if (profileState.values) {
      setEducation(profileState.values.education as Education[]);
      setWorkHistory(profileState.values.workHistory as WorkHistory[]);
    }
  }
  const errors = profileState.fieldErrors ?? {};
  const values = profileState.values;

  return <section className="mx-auto max-w-2xl py-12">
    <BackLink href="/careers" className="text-sm underline">Back</BackLink>
    <h1 className="mt-8 font-serif text-4xl text-primary">{heading}</h1>
    <p className="mt-3 text-on-surface-variant">Keep this reusable information ready for future Job Postings.</p>
    <form action={profileAction} className="mt-8 grid gap-4" noValidate>
      <RequiredNote />
      <Field id="fullName" label="Full name" required error={errors.fullName}>
        <input {...fieldProps("fullName", errors.fullName)} required name="fullName" autoComplete="name" maxLength={200} defaultValue={values?.fullName ?? profile?.fullName ?? fullName} className={input} />
      </Field>
      <Field id="phone" label="Contact number" error={errors.phone}>
        <input {...fieldProps("phone", errors.phone)} name="phone" type="tel" autoComplete="tel" maxLength={30} defaultValue={values?.phone ?? profile?.phone ?? ""} className={input} />
      </Field>
      <Field id="location" label="Location" error={errors.location}>
        <input {...fieldProps("location", errors.location)} name="location" maxLength={200} defaultValue={values?.location ?? profile?.location ?? ""} className={input} />
      </Field>
      <Field id="summary" label="Professional summary" error={errors.summary}>
        <textarea {...fieldProps("summary", errors.summary)} name="summary" maxLength={2000} defaultValue={values?.summary ?? profile?.summary ?? ""} className={input} />
      </Field>
      <Field id="skills" label="Skills" error={errors.skills} hint="Separate skills with commas.">
        <input {...fieldProps("skills", errors.skills)} name="skills" maxLength={2000} defaultValue={values?.skills ?? profile?.skills ?? ""} className={input} />
      </Field>
      <h2 className="mt-4 font-serif text-2xl text-primary">Education</h2>
      {errors.education ? <p className="text-sm text-red-700" role="alert">{errors.education}</p> : null}
      {education.map((item, index) => <EducationFields key={index} item={item} index={index} errors={errors} remove={() => setEducation((items) => items.filter((_, itemIndex) => itemIndex !== index))} />)}
      {education.length < 20 ? <button type="button" onClick={() => setEducation((items) => [...items, undefined])} className="justify-self-start font-semibold text-primary underline">Add education</button> : null}
      <h2 className="mt-4 font-serif text-2xl text-primary">Work history</h2>
      {errors.workHistory ? <p className="text-sm text-red-700" role="alert">{errors.workHistory}</p> : null}
      {workHistory.map((item, index) => <WorkHistoryFields key={index} item={item} index={index} errors={errors} remove={() => setWorkHistory((items) => items.filter((_, itemIndex) => itemIndex !== index))} />)}
      {workHistory.length < 30 ? <button type="button" onClick={() => setWorkHistory((items) => [...items, undefined])} className="justify-self-start font-semibold text-primary underline">Add work history</button> : null}
      <SubmitButton pendingLabel="Saving profile…" className="rounded bg-primary p-3 font-semibold text-on-primary">Save profile</SubmitButton>
    </form>
    {profileState.message ? <p className="mt-3 text-sm" role="alert">{profileState.message}</p> : null}
    {profile ? <section className="mt-12">
      <h2 className="font-serif text-2xl text-primary">Documents</h2>
      <form action={documentAction} className="mt-4 grid gap-3" noValidate>
        <RequiredNote />
        <Field id="document" label="Document (PDF, Word, JPEG or PNG, up to 10 MB)" required>
          <input {...fieldProps("document")} required name="document" type="file" accept=".pdf,.doc,.docx,image/jpeg,image/png" />
        </Field>
        <SubmitButton pendingLabel="Uploading…" className="justify-self-start rounded bg-primary px-4 py-2 font-semibold text-on-primary">Upload Document</SubmitButton>
      </form>
      {documentState.message ? <p className="mt-3 text-sm" role="alert">{documentState.message}</p> : null}
      <ul className="mt-4 list-disc pl-5">{documents.map((document) => <li key={document.id}>{document.name}</li>)}</ul>
    </section> : null}
  </section>;
}
