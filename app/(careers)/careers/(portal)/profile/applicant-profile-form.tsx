"use client";

import { Briefcase, Calendar, Check, FileText, Upload, X } from "lucide-react";
import { useActionState, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";

import { eyebrowClass } from "@/components/features/about/section-heading";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { fieldClass } from "@/components/ui/field-styles";
import { Input } from "@/components/ui/input";
import type { ApplicantProfile } from "@/lib/careers/profile";
import { cn } from "@/lib/utils";
import { DOCUMENT_MAX_SIZE_MB } from "@/lib/validators/document";

import { Field, RequiredMark, fieldProps } from "@/app/(careers)/careers/_components/field";
import { submitApplicantProfile, type ApplicantProfileActionState } from "./actions";
import { submitApplicantDocument } from "./document-upload";
import { JobAlertsToggle } from "./job-alerts-toggle";
import { profileStrength } from "./profile-strength";
import { runWithToast } from "../../_components/action-toast";

type Document = { id: number; name: string; contentType: string; size: number };
type Education = ApplicantProfile["education"][number];
type WorkHistory = ApplicantProfile["workHistory"][number];
type Errors = Record<string, string | undefined>;

const cardClass = "flex flex-col gap-5 rounded-[28px] border border-line bg-white px-5 py-6 sm:rounded-[40px] sm:p-10";
const cardTitleClass = "font-serif text-lg leading-[1.35] text-primary sm:text-[22px] sm:leading-[1.3]";
const textareaClass = `${fieldClass} min-h-32 w-full border border-input bg-white outline-none focus:ring-2 focus:ring-ring`;

function splitSkills(skills: string | undefined) {
  return (skills ?? "").split(",").map((skill) => skill.trim()).filter(Boolean);
}

function documentSummary(document: Document) {
  const kind = document.contentType.includes("pdf")
    ? "PDF"
    : document.contentType.includes("word")
      ? "Word"
      : document.contentType.startsWith("image/")
        ? document.contentType.slice(6).toUpperCase()
        : "File";
  const size = document.size >= 1024 * 1024 ? `${(document.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(document.size / 1024))} KB`;
  return `${kind} · ${size}`;
}

function SectionRow({ title, add, addLabel, children }: { title: string; add?: () => void; addLabel?: string; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 sm:gap-[30px]">
      <h2 className={cardTitleClass}>{title}</h2>
      <span aria-hidden className="flex-1" />
      {add ? (
        <Button type="button" variant="pill-outline" size="pill-sm" onClick={add} aria-label={addLabel}>
          Add
        </Button>
      ) : null}
      {children}
    </div>
  );
}

function EmptyHint({ icon: Icon, children }: { icon: typeof Calendar; children: ReactNode }) {
  return (
    <p className="flex items-center gap-3.5 rounded-[3px] bg-surface-soft p-5 text-sm tracking-[0.35px] text-muted">
      <Icon aria-hidden className="size-5 shrink-0" />
      {children}
    </p>
  );
}

function RemoveButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="justify-self-start text-sm font-medium tracking-[0.35px] text-primary underline underline-offset-2">
      {children}
    </button>
  );
}

