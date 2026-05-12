import type { DataSource } from "typeorm";
import { getDataSource } from "./data-source";

let cached: DataSource | null = null;

export async function getDatabaseConnection(): Promise<DataSource> {
  if (!cached?.isInitialized) {
    cached = await getDataSource();
  }
  return cached;
}

/** For Next.js API routes — reuses the same initialized DataSource. */
export async function withDatabase<T>(callback: (dataSource: DataSource) => Promise<T>): Promise<T> {
  const dataSource = await getDatabaseConnection();
  try {
    return await callback(dataSource);
  } catch (error) {
    console.error("Database operation error:", error);
    throw error;
  }
}
