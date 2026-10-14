import { MongoClient, Db, Collection } from "mongodb";
import dns from "dns";

// Fix Windows Node.js querySrv DNS resolution timeout/ECONNREFUSED by using Google & Cloudflare DNS
try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch (e) {
  // Ignore in environments where setServers is restricted
}

/**
 * BCF-SL MongoDB Atlas Connection & Client Manager
 *
 * Provides connection pooling, automatic reconnects, hot-reload singleton caching,
 * and diagnostic health probes for the BCF-SL Administrative Hub.
 */

export const DEFAULT_DB_NAME = process.env.MONGODB_DB || "bcf_administrative_hub";

export function getMongoUri(): string {
  return (
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    "mongodb+srv://<db_username>:<db_password>@administrativehub.e9xkgcl.mongodb.net/?appName=AdministrativeHub"
  );
}

// Check if credentials are placeholders
export function isPlaceholderUri(uri?: string): boolean {
  const target = uri || getMongoUri();
  return (
    !target ||
    target.includes("<db_username>") ||
    target.includes("<db_password>") ||
    target.includes("<") ||
    target.includes(">") ||
    target.includes("db_username")
  );
}

export function sanitizeUri(uri?: string): string {
  const target = uri || getMongoUri();
  try {
    return target.replace(/:([^@]+)@/, ":****@");
  } catch {
    return "mongodb+srv://****@administrativehub.e9xkgcl.mongodb.net";
  }
}

// Global cached client for Next.js hot-reloading
interface GlobalWithMongo extends Global {
  _mongoClientPromise?: Promise<MongoClient>;
}

declare const global: GlobalWithMongo;

export function getDirectReplicaUri(rawUri: string): string | null {
  const match = rawUri.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@administrativehub\.e9xkgcl\.mongodb\.net/);
  if (match) {
    const user = match[1];
    const pass = match[2];
    if (user.includes("<") || pass.includes("<")) return null;
    return `mongodb://${encodeURIComponent(decodeURIComponent(user))}:${encodeURIComponent(decodeURIComponent(pass))}@ac-jt1fltj-shard-00-00.e9xkgcl.mongodb.net:27017,ac-jt1fltj-shard-00-01.e9xkgcl.mongodb.net:27017,ac-jt1fltj-shard-00-02.e9xkgcl.mongodb.net:27017/bcf_administrative_hub?ssl=true&authSource=admin&replicaSet=atlas-9c1itd-shard-0&appName=AdministrativeHub`;
  }
  return null;
}

async function createConnectedClient(targetUri: string): Promise<MongoClient> {
  const client = new MongoClient(targetUri, {
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 20,
  });

  try {
    return await client.connect();
  } catch (err: any) {
    const isDnsBlocked =
      err &&
      (err.code === "ECONNREFUSED" ||
        err.syscall === "querySrv" ||
        err.message?.includes("querySrv") ||
        err.message?.includes("SRV"));

    if (isDnsBlocked) {
      const directUri = getDirectReplicaUri(targetUri);
      if (directUri && directUri !== targetUri) {
        console.warn("[MongoDB] SRV query blocked by DNS; connecting via Atlas direct replica-set hosts...");
        const directClient = new MongoClient(directUri, {
          connectTimeoutMS: 10000,
          serverSelectionTimeoutMS: 10000,
          maxPoolSize: 20,
        });
        return await directClient.connect();
      }
    }
    throw err;
  }
}

let clientPromise: Promise<MongoClient> | null = null;

export function getMongoClientPromise(): Promise<MongoClient> {
  try {
    dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
  } catch (_) {}

  if (isPlaceholderUri()) {
    return Promise.reject(
      new Error(
        "MongoDB Atlas credentials not set: Please replace <db_username> and <db_password> in frontend/.env with your MongoDB Atlas database user and password."
      )
    );
  }

  const uri = getMongoUri();

  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      const p = createConnectedClient(uri).catch((err) => {
        global._mongoClientPromise = undefined;
        throw err;
      });
      global._mongoClientPromise = p;
    }
    return global._mongoClientPromise;
  } else {
    if (!clientPromise) {
      clientPromise = createConnectedClient(uri).catch((err) => {
        clientPromise = null;
        throw err;
      });
    }
    return clientPromise;
  }
}

export async function getDb(dbName: string = DEFAULT_DB_NAME): Promise<Db> {
  const client = await getMongoClientPromise();
  return client.db(dbName);
}

export async function getCollection<T extends Record<string, any>>(
  collectionName: string,
  dbName: string = DEFAULT_DB_NAME
): Promise<Collection<T>> {
  const db = await getDb(dbName);
  return db.collection<T>(collectionName);
}

