/**
 * SIMWOOD API Client
 * Handles all SIMWOOD API calls with basic authentication.
 * Uses api.simwood.com for account/allocated/available; portal.simwood.com for numbers config, voice CDR, SMS CDR.
 */

const SIMWOOD_API_BASE = "https://api.simwood.com/v3";
const SIMWOOD_PORTAL_BASE = "https://portal.simwood.com";
const SIMWOOD_ACCOUNT_ID = process.env.SIMWOOD_ACCOUNT_ID || "931477";
const SIMWOOD_API_KEY = process.env.SIMWOOD_API_KEY || "";
const SIMWOOD_USERNAME = process.env.SIMWOOD_USERNAME || "";

/**
 * Get SIMWOOD API authorization header
 */
export function getSimwoodAuthHeader(): string {
  if (!SIMWOOD_API_KEY || !SIMWOOD_USERNAME) {
    throw new Error("SIMWOOD_USERNAME or SIMWOOD_API_KEY is not set");
  }
  const credentials = `${SIMWOOD_USERNAME}:${SIMWOOD_API_KEY}`;
  const encoded =
    typeof window === "undefined"
      ? Buffer.from(credentials).toString("base64") // Node.js
      : btoa(credentials); // Browser

  return `Basic ${encoded}`;
}

/**
 * Make a SIMWOOD API request (api.simwood.com/v3)
 */
export async function simwoodRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${SIMWOOD_API_BASE}${endpoint}`;
  const authHeader = getSimwoodAuthHeader();

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SIMWOOD API error: ${response.status} - ${errorText}`);
  }

  const responseData = await response.json();
  if (responseData.success == false) {
    throw new Error(`SIMWOOD API error: ${responseData.errors?.join(", ")}`);
  }

  return responseData;
}

/**
 * Make a SIMWOOD Portal request (portal.simwood.com/v3 or /v4)
 */
