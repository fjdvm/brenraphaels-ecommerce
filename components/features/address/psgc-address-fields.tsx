"use client";

import { useCallback, useEffect, useId, useState } from "react";

import { fieldClass, fieldLabelClass } from "@/components/ui/field-styles";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { DEFAULT_COUNTRY, type PsgcOption } from "@/lib/psgc";

type Level = "region" | "province" | "city" | "barangay";
export type PsgcQuery = { level: Level; region?: string; province?: string; city?: string };
export type LoadOptions = (query: PsgcQuery) => Promise<PsgcOption[]>;

const cache = new Map<string, PsgcOption[]>();

/** Loads one list from the app, remembering it so a list already seen shows at once. */
export const fetchPsgcOptions: LoadOptions = async (query) => {
  const key = new URLSearchParams(Object.entries(query) as [string, string][]).toString();
  const hit = cache.get(key);
  if (hit) return hit;
  const response = await fetch(`/api/psgc?${key}`);
  if (!response.ok) throw new Error("The address list could not be loaded.");
  const { options } = (await response.json()) as { options: PsgcOption[] };
  cache.set(key, options);
  return options;
};

type Lists = Record<Level, PsgcOption[] | null>;
const NONE: Lists = { region: null, province: null, city: null, barangay: null };
type Picked = Record<Level, string>;
const EMPTY: Picked = { region: "", province: "", city: "", barangay: "" };

/**
 * Country, Region, Province, City and Barangay dropdowns that narrow one another (the same PSGC list as CREOMS).
 * The form posts the chosen codes as `regionCode`, `provinceCode`, `cityCode` and `barangayCode`; the server
 * checks they belong together. Country is Philippines. The Street is the form's own text field.
 */
export function PsgcAddressFields({
  errors = {},
  loadOptions = fetchPsgcOptions,
}: {
  errors?: Record<string, string[] | undefined>;
  loadOptions?: LoadOptions;
}) {
  const [picked, setPicked] = useState<Picked>(EMPTY);
  const [lists, setLists] = useState<Lists>(NONE);
  const [failed, setFailed] = useState(false);
  const ids = { country: useId(), region: useId(), province: useId(), city: useId(), barangay: useId() };

  const load = useCallback(
    (query: PsgcQuery, then?: (options: PsgcOption[]) => void) => {
      setFailed(false);
      loadOptions(query).then(
        (options) => {
          setLists((l) => ({ ...l, [query.level]: options }));
          then?.(options);
        },
        () => setFailed(true),
      );
    },
    [loadOptions],
  );

  useEffect(() => {
    loadOptions({ level: "region" }).then(
      (options) => setLists((l) => ({ ...l, region: options })),
      () => setFailed(true),
    );
  }, [loadOptions]);

  const chooseRegion = (region: string) => {
    setPicked({ ...EMPTY, region });
    setLists((l) => ({ ...l, province: null, city: null, barangay: null }));
    if (!region) return;
    load({ level: "province", region }, (options) => {
      // Metro Manila has only independent cities, so there is no Province to choose.
      if (options.length === 1) chooseProvince(options[0].code, region);
    });
  };
  const chooseProvince = (province: string, region = picked.region) => {
    setPicked({ ...EMPTY, region, province });
    setLists((l) => ({ ...l, city: null, barangay: null }));
    if (province) load({ level: "city", region, province });
  };
  const chooseCity = (city: string) => {
    setPicked((p) => ({ ...p, city, barangay: "" }));
    setLists((l) => ({ ...l, barangay: null }));
    if (city) load({ level: "barangay", region: picked.region, city });
  };

  const select = (level: Level, label: string, name: string, disabled: boolean, onPick: (code: string) => void, error?: string) => {
    const options = lists[level];
    const loading = options === null && !disabled;
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor={ids[level]} required className={fieldLabelClass}>{label}</Label>
        <Select
          id={ids[level]}
          className={fieldClass}
          name={name}
          value={picked[level]}
          required
          disabled={disabled || loading}
          aria-invalid={Boolean(error)}
          onChange={(event) => onPick(event.target.value)}
        >
          <option value="">{loading ? "Loading…" : `Choose ${label.toLowerCase()}`}</option>
          {(options ?? []).map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
        </Select>
        {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
      </div>
    );
  };

  const message = errors.address?.[0];
  return (
    <>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Label htmlFor={ids.country} required className={fieldLabelClass}>Country</Label>
        <Select id={ids.country} className={fieldClass} name="country" defaultValue={DEFAULT_COUNTRY}>
          <option value={DEFAULT_COUNTRY}>{DEFAULT_COUNTRY}</option>
        </Select>
      </div>
      {select("region", "Region", "regionCode", false, chooseRegion, errors.regionCode?.[0])}
      {select("province", "Province", "provinceCode", !picked.region, (c) => chooseProvince(c), errors.provinceCode?.[0])}
      {select("city", "City", "cityCode", !picked.province, chooseCity, errors.cityCode?.[0])}
      {select("barangay", "Barangay", "barangayCode", !picked.city, (barangay) => setPicked((p) => ({ ...p, barangay })), errors.barangayCode?.[0])}
      {message ? <p className="text-sm text-red-700 sm:col-span-2" role="alert">{message}</p> : null}
      {failed ? <p className="text-sm text-red-700 sm:col-span-2" role="alert">We couldn&apos;t load the address list. Please try again.</p> : null}
    </>
  );
}
