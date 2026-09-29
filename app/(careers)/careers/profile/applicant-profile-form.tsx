"use client";

import { useActionState, useState } from "react";

import type { ApplicantProfile } from "@/lib/careers/profile";

import { SubmitButton } from "../_components/submit-button";
import { submitApplicantDocument, submitApplicantProfile } from "./actions";

type Document = { id: number; name: string; contentType: string; size: number };
type Education = ApplicantProfile["education"][number];
type WorkHistory = ApplicantProfile["workHistory"][number];

function EducationFields({ item, index, remove }: { item?: Education; index: number; remove: () => void }) {
  return (
    <fieldset className="grid gap-4 rounded border border-outline-variant/60 p-4">
      <legend className="px-1 font-semibold text-primary">Education {index + 1}</legend>
      <input required name="school" defaultValue={item?.school ?? ""} placeholder="School" className="rounded border p-3" />
      <input required name="qualification" defaultValue={item?.qualification ?? ""} placeholder="Qualification" className="rounded border p-3" />
      <input name="fieldOfStudy" defaultValue={item?.fieldOfStudy ?? ""} placeholder="Field of study" className="rounded border p-3" />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">Started <input name="educationStartedOn" type="month" defaultValue={item?.startedOn ?? ""} className="rounded border p-3" /></label>
        <label className="grid gap-1 text-sm">Completed <input name="completedOn" type="month" defaultValue={item?.completedOn ?? ""} className="rounded border p-3" /></label>
      </div>
      <button type="button" onClick={remove} className="justify-self-start text-sm font-semibold text-primary underline">Remove education</button>
    </fieldset>
  );
}

function WorkHistoryFields({ item, index, remove }: { item?: WorkHistory; index: number; remove: () => void }) {
  return (
    <fieldset className="grid gap-4 rounded border border-outline-variant/60 p-4">
      <legend className="px-1 font-semibold text-primary">Work history {index + 1}</legend>
      <input required name="employer" defaultValue={item?.employer ?? ""} placeholder="Employer" className="rounded border p-3" />
      <input required name="title" defaultValue={item?.title ?? ""} placeholder="Job title" className="rounded border p-3" />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">Started <input name="workStartedOn" type="month" defaultValue={item?.startedOn ?? ""} className="rounded border p-3" /></label>
        <label className="grid gap-1 text-sm">Ended <input name="endedOn" type="month" defaultValue={item?.endedOn ?? ""} className="rounded border p-3" /></label>
      </div>
      <textarea name="description" defaultValue={item?.description ?? ""} placeholder="Work description" className="rounded border p-3" />
      <button type="button" onClick={remove} className="justify-self-start text-sm font-semibold text-primary underline">Remove work history</button>
    </fieldset>
  );
}

export function ApplicantProfileForm({ heading, fullName, profile, documents = [] }: { heading: string; fullName: string; profile?: ApplicantProfile; documents?: Document[] }) {
  const [profileState, profileAction] = useActionState(submitApplicantProfile, {});
  const [documentState, documentAction] = useActionState(submitApplicantDocument, {});
  const [education, setEducation] = useState<Array<Education | undefined>>(profile?.education ?? []);
  const [workHistory, setWorkHistory] = useState<Array<WorkHistory | undefined>>(profile?.workHistory ?? []);

  return <section className="mx-auto max-w-2xl py-12">
    <h1 className="font-serif text-4xl text-primary">{heading}</h1>
    <p className="mt-3 text-on-surface-variant">Keep this reusable information ready for future Job Postings.</p>
    <form action={profileAction} className="mt-8 grid gap-4">
      <input required name="fullName" defaultValue={profile?.fullName ?? fullName} placeholder="Full name" className="rounded border p-3" />
      <input name="phone" defaultValue={profile?.phone ?? ""} placeholder="Contact number" className="rounded border p-3" />
      <input name="location" defaultValue={profile?.location ?? ""} placeholder="Location" className="rounded border p-3" />
      <textarea name="summary" defaultValue={profile?.summary ?? ""} placeholder="Professional summary" className="rounded border p-3" />
      <input name="skills" defaultValue={profile?.skills ?? ""} placeholder="Skills (comma separated)" className="rounded border p-3" />
      <h2 className="mt-4 font-serif text-2xl text-primary">Education</h2>
      {education.map((item, index) => <EducationFields key={index} item={item} index={index} remove={() => setEducation((items) => items.filter((_, itemIndex) => itemIndex !== index))} />)}
      {education.length < 20 ? <button type="button" onClick={() => setEducation((items) => [...items, undefined])} className="justify-self-start font-semibold text-primary underline">Add education</button> : null}
      <h2 className="mt-4 font-serif text-2xl text-primary">Work history</h2>
      {workHistory.map((item, index) => <WorkHistoryFields key={index} item={item} index={index} remove={() => setWorkHistory((items) => items.filter((_, itemIndex) => itemIndex !== index))} />)}
      {workHistory.length < 30 ? <button type="button" onClick={() => setWorkHistory((items) => [...items, undefined])} className="justify-self-start font-semibold text-primary underline">Add work history</button> : null}
      <SubmitButton pendingLabel="Saving profile…" className="rounded bg-primary p-3 font-semibold text-on-primary">Save profile</SubmitButton>
    </form>
    {profileState.message ? <p className="mt-3 text-sm" role="alert">{profileState.message}</p> : null}
    {profile ? <section className="mt-12">
      <h2 className="font-serif text-2xl text-primary">Documents</h2>
      <form action={documentAction} className="mt-4 flex gap-3">
        <input required name="document" type="file" accept=".pdf,.doc,.docx,image/jpeg,image/png" />
        <SubmitButton pendingLabel="Uploading…" className="rounded bg-primary px-4 py-2 font-semibold text-on-primary">Upload Document</SubmitButton>
      </form>
      {documentState.message ? <p className="mt-3 text-sm" role="alert">{documentState.message}</p> : null}
      <ul className="mt-4 list-disc pl-5">{documents.map((document) => <li key={document.id}>{document.name}</li>)}</ul>
    </section> : null}
  </section>;
}
