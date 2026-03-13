import { promises as fs } from "fs";
import path from "path";

export type Quote = {
  id: string;
  workspaceId: string;
  vendor: string;
  metalId: string;
  grade?: string;
  unit: "kg" | "ton";
  price: number;
  currency: string;
  freightPerKg?: number;
  dutyPercent?: number;
  taxPercent?: number;
  otherPerKg?: number;
  leadTimeDays?: number;
  paymentTerms?: string;
  notes?: string;
  createdAt: string;
};

export type AlertRule = {
  id: string;
  workspaceId: string;
  metalId: string;
  direction: "below" | "above";
  target: number;
  base: string;
  channel: "email" | "whatsapp";
  recipient: string;
  active: boolean;
  cooldownHours?: number;
  lastTriggeredAt?: string;
  createdAt: string;
};

const STORE_PREFIX = "uc";
const LOCAL_PATH = process.env.LOCAL_STORE_PATH;

const memoryStore = new Map<string, unknown>();

const useKv = () =>
  Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

const loadLocal = async () => {
  if (!LOCAL_PATH) return { resources: {} as Record<string, unknown> };
  try {
    const file = await fs.readFile(LOCAL_PATH, "utf-8");
    const parsed = JSON.parse(file);
    if (parsed && typeof parsed === "object" && parsed.resources) return parsed;
  } catch {
    // ignore
  }
  return { resources: {} as Record<string, unknown> };
};

const saveLocal = async (data: { resources: Record<string, unknown> }) => {
  if (!LOCAL_PATH) return;
  const folder = path.dirname(LOCAL_PATH);
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(LOCAL_PATH, JSON.stringify(data, null, 2), "utf-8");
};

const getKey = (workspaceId: string, resource: string) =>
  `${STORE_PREFIX}:${workspaceId}:${resource}`;

const getResource = async <T>(key: string, fallback: T): Promise<T> => {
  if (useKv()) {
    const { kv } = await import("@vercel/kv");
    const value = await kv.get<T>(key);
    return value ?? fallback;
  }
  if (LOCAL_PATH) {
    const data = await loadLocal();
    return (data.resources[key] as T) ?? fallback;
  }
  if (memoryStore.has(key)) return memoryStore.get(key) as T;
  return fallback;
};

const setResource = async (key: string, value: unknown) => {
  if (useKv()) {
    const { kv } = await import("@vercel/kv");
    await kv.set(key, value);
    return;
  }
  if (LOCAL_PATH) {
    const data = await loadLocal();
    data.resources[key] = value;
    await saveLocal(data);
    return;
  }
  memoryStore.set(key, value);
};

export const listQuotes = async (workspaceId: string) => {
  const key = getKey(workspaceId, "quotes");
  return getResource<Quote[]>(key, []);
};

export const saveQuotes = async (workspaceId: string, quotes: Quote[]) => {
  const key = getKey(workspaceId, "quotes");
  await setResource(key, quotes);
};

export const listAlerts = async (workspaceId: string) => {
  const key = getKey(workspaceId, "alerts");
  return getResource<AlertRule[]>(key, []);
};

export const saveAlerts = async (workspaceId: string, alerts: AlertRule[]) => {
  const key = getKey(workspaceId, "alerts");
  await setResource(key, alerts);
};
