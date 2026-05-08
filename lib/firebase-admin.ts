import { App, cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { Firestore, getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";

let cachedDb: Firestore | null = null;

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

function getFirebaseAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }

  const serviceAccount = parseServiceAccount();
  if (!serviceAccount) {
    throw new Error(
      "Firebase credentials are missing. Set FIREBASE_SERVICE_ACCOUNT_JSON to your service-account JSON file path."
    );
  }

  return initializeApp({
    credential: cert({
      projectId: serviceAccount.projectId,
      clientEmail: serviceAccount.clientEmail,
      privateKey: serviceAccount.privateKey,
    }),
  });
}

export function getFirestoreDb(): Firestore {
  if (cachedDb) return cachedDb;
  const app = getFirebaseAdminApp();
  cachedDb = getFirestore(app);
  return cachedDb;
}

export async function createAppLogDocument(agentuuid: string): Promise<string> {
  const db = getFirestoreDb();
  const collectionName = process.env.FIRESTORE_APP_LOGS_COLLECTION || "realtime_events";
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);
  const docRef = await db.collection(collectionName).add({
    event: "UploadLog",
    timestamp: nowMs / 1000,
    agentUuid: agentuuid,
    created_at: nowSec,
    delete_at: nowSec + 3600,
  });
  return docRef.id;
}
