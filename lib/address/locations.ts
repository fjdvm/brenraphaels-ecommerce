import {
  getAllMunicipalities,
  getAllProvinces,
  getBarangaysByMunicipality,
  getPostalCodesByMunicipality,
} from "@aivangogh/ph-address";

/**
 * Where a Customer can deliver, as the Province → City → Barangay choices the
 * address form offers. The names are the values stored on an Address.
 *
 * The PSGC has no province for Metro Manila or for independent cities such as
 * Cebu City, so a Customer would not find them under the province they think
 * of. Metro Manila is offered as a province, and each independent city is
 * listed under the province it geographically sits in.
 */
export const metroManila = "Metro Manila";

const metroManilaParentCodes = new Set(["1300000000", "1380600000"]);
const manilaDistrictParentCode = "1380600000";

/** Postal data names the geographic province, e.g. "Province of Cebu". */
function geographicProvince(cityCode: string, provinceNames: Set<string>) {
  for (const { provinceName } of getPostalCodesByMunicipality(cityCode)) {
    const name = provinceName.replace(/^Province of /, "");
    if (provinceNames.has(name)) {
      return name;
    }
  }
  return undefined;
}

type City = { code: string; name: string };

function buildDirectory() {
  const provinces = getAllProvinces();
  const provinceNames = new Set(provinces.map((province) => province.name));
  const provinceNameByCode = new Map(provinces.map((province) => [province.psgcCode, province.name]));
  const citiesByProvince = new Map<string, City[]>([[metroManila, []]]);
  for (const name of provinceNames) {
    citiesByProvince.set(name, []);
  }

  for (const city of getAllMunicipalities()) {
    // Manila itself has no barangays; its districts hold them.
    if (getBarangaysByMunicipality(city.psgcCode).length === 0) {
      continue;
    }

    const province = metroManilaParentCodes.has(city.provinceCode)
      ? metroManila
      : (provinceNameByCode.get(city.provinceCode) ??
        geographicProvince(city.psgcCode, provinceNames));
    if (!province) {
      throw new Error(`No province found for ${city.name} (${city.psgcCode})`);
    }

    const name =
      city.provinceCode === manilaDistrictParentCode ? `${city.name}, Manila` : city.name;
    citiesByProvince.get(province)!.push({ code: city.psgcCode, name });
  }

  for (const cities of citiesByProvince.values()) {
    cities.sort((a, b) => a.name.localeCompare(b.name, "en"));
  }

  return { provinceList: [metroManila, ...provinceNames].sort((a, b) => a.localeCompare(b, "en")), citiesByProvince };
}

let directory: ReturnType<typeof buildDirectory> | undefined;

function getDirectory() {
  directory ??= buildDirectory();
  return directory;
}

export function listProvinces(): string[] {
  return getDirectory().provinceList;
}

export function listCities(province: string): string[] {
  return (getDirectory().citiesByProvince.get(province) ?? []).map((city) => city.name);
}

/** Every city as one "City, Province" value, the way an Applicant profile stores its Location. */
export function listCityLocations(): string[] {
  return listProvinces().flatMap((province) => listCities(province).map((city) => `${city}, ${province}`));
}

export function listBarangays(province: string, city: string): string[] {
  const match = getDirectory().citiesByProvince.get(province)?.find((candidate) => candidate.name === city);
  if (!match) {
    return [];
  }

  return getBarangaysByMunicipality(match.code).map((barangay) => barangay.name);
}

type Location = { province: string; city: string; barangay: string };

/**
 * The field errors for a Province, City and Barangay that do not go together;
 * empty when the combination exists. It only names the first level that is wrong.
 */
export function locationErrors({ province, city, barangay }: Location) {
  const errors: Record<string, string[]> = {};
  if (!listProvinces().includes(province)) {
    errors.province = ["Choose a province from the list"];
  } else if (!listCities(province).includes(city)) {
    errors.city = ["Choose a city or municipality from the list"];
  } else if (!listBarangays(province, city).includes(barangay)) {
    errors.barangay = ["Choose a barangay from the list"];
  }
  return errors;
}
