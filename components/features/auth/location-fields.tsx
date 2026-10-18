"use client";

import { useEffect, useRef, useState } from "react";

import { fieldClass, fieldLabelClass } from "@/components/ui/field-styles";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

import type { FieldErrors } from "./customer-details-fields";

type Choices = { options: string[]; loading: boolean; failed: boolean };

const noChoices: Choices = { options: [], loading: false, failed: false };

type LocationSelectProps = {
  name: string;
  label: string;
  placeholder: string;
  value: string;
  choices: Choices;
  disabled?: boolean;
  error?: string;
  onChange: (value: string) => void;
  idSuffix?: string;
};

function LocationSelect({
  name,
  label,
  placeholder,
  value,
  choices,
  disabled,
  error,
  onChange,
  idSuffix = "",
}: LocationSelectProps) {
  const id = `${name}${idSuffix}`;
  const errorId = `${id}-error`;
  const problem = error ?? (choices.failed ? "We couldn't load the list. Please try again." : undefined);
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} required className={fieldLabelClass}>
        {label}
      </Label>
      <Select
        id={id}
        className={fieldClass}
        name={name}
        value={value}
        required
        disabled={disabled || choices.loading}
        aria-invalid={Boolean(problem)}
        aria-describedby={problem ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{choices.loading ? "Loading…" : placeholder}</option>
        {choices.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
      {problem ? (
        <p id={errorId} className="text-sm text-red-700" role="alert">
          {problem}
        </p>
      ) : null}
    </div>
  );
}

async function fetchOptions(query: Record<string, string>, signal: AbortSignal) {
  const response = await fetch(`/api/locations?${new URLSearchParams(query)}`, { signal });
  if (!response.ok) {
    throw new Error(`Locations request failed with ${response.status}`);
  }
  const body: { options: string[] } = await response.json();
  return body.options;
}

/**
 * Province, then City or municipality, then Barangay: each dropdown is filled
 * from the one before it, so only places that really go together can be chosen.
 */
export function LocationFields({
  provinces,
  errors,
  defaults,
  idSuffix,
}: {
  provinces: string[];
  errors: FieldErrors;
  defaults?: { province?: string; city?: string; barangay?: string };
  idSuffix?: string;
}) {
  const defaultProvince = defaults?.province;
  const defaultCity = defaults?.city;
  const [province, setProvince] = useState(defaults?.province ?? "");
  const [city, setCity] = useState(defaults?.city ?? "");
  const [barangay, setBarangay] = useState(defaults?.barangay ?? "");
  const [cities, setCities] = useState<Choices>(() =>
    defaults?.province ? { options: [], loading: true, failed: false } : noChoices,
  );
  const [barangays, setBarangays] = useState<Choices>(() =>
    defaults?.city ? { options: [], loading: true, failed: false } : noChoices,
  );
  const latest = useRef<AbortController>(null);

  // Existing profile Addresses need their dependent choices restored on load.
  useEffect(() => {
    if (!defaultProvince || !defaultCity) return;
    let cancelled = false;
    const controller = new AbortController();
    fetchOptions({ province: defaultProvince }, controller.signal)
      .then(async (cityOptions) => {
        if (cancelled) return;
        setCities({ options: cityOptions, loading: false, failed: false });
        const barangayOptions = await fetchOptions(
          { province: defaultProvince, city: defaultCity },
          controller.signal,
        );
        if (!cancelled) setBarangays({ options: barangayOptions, loading: false, failed: false });
      })
      .catch(() => {
        if (!cancelled && !controller.signal.aborted) {
          setCities({ options: [], loading: false, failed: true });
          setBarangays(noChoices);
        }
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [defaultProvince, defaultCity]);

  /** Loads a list, ignoring it if the Customer has since picked something else. */
  function load(
    query: Record<string, string>,
    setChoices: (choices: Choices) => void,
  ) {
    latest.current?.abort();
    const controller = new AbortController();
    latest.current = controller;
    setChoices({ options: [], loading: true, failed: false });
    fetchOptions(query, controller.signal).then(
      (options) => setChoices({ options, loading: false, failed: false }),
      () => {
        if (!controller.signal.aborted) {
          setChoices({ options: [], loading: false, failed: true });
        }
      },
    );
  }

  function chooseProvince(next: string) {
    setProvince(next);
    setCity("");
    setBarangay("");
    setBarangays(noChoices);
    if (next) {
      load({ province: next }, setCities);
    } else {
      latest.current?.abort();
      setCities(noChoices);
    }
  }

  function chooseCity(next: string) {
    setCity(next);
    setBarangay("");
    if (next) {
      load({ province, city: next }, setBarangays);
    } else {
      latest.current?.abort();
      setBarangays(noChoices);
    }
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <LocationSelect
          name="province"
          label="Province"
          placeholder="Choose a province"
          value={province}
          choices={{ options: provinces, loading: false, failed: false }}
          error={errors.province?.[0]}
          onChange={chooseProvince}
          idSuffix={idSuffix}
        />
        <LocationSelect
          name="city"
          label="City or municipality"
          placeholder="Choose a city or municipality"
          value={city}
          choices={cities}
          disabled={!province}
          error={errors.city?.[0]}
          onChange={chooseCity}
          idSuffix={idSuffix}
        />
      </div>
      <LocationSelect
        name="barangay"
        label="Barangay"
        placeholder="Choose a barangay"
        value={barangay}
        choices={barangays}
        disabled={!city}
        error={errors.barangay?.[0]}
        onChange={setBarangay}
        idSuffix={idSuffix}
      />
    </>
  );
}