function EducationFields({ item, index, errors, remove }: { item?: Education; index: number; errors: Errors; remove: () => void }) {
  const id = (name: string) => `education-${index}-${name}`;
  return (
    <fieldset className="grid gap-4 rounded-[3px] border border-line p-5">
      <legend className="px-1 text-sm font-medium text-primary">Education {index + 1}</legend>
      <Field id={id("school")} label="School" required error={errors[id("school")]}>
        <Input {...fieldProps(id("school"), errors[id("school")])} required name="school" maxLength={200} defaultValue={item?.school ?? ""} className={fieldClass} />
      </Field>
      <Field id={id("qualification")} label="Qualification" required error={errors[id("qualification")]}>
        <Input {...fieldProps(id("qualification"), errors[id("qualification")])} required name="qualification" maxLength={200} defaultValue={item?.qualification ?? ""} className={fieldClass} />
      </Field>
      <Field id={id("fieldOfStudy")} label="Field of study" error={errors[id("fieldOfStudy")]}>
        <Input {...fieldProps(id("fieldOfStudy"), errors[id("fieldOfStudy")])} name="fieldOfStudy" maxLength={200} defaultValue={item?.fieldOfStudy ?? ""} className={fieldClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id("startedOn")} label="Started" error={errors[id("startedOn")]}>
          <Input {...fieldProps(id("startedOn"), errors[id("startedOn")])} name="educationStartedOn" type="month" defaultValue={item?.startedOn ?? ""} className={fieldClass} />
        </Field>
        <Field id={id("completedOn")} label="Completed" error={errors[id("completedOn")]}>
          <Input {...fieldProps(id("completedOn"), errors[id("completedOn")])} name="completedOn" type="month" defaultValue={item?.completedOn ?? ""} className={fieldClass} />
        </Field>
      </div>
      <RemoveButton onClick={remove}>Remove education</RemoveButton>
    </fieldset>
  );
}

function WorkHistoryFields({ item, index, errors, remove }: { item?: WorkHistory; index: number; errors: Errors; remove: () => void }) {
  const id = (name: string) => `workHistory-${index}-${name}`;
  return (
    <fieldset className="grid gap-4 rounded-[3px] border border-line p-5">
      <legend className="px-1 text-sm font-medium text-primary">Work history {index + 1}</legend>
      <Field id={id("employer")} label="Employer" required error={errors[id("employer")]}>
        <Input {...fieldProps(id("employer"), errors[id("employer")])} required name="employer" maxLength={200} defaultValue={item?.employer ?? ""} className={fieldClass} />
      </Field>
      <Field id={id("title")} label="Job title" required error={errors[id("title")]}>
        <Input {...fieldProps(id("title"), errors[id("title")])} required name="title" maxLength={200} defaultValue={item?.title ?? ""} className={fieldClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id("startedOn")} label="Started" error={errors[id("startedOn")]}>
          <Input {...fieldProps(id("startedOn"), errors[id("startedOn")])} name="workStartedOn" type="month" defaultValue={item?.startedOn ?? ""} className={fieldClass} />
        </Field>
        <Field id={id("endedOn")} label="Ended" error={errors[id("endedOn")]}>
          <Input {...fieldProps(id("endedOn"), errors[id("endedOn")])} name="endedOn" type="month" defaultValue={item?.endedOn ?? ""} className={fieldClass} />
        </Field>
      </div>
      <Field id={id("description")} label="Work description" error={errors[id("description")]}>
        <textarea {...fieldProps(id("description"), errors[id("description")])} name="description" maxLength={2000} defaultValue={item?.description ?? ""} className={textareaClass} />
      </Field>
      <RemoveButton onClick={remove}>Remove work history</RemoveButton>
    </fieldset>
  );
}

