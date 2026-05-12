/**
 * Normalize SIMWOOD porting API rows for dashboard display.
 * List responses often nest fields under `data` / `request`; associated lines may only appear on detail responses.
 */

export interface PortingDashboardRowShape {
  ref: string;
  mbn: string;
  associatedNumbers: string;
  /** GNP vs MNP — used for lazy detail fetch path. */
  portKind: "local" | "mobile";
  /** True after a successful detail fetch (even when associated list is empty). */
  associatedDetailLoaded?: boolean;
  date: string;
  crd: string;
  status: string;
  statusCode: string;
}

const NEST_KEYS = ["data", "request", "port", "gnp", "details", "payload", "record"] as const;

export function flattenPortingApiRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  for (const key of NEST_KEYS) {
    const v = row[key];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, v as Record<string, unknown>);
    }
  }
  if (typeof out.numbers === "string") {
    try {
      const parsed = JSON.parse(out.numbers as string);
      if (Array.isArray(parsed)) out.numbers = parsed;
    } catch {
      /* ignore */
    }
  }
  return out;
}

export function readPortingNumberField(obj: Record<string, unknown>): string {
  const n =
    obj.number ??
    obj.Number ??
    obj.msisdn ??
    obj.Msisdn ??
    obj.digits ??
    obj.tel ??
    obj.mbn ??
    obj.MBN;
  if (typeof n === "number" && Number.isFinite(n)) return String(n);
  if (typeof n === "string") return n.trim();
  return "";
}

export function resolvePortingMbn(row: Record<string, unknown>): string {
  const direct = String(row.mbn ?? row.msisdn ?? row.number ?? "").trim();
  if (direct && direct !== "—") return direct;

  const numbers = row.numbers;
  if (!Array.isArray(numbers)) return "";

  for (const item of numbers) {
    if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      const typ = String(obj.type ?? obj.Type ?? "").toLowerCase();
      if (typ === "mbn" || typ === "main") {
        const n = readPortingNumberField(obj);
        if (n) return n;
      }
    }
  }

  for (const item of numbers) {
    if (typeof item === "string" && item.trim()) return item.trim();
    if (item && typeof item === "object") {
      const n = readPortingNumberField(item as Record<string, unknown>);
      if (n) return n;
    }
  }

  return "";
}

export function extractPortingAssociatedNumbers(
  row: Record<string, unknown>,
  primaryMbn: string
): string {
  const scalarFields = [
    row.associated_numbers,
    row.associatedNumbers,
    row.associated,
    row.additional_numbers,
    row.additionalNumbers,
    row.extra_numbers,
    row.secondary_numbers,
  ];
  for (const field of scalarFields) {
    if (typeof field === "string" && field.trim()) return field.trim();
    if (Array.isArray(field)) {
      const parts = field
        .map((x) =>
          typeof x === "string" ? x.trim() : readPortingNumberField(x as Record<string, unknown>)
        )
        .filter(Boolean);
      if (parts.length) return parts.join(", ");
    }
  }

  const numbers = row.numbers;
  if (!Array.isArray(numbers)) return "";

  const primary = primaryMbn.trim();
  const associated: string[] = [];
  const seen = new Set<string>();

  for (const item of numbers) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const typ = String(obj.type ?? obj.Type ?? "").toLowerCase();
    const num = readPortingNumberField(obj);
    if (!num) continue;

    if (
      typ === "associated" ||
      typ === "associated_number" ||
      typ === "additional" ||
      typ === "extra" ||
      typ === "secondary"
    ) {
      if (!seen.has(num)) {
        seen.add(num);
        associated.push(num);
      }
    }
  }

  if (associated.length > 0) return associated.join(", ");

  for (const item of numbers) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const typ = String(obj.type ?? obj.Type ?? "").toLowerCase();
    const num = readPortingNumberField(obj);
    if (!num) continue;
    if (typ === "mbn" || typ === "main") continue;
    if (num !== primary && !seen.has(num)) {
      seen.add(num);
      associated.push(num);
    }
  }

  return associated.join(", ");
}

export function normalizePortingDashboardRow(row: Record<string, unknown>): PortingDashboardRowShape {
  const flat = flattenPortingApiRow(row);
  const portKind: "local" | "mobile" =
    flat.port_type === "mobile" || row.port_type === "mobile" ? "mobile" : "local";
  const mbn = resolvePortingMbn(flat) || "—";
  const associatedNumbers =
    mbn !== "—"
      ? extractPortingAssociatedNumbers(flat, mbn)
      : extractPortingAssociatedNumbers(flat, "");

  return {
    ref: String(flat.ref ?? flat.orderid ?? flat.order_id ?? "—"),
    mbn,
    associatedNumbers,
    portKind,
    date: String(flat.date ?? flat.date_added ?? "—"),
    crd: String(flat.crd ?? flat.date_port ?? "—"),
    status: String(flat.status ?? flat.status_code ?? "—"),
    statusCode: String(flat.status_code ?? ""),
  };
}
