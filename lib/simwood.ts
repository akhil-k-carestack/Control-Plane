/**
 * SIMWOOD API Client
 * Handles all SIMWOOD API calls with basic authentication.
 * Uses api.simwood.com for account/allocated/available; portal.simwood.com for numbers config, voice CDR, SMS CDR, channel history.
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

/** Sample interval for portal GET /v4/voice/{account}/channels/history */
export type ChannelHistoryInterval = "1m" | "5m" | "10m" | "1h";

export interface ChannelHistoryPoint {
  t: string;
  inbound: number;
  outbound: number;
}

function extractChannelHistoryArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data;
    if (Array.isArray(o.samples)) return o.samples;
    if (Array.isArray(o.history)) return o.history;
  }
  return [];
}

function channelRowTime(row: Record<string, unknown>): string {
  return String(row.datetime ?? row.date ?? row.timestamp ?? row.time ?? "");
}

/** First finite numeric from row for any of the given keys (portal v4 uses channels_in / channels_out). */
function channelRowNumber(row: Record<string, unknown>, keys: readonly string[]): number {
  for (const k of keys) {
    const v = row[k];
    if (v === undefined || v === null || v === "") continue;
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n)) return Math.max(0, n);
  }
  return 0;
}

/** Peak total channels when no directional split is present. */
function channelRowPeak(row: Record<string, unknown>): number {
  return channelRowNumber(row, ["channels", "channel", "peak", "count"]);
}

function channelRowInbound(row: Record<string, unknown>): number {
  return channelRowNumber(row, ["channels_in", "channels_inbound", "inbound", "in"]);
}

function channelRowOutbound(row: Record<string, unknown>): number {
  return channelRowNumber(row, ["channels_out", "channels_outbound", "outbound", "out"]);
}

function channelRowSplit(row: Record<string, unknown>): { in: number; out: number } {
  return { in: channelRowInbound(row), out: channelRowOutbound(row) };
}

/**
 * Recent (~24h) channel utilisation samples (SIMWOOD portal v4).
 * @see GET https://portal.simwood.com/v4/voice/{ACCOUNT}/channels/history — optional /in and /out before the query string.
 */
