import { readFileSync } from "node:fs";
import { GoogleAuth } from "google-auth-library";

function parseServiceAccount():
  | { projectId: string; clientEmail: string; privateKey: string }
  | null {
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!filePath?.trim()) return null;

  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };
  if (parsed.project_id && parsed.client_email && parsed.private_key) {
    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key,
    };
  }

  return null;
}

function fieldMap(data: Record<string, string | number | boolean>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string") {
      fields[key] = { stringValue: value };
    } else if (typeof value === "boolean") {
      fields[key] = { booleanValue: value };
    } else if (typeof value === "number") {
      if (Number.isInteger(value)) {
        fields[key] = { integerValue: String(value) };
      } else {
        fields[key] = { doubleValue: value };
      }
    }
  }
  return fields;
}

export async function createAppLogDocument(agentuuid: string): Promise<string> {
  const serviceAccount = parseServiceAccount();
  if (!serviceAccount) {
    throw new Error(
      "Firebase credentials are missing. Set FIREBASE_SERVICE_ACCOUNT_JSON to your service-account JSON file path."
    );
  }

  const collectionName = process.env.FIRESTORE_APP_LOGS_COLLECTION || "realtime_events";
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);

  const auth = new GoogleAuth({
    credentials: {
      client_email: serviceAccount.clientEmail,
      private_key: serviceAccount.privateKey,
    },
    scopes: ["https://www.googleapis.com/auth/datastore"],
  });
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  if (!token) {
    throw new Error("Failed to obtain Google access token for Firestore");
  }

  const projectId = serviceAccount.projectId;
  const parent = `projects/${projectId}/databases/(default)/documents`;
  const url = `https://firestore.googleapis.com/v1/${parent}/${encodeURIComponent(collectionName)}`;

  const body = {
    fields: fieldMap({
      event: "UploadLog",
      timestamp: nowMs / 1000,
      agentUuid: agentuuid,
      created_at: nowSec,
      delete_at: nowSec + 3600,
    }),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as { name?: string; error?: { message?: string } };
  if (!res.ok) {
    throw new Error(json.error?.message || `Firestore REST error: ${res.status}`);
  }

  const name = json.name;
  if (!name || typeof name !== "string") {
    throw new Error("Firestore did not return a document name");
  }
  const parts = name.split("/");
  return parts[parts.length - 1] ?? name;
}