export async function simwoodPortalRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${SIMWOOD_PORTAL_BASE}${path}`;
  const authHeader = getSimwoodAuthHeader();

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SIMWOOD Portal error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Validate a number and get its details (type, location, etc.).
 * Number should be with country code (e.g. 447700195775 or national + countryCode).
 */
export interface ValidateNumberResponse {
  success: boolean;
  data?: {
    valid: boolean;
    country_code: string;
    iso: string;
    national_number: string;
    type: string;
    location?: string;
    carrier?: string;
    timezones?: string[];
    formatted?: { e164: string; national: string; international: string };
  };
}

export async function validateNumber(
  number: string,
  countryCode?: string
): Promise<ValidateNumberResponse> {
  const fullNumber = countryCode ? `${countryCode}${number}` : number;
  return simwoodRequest(
    `/numbers/${SIMWOOD_ACCOUNT_ID}/validate/${fullNumber}`
  );
}

/**
 * Get account balance
 */
export async function getBalance(): Promise<Array<{ balance: string; currency: string }>> {
  return simwoodRequest(`/accounts/${SIMWOOD_ACCOUNT_ID}/prepay/balance`);
}

/**
 * Get allocated numbers (returns hash)
 */
export async function getAllocatedNumbers(quantity: number): Promise<{
  quantity: number;
  mode: string;
  include_mobile_ott: boolean;
  type: string;
  account: string;
  format: string;
  hash: string;
  link: string;
}> {
  return simwoodRequest(`/numbers/${SIMWOOD_ACCOUNT_ID}/allocated/${quantity}`, {
    method: "POST",
  });
}

/**
 * Get numbers from file using hash (portal)
 */
export async function getNumbersFromFile(hash: string): Promise<Array<{
  country_code: string;
  number: string;
  gold_price: string;
  block: string;
  type: string;
  SMS: string;
}>> {
  return simwoodPortalRequest(`/v3/files/${SIMWOOD_ACCOUNT_ID}/${hash}`);
}

/**
 * Get trunks
 */
export async function getTrunks(): Promise<Array<{
  trunk: string;
  serviceLevel: number;
  type: string;
  enabled_webrtc: string | null;
}>> {
  return simwoodPortalRequest(`/v3/voice/${SIMWOOD_ACCOUNT_ID}/trunks`);
}

/**
 * Get trunk associated with an allocated number (portal).
 * @param number - Full number (e.g. 447700195775) or national number if countryCode is provided.
 * @param countryCode - Optional country code (e.g. "44"). If provided, path uses countryCode + number; otherwise number is used as-is.
 */
export async function getNumberTrunk(
  number: string,
  countryCode?: string
): Promise<{ success: boolean; data: { trunk: string } }> {
  const fullNumber = countryCode ? `${countryCode}${number}` : number;
  return simwoodPortalRequest(
    `/v3/numbers/${SIMWOOD_ACCOUNT_ID}/allocated/${fullNumber}/trunk`
  );
}

/**
 * Attach number to trunk (portal).
 * @param number - Full number or national number if countryCode is provided.
 * @param trunk - Trunk name.
 * @param countryCode - Optional (e.g. "44"). If provided, path uses countryCode + number.
 */
export async function attachNumberToTrunk(
  number: string,
  trunk: string,
  countryCode?: string
): Promise<{ success: boolean; data: { trunk: string } }> {
  const fullNumber = countryCode ? `${countryCode}${number}` : number;
  return simwoodPortalRequest(
    `/v3/numbers/${SIMWOOD_ACCOUNT_ID}/allocated/${fullNumber}/trunk`,
    {
      method: "PUT",
      body: JSON.stringify({ trunk }),
    }
  );
}

/** Emergency 999 config body */
export interface Emergency999Body {
  title?: string;
  forename?: string;
  name?: string;
  bussuffix?: string;
  premises?: string;
  thoroughfare?: string;
  locality?: string;
  postcode?: string;
}

/** Emergency 999 record as returned by GET (array of one item) */
export interface Emergency999Record {
  status?: string;
  title?: string;
  forename?: string;
  name?: string;
  honours?: string;
  bussuffix?: string;
  premises?: string;
  thoroughfare?: string;
  locality?: string;
  postcode?: string;
  from?: string;
  to?: string | null;
}

/**
 * Get emergency 999 details for a number (api.simwood.com).
 * Returns an array of one record.
 */
export async function getEmergency999(
  number: string,
  countryCode?: string
): Promise<Emergency999Record[]> {
  const fullNumber = countryCode ? `${countryCode}${number}` : number;
  return simwoodRequest(
    `/numbers/${SIMWOOD_ACCOUNT_ID}/allocated/${fullNumber}/999`
  );
}

/**
 * Configure emergency 999 details for a number (portal)
 */
export async function putEmergency999(
  number: string,
  body: Emergency999Body
): Promise<unknown> {
  return simwoodPortalRequest(
    `/v3/numbers/${SIMWOOD_ACCOUNT_ID}/allocated/${number}/999`,
    { method: "PUT", body: JSON.stringify(body) }
  );
}

/**
 * Permanently delete a number from the account (api)
 */
export async function deleteNumber(number: string): Promise<unknown> {
  return simwoodRequest(
    `/numbers/${SIMWOOD_ACCOUNT_ID}/allocated/${number}`,
    { method: "DELETE" }
  );
}

/**
 * Reset number configuration (api)
 */
export async function deleteNumberConfig(number: string): Promise<unknown> {
  return simwoodRequest(
    `/numbers/${SIMWOOD_ACCOUNT_ID}/allocated/${number}/config`,
    { method: "DELETE" }
  );
}

/**
 * Set SMS configuration for a number (portal). Mode is hardcoded to http_json.
 */
export async function putSmsConfig(
  number: string,
  endpoint: string
): Promise<unknown> {
  return simwoodPortalRequest(
    `/v3/numbers/${SIMWOOD_ACCOUNT_ID}/allocated/${number}/sms`,
    {
      method: "PUT",
      body: JSON.stringify({ mode: "http_json", endpoint }),
    }
  );
}

/** Voice CDR request body (v4) */
export interface VoiceCdrRequest {
  duration_min?: number;
  duration_max?: number;
  date_start: string;
  date_end: string;
  size: number;
  page: number;
  direction?: "inbound" | "outbound" | "both";
}

/** Voice CDR response */
export interface VoiceCdrResponse {
  status: number;
  success: boolean;
  count: number;
  data: Array<Record<string, unknown>>;
}

/**
 * Get voice CDR (portal v4). Max date range 30 days. size: 10, 100, 1000, 10000.
 */
export async function getVoiceCdr(
  body: VoiceCdrRequest
): Promise<VoiceCdrResponse> {
  return simwoodPortalRequest(
    `/v4/voice/${SIMWOOD_ACCOUNT_ID}/cdr`,
    { method: "POST", body: JSON.stringify(body) }
  );
}

/** SMS CDR report response (request latest N) */
export interface SmsCdrReportResponse {
  quantity: number;
  mode: string;
  type: string;
  account: string;
  format: string;
  hash: string;
  link: string;
}

/**
 * Request latest SMS CDR report (portal). Returns hash to fetch file.
 */
export async function getSmsCdrReport(
  quantity: number
): Promise<SmsCdrReportResponse> {
  return simwoodPortalRequest(
    `/v3/accounts/${SIMWOOD_ACCOUNT_ID}/reports/data/cdr/latest/${quantity}`
  );
}

/**
 * Get file content by hash (portal). Used for SMS CDR file after report.
 */
export async function getFileByHash(hash: string): Promise<unknown> {
  return simwoodPortalRequest(
    `/v3/files/${SIMWOOD_ACCOUNT_ID}/${hash}`
  );
}

/**
 * Get available standard numbers. Type (e.g. freephone, MNP, OTT) and pricing shown when returned by API.
 */
export async function getAvailableStandardNumbers(
  quantity: number,
  pattern?: string
): Promise<Array<{
  country_code: string;
  number: string;
  recommended_gold_premium?: number;
  wholesale_gold_premium?: number;
  block?: string;
  bill_class?: string;
  type?: string;
  SMS?: number;
  [key: string]: unknown;
}>> {
  const params = new URLSearchParams();
  if (pattern) {
    params.append("pattern", pattern);
  }
  const queryString = params.toString();
  const url = `/numbers/${SIMWOOD_ACCOUNT_ID}/available/standard/${quantity}${queryString ? `?${queryString}` : ""}`;
  return simwoodRequest(url);
}

/**
 * Get available gold numbers. Type (e.g. freephone, MNP, OTT) and pricing shown when returned by API.
 */
export async function getAvailableGoldNumbers(
  quantity: number,
  pattern?: string
): Promise<Array<{
  country_code: string;
  number: string;
  recommended_gold_premium?: number;
  wholesale_gold_premium?: number;
  block?: string;
  bill_class?: string;
  type?: string;
  SMS?: number;
  [key: string]: unknown;
}>> {
  const params = new URLSearchParams();
  if (pattern) {
    params.append("pattern", pattern);
  }
  const queryString = params.toString();
  const url = `/numbers/${SIMWOOD_ACCOUNT_ID}/available/gold/${quantity}${queryString ? `?${queryString}` : ""}`;
  return simwoodRequest(url);
}

/**
 * Allocate a number (buy a number)
 */
export async function allocateNumber(number: string, countryCode?: string): Promise<unknown> {
  const fullNumber = countryCode ? `${countryCode}${number}` : number;
  console.log("fullNumber", fullNumber);
  return simwoodRequest(`/numbers/${SIMWOOD_ACCOUNT_ID}/allocated/${fullNumber}`, {
    method: "PUT",
  });
}

export interface PortInRequestEntry {
  rowId: string;
  rowNumber: number;
  number: string;
  numberType: "local" | "mobile";
  mainBillingNumber?: string;
  accountNumber?: string;
  currentProvider?: string;
  /** Losing Communications Provider CUPID (see GET /porting/{account}/lcps) */
  lcpCupid?: string;
  numberOfLines?: string;
  numberOfChannels?: string;
  installationFirstName?: string;
  installationLastName?: string;
  installationProperty?: string;
  installationStreet?: string;
  installationTownCity?: string;
  installationPostcode?: string;
  associatedNumbers?: string;
  contactEmail?: string;
  lineType?: string;
  pac?: string;
  mbn?: string;
  payload: Record<string, string>;
}

export interface PortInRequestResult {
  rowId: string;
  number: string;
  ref: string;
  mbn: string;
  date: string;
  status: string;
  error?: string;
}

const SIMWOOD_PORTING_GNP_PATH =
  process.env.SIMWOOD_PORTING_GNP_PATH || `/porting/${SIMWOOD_ACCOUNT_ID}/gnp`;
const SIMWOOD_PORTING_MNP_PATH =
  process.env.SIMWOOD_PORTING_MNP_PATH || `/porting/${SIMWOOD_ACCOUNT_ID}/mnp`;

function readFirstString(
  source: Record<string, unknown>,
  keys: string[]
): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number") {
      return String(value);
    }
  }
  return "";
}

function getNestedRecord(source: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = source[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizePortType(lineType?: string): "single" | "multi" {
  const value = (lineType || "").trim().toLowerCase();
  if (value.includes("multi")) return "multi";
  return "single";
}

function parseAssociatedNumbers(value?: string): string[] {
  if (!value?.trim()) return [];
  return value
    .split(/[,\n;|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function createPortInRequest(
  entry: PortInRequestEntry
): Promise<PortInRequestResult> {
  let response: Record<string, unknown>;
  if (entry.numberType === "mobile") {
    const payload: Record<string, string> = {
      msisdn: entry.number,
      pac: entry.pac?.trim() || "",
    };
    if (entry.contactEmail?.trim()) payload.contact_email = entry.contactEmail.trim();

    response = await simwoodRequest<Record<string, unknown>>(SIMWOOD_PORTING_MNP_PATH, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } else {
    const numbers = [
      { number: entry.mainBillingNumber?.trim() || entry.number, type: "mbn", action: "port" },
      ...parseAssociatedNumbers(entry.associatedNumbers).map((num) => ({
        number: num,
        type: "associated",
        action: "port",
      })),
    ];

    const payload: Record<string, unknown> = {
      mbn: entry.mainBillingNumber?.trim() || entry.number,
      lcp: entry.currentProvider?.trim() || "",
      lcp_cupid: entry.lcpCupid?.trim() || "",
      contact_email: entry.contactEmail?.trim() || "",
      account_number: entry.accountNumber?.trim() || "",
      billing_postcode: entry.installationPostcode?.trim() || "",
      type: normalizePortType(entry.lineType),
      lines: Number(entry.numberOfLines || "0") || 1,
      channels: Number(entry.numberOfChannels || "0") || 1,
      customer: {
        forename: entry.installationFirstName?.trim() || "",
        name: entry.installationLastName?.trim() || "",
        premises: entry.installationProperty?.trim() || "",
        thoroughfare: entry.installationStreet?.trim() || "",
        locality: entry.installationTownCity?.trim() || "",
        postcode: entry.installationPostcode?.trim() || "",
      },
      numbers,
    };

    response = await simwoodRequest<Record<string, unknown>>(SIMWOOD_PORTING_GNP_PATH, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  const responseData = getNestedRecord(response, "data");

  return {
    rowId: entry.rowId,
    number: entry.number,
    ref:
      readFirstString(response, ["ref", "Ref", "reference", "Reference"]) ||
      readFirstString(responseData ?? {}, ["ref", "Ref", "reference", "Reference"]),
    mbn:
      readFirstString(response, ["mbn", "MBN"]) ||
      readFirstString(responseData ?? {}, ["mbn", "MBN"]) ||
      entry.mainBillingNumber ||
      "",
    date:
      readFirstString(response, ["date", "Date", "portDate", "port_date", "date_port"]) ||
      readFirstString(responseData ?? {}, ["date", "Date", "portDate", "port_date", "date_port"]),
    status:
      readFirstString(response, ["status", "Status", "status_code"]) ||
      readFirstString(responseData ?? {}, ["status", "Status", "status_code"]) ||
      "submitted",
  };
}