export async function getChannelHistory(
  interval: ChannelHistoryInterval,
  traffic: "both" | "inbound" | "outbound"
): Promise<ChannelHistoryPoint[]> {
  const q = `?interval=${encodeURIComponent(interval)}`;
  const base = `/v4/voice/${SIMWOOD_ACCOUNT_ID}/channels/history`;

  const fetchSegment = async (suffix: string): Promise<unknown> =>
    simwoodPortalRequest<unknown>(`${base}${suffix}${q}`);

  const toPoint = (row: unknown, mode: "inbound" | "outbound" | "split"): ChannelHistoryPoint => {
    const r = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    const t = channelRowTime(r);
    const split = channelRowSplit(r);
    const hasPortalDirections =
      r.channels_in !== undefined ||
      r.channels_out !== undefined ||
      split.in > 0 ||
      split.out > 0;
    if (hasPortalDirections) {
      return { t, inbound: split.in, outbound: split.out };
    }
    const peak = channelRowPeak(r);
    if (mode === "inbound") return { t, inbound: peak, outbound: 0 };
    if (mode === "outbound") return { t, inbound: 0, outbound: peak };
    return { t, inbound: peak, outbound: 0 };
  };

  if (traffic === "inbound") {
    let arr: unknown[] = [];
    try {
      arr = extractChannelHistoryArray(await fetchSegment("/in"));
    } catch {
      arr = [];
    }
    if (arr.length === 0) {
      arr = extractChannelHistoryArray(await fetchSegment(""));
    }
    return arr.map((row) => toPoint(row, "inbound"));
  }

  if (traffic === "outbound") {
    let arr: unknown[] = [];
    try {
      arr = extractChannelHistoryArray(await fetchSegment("/out"));
    } catch {
      arr = [];
    }
    if (arr.length === 0) {
      arr = extractChannelHistoryArray(await fetchSegment(""));
    }
    return arr.map((row) => toPoint(row, "outbound"));
  }

  let inRows: unknown[] = [];
  let outRows: unknown[] = [];
  try {
    inRows = extractChannelHistoryArray(await fetchSegment("/in"));
  } catch {
    /* ignore */
  }
  try {
    outRows = extractChannelHistoryArray(await fetchSegment("/out"));
  } catch {
    /* ignore */
  }

  if (inRows.length > 0 || outRows.length > 0) {
    const maxLen = Math.max(inRows.length, outRows.length);
    const merged: ChannelHistoryPoint[] = [];
    for (let i = 0; i < maxLen; i++) {
      const inR = inRows[i];
      const outR = outRows[i];
      const ir = inR && typeof inR === "object" ? (inR as Record<string, unknown>) : {};
      const or = outR && typeof outR === "object" ? (outR as Record<string, unknown>) : {};
      const t = channelRowTime(ir) || channelRowTime(or) || String(i);
      merged.push({
        t,
        inbound: channelRowInbound(ir) || channelRowPeak(ir),
        outbound: channelRowOutbound(or) || channelRowPeak(or),
      });
    }
    return merged;
  }

  try {
    const raw = await fetchSegment("");
    const arr = extractChannelHistoryArray(raw);
    if (arr.length === 0) {
      throw new Error("SIMWOOD returned no channel history data");
    }
    return arr.map((row) => toPoint(row, "split"));
  } catch (e) {
    throw e instanceof Error ? e : new Error("SIMWOOD returned no channel history data");
  }
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

export interface PortingRequestItem {
  ref?: string | number;
  mbn?: string;
  msisdn?: string;
  date?: string;
  date_added?: string;
  date_updated?: string;
  date_port?: string;
  crd?: string;
  pac?: string;
  status?: string;
  status_code?: string;
  port_type?: "local" | "mobile";
  [key: string]: unknown;
}

/**
 * GET /porting/{account}/ports/{ref} (GNP) or /porting/{account}/mnp/{ref} (MNP).
 * Used for lazy loading of associated numbers on the dashboard.
 */
export async function getPortingRequestDetail(
  ref: string,
  portKind: "local" | "mobile"
): Promise<Record<string, unknown>> {
  const enc = encodeURIComponent(String(ref).trim());
  const path =
    portKind === "local"
      ? `/porting/${SIMWOOD_ACCOUNT_ID}/ports/${enc}`
      : `/porting/${SIMWOOD_ACCOUNT_ID}/mnp/${enc}`;
  const raw = await simwoodRequest<unknown>(path);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

/**
 * Get porting requests list (GNP).
 */
export async function getPortingRequests(): Promise<PortingRequestItem[]> {
  const extractData = (
    result:
      | PortingRequestItem[]
      | {
          success?: boolean;
          data?: PortingRequestItem[];
        }
  ): PortingRequestItem[] => {
    if (Array.isArray(result)) return result;
    if (result && Array.isArray(result.data)) return result.data;
    return [];
  };

  const [gnpResult, mnpResult] = await Promise.allSettled([
    simwoodRequest<
      | PortingRequestItem[]
      | {
          success?: boolean;
          data?: PortingRequestItem[];
        }
    >(`/porting/${SIMWOOD_ACCOUNT_ID}/ports`),
    simwoodRequest<
      | PortingRequestItem[]
      | {
          success?: boolean;
          data?: PortingRequestItem[];
        }
    >(`/porting/${SIMWOOD_ACCOUNT_ID}/mnp`),
  ]);

  const gnpRowsRaw =
    gnpResult.status === "fulfilled"
      ? extractData(gnpResult.value).map((row) => ({ ...row, port_type: "local" as const }))
      : [];

  const gnpRows = gnpRowsRaw;

  const mnpRows =
    mnpResult.status === "fulfilled"
      ? extractData(mnpResult.value).map((row) => ({
          ...row,
          mbn: row.mbn ?? row.msisdn ?? "",
          date: row.date ?? row.date_added ?? row.date_updated ?? "",
          crd: row.crd ?? row.date_port ?? "",
          port_type: "mobile" as const,
        }))
      : [];

  if (gnpRows.length === 0 && mnpRows.length === 0) {
    const gnpErr = gnpResult.status === "rejected" ? String(gnpResult.reason) : "";
    const mnpErr = mnpResult.status === "rejected" ? String(mnpResult.reason) : "";
    throw new Error(`Failed to fetch porting requests. GNP: ${gnpErr} MNP: ${mnpErr}`);
  }

  return [...gnpRows, ...mnpRows].sort((a, b) =>
    String(b.ref ?? "").localeCompare(String(a.ref ?? ""), undefined, { numeric: true })
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
  /** Yes/No (optional; blank = No). Used with portal number lookup vs Current Provider to set GNP `type` */
  isMultiLine?: string;
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

function normalizePortingProviderLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Parse Excel Is Multi Line cell: Yes/No (and common variants). Empty / omitted = No. */
function parseIsMultiLineCell(value?: string): boolean | null {
  const v = (value ?? "").trim().toLowerCase();
  if (!v) return false;
  if (["yes", "y", "true", "1", "multi", "multiline", "multi-line"].includes(v)) return true;
  if (["no", "n", "false", "0", "single", "single line", "single-line"].includes(v)) return false;
  return null;
}

/**
 * SIMWOOD portal lookup expects international digits (e.g. 44…). National UK numbers often start with 0.
 */
function toPortalLookupNumberDigits(raw: string): string {
  let digits = raw.replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.startsWith("0044")) {
    digits = digits.slice(4);
  }
  if (digits.startsWith("44")) {
    return digits;
  }
  if (digits.startsWith("0")) {
    return `44${digits.slice(1)}`;
  }
  return digits;
}

/**
 * Portal GET /v3/numbers/{account}/lookup/{number} — range holder for porting type rules.
 */
export async function lookupNumberRangeHolder(fullNumberDigits: string): Promise<unknown> {
  const digits = toPortalLookupNumberDigits(fullNumberDigits);
  if (!digits) {
    throw new Error("lookup number is empty");
  }
  return simwoodPortalRequest<unknown>(
    `/v3/numbers/${SIMWOOD_ACCOUNT_ID}/lookup/${encodeURIComponent(digits)}`
  );
}

function extractRangeHolderFromLookupPayload(payload: unknown): string {
  const seen = new WeakSet<object>();

  const scoreKey = (key: string): number => {
    const k = key.toLowerCase();
    if (k === "rh" || k === "range_holder" || k === "rangeholder") return 100;
    if (k.includes("range") && k.includes("hold")) return 90;
    if (k.includes("holder")) return 80;
    if (k.includes("range") && k.includes("oper")) return 70;
    if (k === "operator" || k === "donor" || k.includes("network")) return 40;
    return 0;
  };

  const walk = (node: unknown, depth: number): string => {
    if (depth > 8 || node == null) return "";
    if (typeof node === "string") return node.trim();
    if (typeof node !== "object" || Array.isArray(node)) return "";
    if (seen.has(node as object)) return "";
    seen.add(node as object);
    const o = node as Record<string, unknown>;

    let best = "";
    let bestScore = 0;
    for (const [k, v] of Object.entries(o)) {
      if (typeof v !== "string" || !v.trim()) continue;
      const s = scoreKey(k);
      if (s > bestScore) {
        bestScore = s;
        best = v.trim();
      }
    }
    if (bestScore >= 40) return best;

    const nestedKeys = ["data", "result", "lookup", "number", "payload", "response", "details"];
    for (const nk of nestedKeys) {
      const child = o[nk];
      if (child && typeof child === "object") {
        const inner = walk(child, depth + 1);
        if (inner) return inner;
      }
    }
    for (const v of Object.values(o)) {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const inner = walk(v, depth + 1);
        if (inner) return inner;
      }
    }
    return "";
  };

  return walk(payload, 0);
}

/**
 * After portal lookup: compare range holder (RH) to Current Provider and Is Multi Line.
 * - Multi + same → multi
 * - Multi + different → sub_multi
 * - Not multi + same → single
 * - Not multi + different → sub_single
 */
export function deriveGnpPortTypeFromLookup(
  isMultiLine: boolean,
  currentProvider: string,
  rangeHolder: string
): "single" | "multi" | "sub_single" | "sub_multi" {
  const cp = normalizePortingProviderLabel(currentProvider);
  const rh = normalizePortingProviderLabel(rangeHolder);
  const same = cp.length > 0 && rh.length > 0 && cp === rh;
  if (isMultiLine) {
    return same ? "multi" : "sub_multi";
  }
  return same ? "single" : "sub_single";
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
    const lookupDigits = (entry.mainBillingNumber?.trim() || entry.number).replace(/\D+/g, "");
    const lookupPayload = await lookupNumberRangeHolder(lookupDigits);
    const rangeHolder = extractRangeHolderFromLookupPayload(lookupPayload);
    if (!rangeHolder.trim()) {
      throw new Error(
        "Could not read range holder from SIMWOOD portal lookup. Check number format and portal /v3/numbers/{account}/lookup response."
      );
    }
    const multiParsed = parseIsMultiLineCell(entry.isMultiLine);
    if (multiParsed === null) {
      throw new Error(
        'Is Multi Line must be Yes or No when provided (leave blank for No).'
      );
    }
    const portType = deriveGnpPortTypeFromLookup(
      multiParsed,
      entry.currentProvider?.trim() || "",
      rangeHolder
    );

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
      type: portType,
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
