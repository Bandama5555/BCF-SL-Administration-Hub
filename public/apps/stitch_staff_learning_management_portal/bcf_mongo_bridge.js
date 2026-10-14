/**
 * BCF-SL MongoDB Live Backend Bridge
 * Connects client-side modules and iframe apps directly to Next.js MongoDB backend API.
 */
(function () {
  const API_BASE = window.location.origin;

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

    // Sync collection items to MongoDB
    async sync(collectionName, items, keyField = "id") {
      try {
        const res = await fetch(`${API_BASE}/api/db/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ collection: collectionName, documents: items, keyField }),
        });
        return await res.json();
      } catch (err) {
        console.warn(`[BCF-Mongo] Sync failed for ${collectionName}:`, err);
        return { success: false, error: err.message };
      }
    },

    // Pull collection items from MongoDB
    async fetch(collectionName) {
      try {
        const res = await fetch(`${API_BASE}/api/db/sync?collection=${encodeURIComponent(collectionName)}`);
        return await res.json();
      } catch (err) {
        console.warn(`[BCF-Mongo] Fetch failed for ${collectionName}:`, err);
        return { success: false, error: err.message, data: [] };
      }
    },

    // Seed Database
    async seed() {
      try {
        const res = await fetch(`${API_BASE}/api/db/seed`, { method: "POST" });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    // Sync Staff Learning Accounts directly
    async syncLearningAccounts(accounts) {
      try {
        const res = await fetch(`${API_BASE}/api/learning/accounts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(accounts),
        });
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    // Fetch Learning Accounts
    async fetchLearningAccounts() {
      try {
        const res = await fetch(`${API_BASE}/api/learning/accounts`);
        const data = await res.json();
        return data.success ? data.data : [];
      } catch (err) {
        return [];
      }
    },

    // Auto-sync listeners for learning_db
    initLearningSync() {
      try {
        // Sync on save/account mutation
        window.addEventListener("bcf_account_saved", (e) => {
          if (e.detail) {
            BCF_MONGO.syncLearningAccounts([e.detail]);
          }
        });

        // Periodic background push to MongoDB (every 30 seconds if active)
        setInterval(() => {
          try {
            const rawAccounts = localStorage.getItem("bcf_learning_accounts");
            if (rawAccounts) {
              const accounts = JSON.parse(rawAccounts);
              if (accounts.length > 0) {
                BCF_MONGO.sync("learning_accounts", accounts, "accountId");
              }
            }

            const rawEnrollments = localStorage.getItem("bcf_learning_enrollments");
            if (rawEnrollments) {
              const enrollments = JSON.parse(rawEnrollments);
              if (enrollments.length > 0) {
                BCF_MONGO.sync("learning_enrollments", enrollments, "id");
              }
            }
          } catch (_) {}
        }, 30000);

        // Initial hydrate: Pull any backend MongoDB accounts into local store if not set
        setTimeout(async () => {
          try {
            const remote = await BCF_MONGO.fetchLearningAccounts();
            if (Array.isArray(remote) && remote.length > 0) {
              const localRaw = localStorage.getItem("bcf_learning_accounts");
              const localAccounts = localRaw ? JSON.parse(localRaw) : [];
              const mergedMap = new Map();
              remote.forEach((r) => mergedMap.set(r.employeeId || r.accountId, r));
              localAccounts.forEach((l) => mergedMap.set(l.employeeId || l.accountId, l));
              localStorage.setItem("bcf_learning_accounts", JSON.stringify(Array.from(mergedMap.values())));
            }
          } catch (_) {}
        }, 1500);
      } catch (_) {}
    },
  };

  window.BCF_MONGO = BCF_MONGO;
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => BCF_MONGO.initLearningSync());
    } else {
      BCF_MONGO.initLearningSync();
    }
  }
})();