export const COLLECTIONS = {
  EMPLOYEES: "employees",
  LEARNING_ACCOUNTS: "learning_accounts",
  LEARNING_ENROLLMENTS: "learning_enrollments",
  LEARNING_COURSES: "learning_courses",
  LEARNING_SEMESTERS: "learning_semesters",
  LEARNING_VENDORS: "learning_vendors",
  STAFF_LOANS: "staff_loans",
  DONORS: "donors",
  DONATIONS: "donations",
  BENEFICIARIES: "beneficiaries",
  PROCUREMENT: "procurement",
  PARTNERSHIPS: "partnerships",
  LEAVE_REQUESTS: "leave_requests",
  DISCIPLINE_CASES: "discipline_cases",
  AUDIT_LOGS: "audit_logs",
  USER_ACCOUNTS: "user_accounts",
  SYSTEM_SETTINGS: "system_settings",
  DOCUMENTS: "documents_policies",
  DOCUMENTS_NOTIFICATIONS: "documents_notifications",
  DOCUMENTS_PERMISSIONS: "documents_permissions",
  EMPLOYEE_CONTRACTS: "employee_contracts",
  INVENTORY_ITEMS: "inventory_items",
  INVENTORY_STORES: "inventory_stores",
  INVENTORY_TRANSACTIONS: "inventory_transactions",
  ASSETS: "assets",
  ASSET_ASSIGNMENTS: "asset_assignments",
  ASSET_MAINTENANCE: "asset_maintenance",
  ASSET_INSPECTIONS: "asset_inspections",
  ASSET_DISPOSALS: "asset_disposals",
  ASSET_INCIDENTS: "asset_incidents",
  ASSET_CATEGORIES: "asset_categories",
  PROCUREMENT_SETTINGS: "procurement_settings",
  PROCUREMENT_PERMISSIONS: "procurement_permissions",
  ACCESS_CATALOGUE: "access_catalogue",
  ACCESS_REQUESTS: "access_requests",
  ACCESS_REQUEST_ITEMS: "access_request_items",
  ACCESS_REQUEST_STEPS: "access_request_steps",
  ACCESS_GRANTS: "access_grants",
  ACCESS_NOTIFICATIONS: "access_notifications",
  ACCESS_SETTINGS: "access_settings",
  ACCESS_REVOCATIONS: "access_revocations",
  VISITORS: "visitors",
  VISITOR_SESSIONS: "visitor_sessions",
  VISITOR_PAGE_VIEWS: "visitor_page_views",
  LOGIN_ATTEMPTS: "login_attempts",
  BLOCKED_ENTRIES: "blocked_entries",
  BLOCKED_ATTEMPTS: "blocked_attempts",
  VISITOR_SETTINGS: "visitor_settings",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

export interface MongoHealthReport {
  connected: boolean;
  status: "connected" | "disconnected" | "placeholder_credentials";
  database: string;
  cluster: string;
  sanitizedUri: string;
  collections?: { name: string; documentCount: number }[];
  totalDocuments?: number;
  error?: string;
  latencyMs?: number;
}

export async function checkMongoHealth(): Promise<MongoHealthReport> {
  const cluster = "administrativehub.e9xkgcl.mongodb.net";
  const sanitized = sanitizeUri();

  if (isPlaceholderUri()) {
    return {
      connected: false,
      status: "placeholder_credentials",
      database: DEFAULT_DB_NAME,
      cluster,
      sanitizedUri: sanitized,
      error:
        "MongoDB Atlas URI contains unreplaced placeholders: <db_username>:<db_password>. Update frontend/.env with valid credentials.",
    };
  }

  const start = Date.now();
  try {
    const client = await getMongoClientPromise();
    const db = client.db(DEFAULT_DB_NAME);
    await db.command({ ping: 1 });
    const latencyMs = Date.now() - start;

    const collectionsInfo = await db.listCollections().toArray();
    const collectionsWithCounts = await Promise.all(
      collectionsInfo.map(async (col) => {
        try {
          const count = await db.collection(col.name).countDocuments();
          return { name: col.name, documentCount: count };
        } catch {
          return { name: col.name, documentCount: 0 };
        }
      })
    );

    const totalDocuments = collectionsWithCounts.reduce(
      (sum, c) => sum + c.documentCount,
      0
    );

    return {
      connected: true,
      status: "connected",
      database: DEFAULT_DB_NAME,
      cluster,
      sanitizedUri: sanitized,
      latencyMs,
      collections: collectionsWithCounts,
      totalDocuments,
    };
  } catch (err: any) {
    return {
      connected: false,
      status: "disconnected",
      database: DEFAULT_DB_NAME,
      cluster,
      sanitizedUri: sanitized,
      error: err.message || "Failed to connect to MongoDB Atlas.",
    };
  }
}
