/**
 * BCF-SL Universal MongoDB Atlas Real-Time Persistence Bridge
 *
 * Automatically captures all form submissions and data mutations across
 * all BCF-SL modules and iframe applications, syncing them immediately
 * to the live MongoDB Atlas cluster (administrativehub.e9xkgcl.mongodb.net).
 */
(function () {
  const API_BASE = (typeof window !== "undefined" && window.location.origin && window.location.origin.startsWith("http")) ? window.location.origin : "http://localhost:3001";

  // Mapping of localStorage keys to MongoDB Collections and Primary Key fields
  const STORAGE_COLLECTION_MAP = {
    bcf_staff_registry: { collection: "employees", keyField: "employeeId" },
    bcf_user_accounts: { collection: "user_accounts", keyField: "userId" },
    bcf_audit_logs: { collection: "audit_logs", keyField: "auditId" },
    bcf_staff_loans: { collection: "staff_loans", keyField: "loanId" },
    bcf_loan_applications: { collection: "staff_loans", keyField: "id" },
    bcf_leave_requests: { collection: "leave_requests", keyField: "id" },
    bcf_leave_registry: { collection: "leave_requests", keyField: "id" },
    bcf_leave_applications: { collection: "leave_requests", keyField: "id" },
    bcf_donors: { collection: "donors", keyField: "id" },
    bcf_donations: { collection: "donations", keyField: "id" },
    bcf_procurement_suppliers: { collection: "procurement", keyField: "id" },
    bcf_purchase_orders: { collection: "procurement", keyField: "id" },
    bcf_purchase_requisitions: { collection: "procurement", keyField: "id" },
    bcf_grns: { collection: "procurement", keyField: "id" },
    bcf_partners: { collection: "partnerships", keyField: "id" },
    bcf_deals: { collection: "deal_pipeline", keyField: "id" },
    bcf_programs: { collection: "programs", keyField: "id" },
    bcf_beneficiaries: { collection: "beneficiaries", keyField: "id" },
    bcf_financial_ledger: { collection: "financial_ledger", keyField: "id" },
    bcf_payroll_schedule: { collection: "payroll", keyField: "id" },
    bcf_learning_accounts: { collection: "learning_accounts", keyField: "accountId" },
    bcf_learning_enrollments: { collection: "learning_enrollments", keyField: "id" },
    bcf_courses: { collection: "learning_courses", keyField: "id" },
  };

  const pendingSyncs = new Map();
  let syncDebounceTimer = null;

  const BCF_MONGO = {
    // Health Check
    async checkHealth() {
      try {
        const res = await fetch(`${API_BASE}/api/db/health`);
        return await res.json();
      } catch (err) {
        return { success: false, connected: false, error: err.message };
      }
    },

    // Universal sync documents to MongoDB
    async sync(collectionName, items, keyField = "id") {
      if (!collectionName || !items) return { success: false, error: "Missing arguments" };
      const documents = Array.isArray(items) ? items : [items];
      if (documents.length === 0) return { success: true, count: 0 };

      try {
        const res = await fetch(`${API_BASE}/api/db/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ collection: collectionName, documents, keyField }),
        });
        const data = await res.json();
        console.log(`[BCF-Mongo] Synced ${documents.length} item(s) to collection '${collectionName}':`, data);
        return data;
      } catch (err) {
        console.warn(`[BCF-Mongo] Sync failed for '${collectionName}':`, err);
        return { success: false, error: err.message };
      }
    },

    // Pull collection items from MongoDB
    async fetch(collectionName) {
      try {
        const res = await fetch(`${API_BASE}/api/db/sync?collection=${encodeURIComponent(collectionName)}`);
        const data = await res.json();
        return data.success && Array.isArray(data.data) ? data.data : [];
      } catch (err) {
        console.warn(`[BCF-Mongo] Fetch failed for '${collectionName}':`, err);
        return [];
      }
    },

    // Save and persist single or multiple employee records directly
    async saveEmployee(empData) {
      if (!empData) return { success: false };
      const items = Array.isArray(empData) ? empData : [empData];

      try {
        // Post directly to master /api/employees endpoint
        const res = await fetch(`${API_BASE}/api/employees`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(items),
        });
        const data = await res.json();

        // Also sync to /api/db/sync collection
        await this.sync("employees", items, "employeeId");

        console.log("[BCF-Mongo] Employee successfully saved to MongoDB Atlas:", data);
        return data;
      } catch (err) {
        console.warn("[BCF-Mongo] Failed to save employee to Atlas:", err);
        // Fallback to sync
        return await this.sync("employees", items, "employeeId");
      }
    },

    // Fetch master employees directly
    async fetchEmployees() {
      try {
        const res = await fetch(`${API_BASE}/api/employees`);
        const data = await res.json();
        return data.success && Array.isArray(data.data) ? data.data : [];
      } catch (err) {
        return [];
      }
    },

    // Handle intercepted storage changes
    handleStorageChange(key, value) {
      const mapping = STORAGE_COLLECTION_MAP[key];
      if (!mapping || !value) return;

      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          pendingSyncs.set(mapping.collection, {
            items: parsed,
            keyField: mapping.keyField,
          });

          // Debounce batch push
          if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
          syncDebounceTimer = setTimeout(() => {
            BCF_MONGO.flushPendingSyncs();
          }, 300);
        } else if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          // Single object
          this.sync(mapping.collection, [parsed], mapping.keyField);
        }
      } catch (_) {}
    },

    // Flush all queued storage changes to MongoDB Atlas
    async flushPendingSyncs() {
      for (const [collection, payload] of pendingSyncs.entries()) {
        await BCF_MONGO.sync(collection, payload.items, payload.keyField);
      }
      pendingSyncs.clear();
    },

    // Hydrate local cache from MongoDB Atlas on page load
    async hydrateAll() {
      try {
        // 1. Hydrate employees
        const remoteEmployees = await BCF_MONGO.fetchEmployees();
        if (Array.isArray(remoteEmployees) && remoteEmployees.length > 0) {
          const localRaw = localStorage.getItem("bcf_staff_registry");
          let localStaff = [];
          try { localStaff = JSON.parse(localRaw || "[]"); } catch (_) {}

          const map = new Map();
          // Put remote first
          remoteEmployees.forEach((emp) => {
            const id = emp.employeeId || emp.id;
            if (id) map.set(id, emp);
          });
          // Merge local (local might have in-progress edits)
          localStaff.forEach((emp) => {
            const id = emp.employeeId || emp.id;
            if (id) {
              const existing = map.get(id) || {};
              map.set(id, { ...existing, ...emp });
            }
          });

          const merged = Array.from(map.values());
          localStorage.setItem("bcf_staff_registry", JSON.stringify(merged));
          window.dispatchEvent(new CustomEvent("bcf_employees_hydrated", { detail: merged }));
        }

        // 2. Hydrate learning accounts
        const remoteAccounts = await BCF_MONGO.fetch("learning_accounts");
        if (Array.isArray(remoteAccounts) && remoteAccounts.length > 0) {
          const localRaw = localStorage.getItem("bcf_learning_accounts");
          let localAccs = [];
          try { localAccs = JSON.parse(localRaw || "[]"); } catch (_) {}

          const accMap = new Map();
          remoteAccounts.forEach((a) => accMap.set(a.accountId || a.employeeId, a));
          localAccs.forEach((a) => accMap.set(a.accountId || a.employeeId, a));
          localStorage.setItem("bcf_learning_accounts", JSON.stringify(Array.from(accMap.values())));
          window.dispatchEvent(new CustomEvent("bcf_accounts_hydrated", { detail: Array.from(accMap.values()) }));
        }
      } catch (err) {
        console.warn("[BCF-Mongo] Hydration check:", err);
      }
    },

    // Initialize all listeners and storage hooks
    init() {
      // 1. Intercept localStorage.setItem
      if (typeof window !== "undefined" && window.localStorage) {
        const originalSetItem = window.localStorage.setItem;
        window.localStorage.setItem = function (key, value) {
          originalSetItem.apply(this, arguments);
          try {
            BCF_MONGO.handleStorageChange(key, value);
          } catch (e) {
            console.warn("[BCF-Mongo Bridge] Interceptor error:", e);
          }
        };

        // Listen for storage events from other frames/windows
        window.addEventListener("storage", (e) => {
          if (e.key && e.newValue) {
            BCF_MONGO.handleStorageChange(e.key, e.newValue);
          }
        });
      }

      // 2. Auto-hydrate on startup
      setTimeout(() => {
        BCF_MONGO.hydrateAll();
      }, 500);

      // 3. Page unload flush: ensure pending syncs are sent via sendBeacon
      if (typeof window !== "undefined") {
        window.addEventListener("beforeunload", () => {
          for (const [collection, payload] of pendingSyncs.entries()) {
            if (navigator.sendBeacon) {
              const blob = new Blob(
                [JSON.stringify({ collection, documents: payload.items, keyField: payload.keyField })],
                { type: "application/json" }
              );
              navigator.sendBeacon(`${API_BASE}/api/db/sync`, blob);
            }
          }
        });
      }
    },
  };

  // Expose to window
  if (typeof window !== "undefined") {
    window.BCF_MONGO = BCF_MONGO;
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => BCF_MONGO.init());
    } else {
      BCF_MONGO.init();
    }
  }

  // CommonJS export if needed
  if (typeof module !== "undefined" && module.exports) {
    module.exports = BCF_MONGO;
  }
})();