/** Skills as removable tags: Enter (or a comma) adds one, and the form submits them as a comma-separated list. */
function SkillTags({ skills, setSkills, error }: { skills: string[]; setSkills: (skills: string[]) => void; error?: string }) {
  const [draft, setDraft] = useState("");

  function commit() {
    const skill = draft.trim();
    setDraft("");
    if (skill && !skills.some((existing) => existing.toLowerCase() === skill.toLowerCase())) setSkills([...skills, skill]);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit();
    } else if (event.key === "Backspace" && draft === "" && skills.length > 0) {
      setSkills(skills.slice(0, -1));
    }
  }

  return (
    <div className="grid gap-2.5">
      <label htmlFor="skills-draft" className="text-[13px] font-medium tracking-[0.35px] text-ink">Skills</label>
      <input type="hidden" name="skills" value={skills.join(", ")} />
      <div className="flex flex-wrap items-center gap-2 rounded-[3px] border border-line bg-white px-3 py-2.5 focus-within:ring-2 focus-within:ring-ring">
        {skills.map((skill) => (
          <span key={skill} className="flex items-center gap-1.5 rounded-full bg-lavender py-[5px] pl-3 pr-2 text-xs tracking-[0.35px] text-primary">
            {skill}
            <button type="button" aria-label={`Remove ${skill}`} onClick={() => setSkills(skills.filter((existing) => existing !== skill))} className="rounded-full hover:bg-white/60">
              <X aria-hidden className="size-3" />
            </button>
          </span>
        ))}
        <input
          id="skills-draft"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
          maxLength={100}
          placeholder="Type a skill and press Enter"
          className="min-w-40 flex-1 bg-transparent py-1 text-sm tracking-[0.35px] outline-none placeholder:text-muted"
        />
      </div>
      {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}

function Documents({ profileSaved, documents }: { profileSaved: boolean; documents: Document[] }) {
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);

  /** Server steps and the direct PUT to file-storage; only a confirmed Document is claimed as uploaded. */
  async function upload(file: File) {
    if (file.size === 0) return setMessage("Choose a file to upload.");
    setPending(true);
    setMessage(undefined);
    try {
      const form = new FormData();
      form.set("document", file);
      setMessage((await submitApplicantDocument({}, form)).message);
    } catch {
      setMessage("We couldn't upload that Document. Try again.");
    } finally {
      setPending(false);
    }
  }

  function drop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && profileSaved && !pending) void upload(file);
  }

  return (
    <section className={cn(cardClass, "gap-4")}>
      <h2 className={cardTitleClass}>Documents<RequiredMark /></h2>
      {documents.length > 0 ? (
        <ul className="grid gap-4">
          {documents.map((document) => (
            <li key={document.id} className="flex items-center gap-3.5 rounded-[3px] border border-line px-5 py-4">
              <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-lavender text-primary">
                <FileText className="size-[18px]" strokeWidth={1.5} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium tracking-[0.35px] text-ink">{document.name}</span>
                <span className="block text-xs tracking-[0.35px] text-muted">{documentSummary(document)}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <form noValidate onSubmit={(event) => event.preventDefault()}>
        <label
          onDragOver={(event) => event.preventDefault()}
          onDrop={drop}
          className={cn(
            "flex items-center gap-4 rounded-[3px] border border-dashed border-primary bg-lavender-soft p-6 focus-within:ring-2 focus-within:ring-ring",
            profileSaved && !pending ? "cursor-pointer" : "cursor-not-allowed opacity-60",
          )}
        >
          <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-primary">
            <Upload className="size-5" strokeWidth={1.5} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium tracking-[0.35px] text-primary">
              {pending ? "Uploading…" : "Drop a file or browse"}
            </span>
            <span className="block text-xs tracking-[0.35px] text-muted">
              {profileSaved ? `PDF, Word, JPEG or PNG · up to ${DOCUMENT_MAX_SIZE_MB} MB` : "Save your profile first, then upload your documents."}
            </span>
          </span>
          <input
            {...fieldProps("document")}
            required
            name="document"
            type="file"
            accept=".pdf,.doc,.docx,image/jpeg,image/png"
            disabled={!profileSaved || pending}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void upload(file);
            }}
            className="sr-only"
          />
        </label>
      </form>
      {message ? <p className="text-sm tracking-[0.35px] text-body" role="status">{message}</p> : null}
    </section>
  );
}

function ProfileStrength({ percent, steps }: ReturnType<typeof profileStrength>) {
  return (
    <section className="order-first flex flex-col gap-3 rounded-[28px] bg-primary px-5 py-[22px] text-white sm:gap-[18px] sm:rounded-[40px] sm:p-10 lg:order-none">
      <p className="text-xs font-medium uppercase leading-normal tracking-[0.15em] text-accent">Profile strength</p>
      <p className="font-serif text-[22px] leading-[1.3] sm:text-[40px] sm:leading-[1.2]">{percent}% complete</p>
      <div role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Profile strength" className="h-2 overflow-hidden rounded bg-white">
        <div className="h-full rounded bg-accent" style={{ width: `${percent}%` }} />
      </div>
      <ul className="flex flex-col gap-[18px]">
        {steps.map((step) => (
          <li key={step.label} className="flex items-center gap-2.5 text-sm tracking-[0.35px]">
            <span aria-hidden className={cn("flex size-[22px] shrink-0 items-center justify-center rounded-full", step.done ? "bg-accent text-primary" : "border-[1.5px] border-white/40")}>
              {step.done ? <Check className="size-3" strokeWidth={2.5} /> : null}
            </span>
            {step.label}
            <span className="sr-only">{step.done ? " (done)" : " (to do)"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Saves behind the shared result card: "Saving…", then "Profile saved", or the error with Retry. Field errors stay inline. */
async function saveProfileWithToast(previous: ApplicantProfileActionState, formData: FormData): Promise<ApplicantProfileActionState> {
  let latest: ApplicantProfileActionState = previous;
  await runWithToast({
    loading: "Saving…",
    success: "Profile saved",
    error: "We couldn't save your profile. Try again.",
    task: async () => {
      // Retry re-sends the same typed values.
      latest = await submitApplicantProfile(previous, formData);
      if (latest.saved) return { ok: true };
      return { ok: false, message: latest.fieldErrors ? "Check the highlighted fields." : (latest.message ?? "") };
    },
  });
  return latest;
}

export function ApplicantProfileForm({ heading, fullName, profile, documents = [], locations = [] }: { heading: string; fullName: string; profile?: ApplicantProfile & { jobAlertsOptIn?: boolean }; documents?: Document[]; locations?: string[] }) {
  const [profileState, profileAction, profilePending] = useActionState(saveProfileWithToast, {});
  const currentLocation = profileState.values?.location ?? profile?.location ?? "";
  // A stored value from before Location was a dropdown stays selectable until the Applicant picks another.
  const locationOptions = (currentLocation && !locations.includes(currentLocation) ? [currentLocation, ...locations] : locations).map((location) => ({ value: location, label: location }));
  const [education, setEducation] = useState<Array<Education | undefined>>(profile?.education ?? []);
  const [workHistory, setWorkHistory] = useState<Array<WorkHistory | undefined>>(profile?.workHistory ?? []);
  const [skills, setSkills] = useState(() => splitSkills(profile?.skills));
  const [seenState, setSeenState] = useState(profileState);
  if (seenState !== profileState) {
    // A rejected save hands back what was typed; re-seed the rows so React's post-action form reset keeps it.
    setSeenState(profileState);
    if (profileState.values) {
      setEducation(profileState.values.education as Education[]);
      setWorkHistory(profileState.values.workHistory as WorkHistory[]);
      setSkills(splitSkills(profileState.values.skills));
    }
  }
  const errors = profileState.fieldErrors ?? {};
  const values = profileState.values;
  const strength = profileStrength({ profile, documentCount: documents.length });

  return (
    <section className="mx-auto w-full max-w-[1440px] px-4 pb-7 pt-6 sm:px-10 sm:pb-[100px] sm:pt-[50px]">
      <div className="flex flex-col gap-2 sm:gap-4">
        <p className={eyebrowClass}>Careers</p>
        <h1 className="font-serif text-[28px] leading-tight text-primary sm:text-[54px] sm:leading-[1.2]">{heading}</h1>
        <p className="max-w-[520px] text-sm leading-normal tracking-[0.35px] text-body sm:text-base sm:leading-[1.6]">
          Keep this reusable information ready for future job postings.
        </p>
      </div>

      <div className="mt-4 grid items-start gap-4 sm:mt-[30px] lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10">
        <div className="flex flex-col gap-5">
          <form id="applicant-profile-form" action={profileAction} className="flex flex-col gap-5" noValidate>
            <section className={cardClass}>
              <h2 className={cardTitleClass}>Basic information</h2>
              <div className="grid gap-5 sm:grid-cols-2 sm:gap-4">
                <Field id="fullName" label="Full name" required error={errors.fullName}>
                  <Input {...fieldProps("fullName", errors.fullName)} required name="fullName" autoComplete="name" maxLength={200} defaultValue={values?.fullName ?? profile?.fullName ?? fullName} className={fieldClass} />
                </Field>
                <Field id="phone" label="Contact number" error={errors.phone}>
                  <Input {...fieldProps("phone", errors.phone)} name="phone" type="tel" autoComplete="tel" maxLength={30} placeholder="09XX XXX XXXX" defaultValue={values?.phone ?? profile?.phone ?? ""} className={fieldClass} />
                </Field>
              </div>
              <div className="grid gap-2">
                <Combobox
                  label="Location"
                  name="location"
                  placeholder="Search your city"
                  emptyMessage="No matching city. Pick one from the list."
                  options={locationOptions}
                  defaultValue={currentLocation}
                />
                {errors.location ? <p className="text-sm text-red-700" role="alert">{errors.location}</p> : null}
              </div>
            </section>

            <section className={cardClass}>
              <h2 className={cardTitleClass}>Summary &amp; skills</h2>
              <Field id="summary" label="Professional summary" error={errors.summary}>
                <textarea {...fieldProps("summary", errors.summary)} name="summary" maxLength={2000} placeholder="A few sentences about you and your experience…" defaultValue={values?.summary ?? profile?.summary ?? ""} className={textareaClass} />
              </Field>
              <SkillTags skills={skills} setSkills={setSkills} error={errors.skills} />
            </section>

            <section className={cn(cardClass, "gap-4")}>
              <SectionRow title="Education" addLabel="Add education" add={education.length < 20 ? () => setEducation((items) => [...items, undefined]) : undefined} />
              {errors.education ? <p className="text-sm text-red-700" role="alert">{errors.education}</p> : null}
              {education.length === 0 ? <EmptyHint icon={Calendar}>Add your school, degree and years attended.</EmptyHint> : null}
              {education.map((item, index) => <EducationFields key={index} item={item} index={index} errors={errors} remove={() => setEducation((items) => items.filter((_, itemIndex) => itemIndex !== index))} />)}
            </section>

            <section className={cn(cardClass, "gap-4")}>
              <SectionRow title="Work history" addLabel="Add work history" add={workHistory.length < 30 ? () => setWorkHistory((items) => [...items, undefined]) : undefined} />
              {errors.workHistory ? <p className="text-sm text-red-700" role="alert">{errors.workHistory}</p> : null}
              {workHistory.length === 0 ? <EmptyHint icon={Briefcase}>Add previous roles — especially kitchen, retail or customer service.</EmptyHint> : null}
              {workHistory.map((item, index) => <WorkHistoryFields key={index} item={item} index={index} errors={errors} remove={() => setWorkHistory((items) => items.filter((_, itemIndex) => itemIndex !== index))} />)}
            </section>
          </form>

          <JobAlertsToggle initial={profile?.jobAlertsOptIn ?? false} profileSaved={Boolean(profile)} />

          <Documents profileSaved={Boolean(profile)} documents={documents} />
        </div>

        <div className="contents lg:flex lg:flex-col lg:gap-5 lg:sticky lg:top-6">
          <ProfileStrength {...strength} />
          <div className="order-last flex flex-col gap-5 lg:order-none">
            <Button type="submit" form="applicant-profile-form" variant="pill" size="pill-lg" disabled={profilePending} aria-busy={profilePending}>
              {profilePending ? "Saving profile…" : "Save profile"}
            </Button>
            {profileState.message ? <p className="text-sm tracking-[0.35px] text-body" role="alert">{profileState.message}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
