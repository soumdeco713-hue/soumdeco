// ============================================================
//  ADAPTIVE STORAGE — localStorage with IndexedDB fallback
// ============================================================
//  localStorage has a 5 MB limit. For large catalogs (9,500 products
//  × 2 KB each = 19 MB), it overflows and silently fails.
//
//  This module provides an adaptive storage layer:
//  - Small catalogs (< 4 MB): localStorage (fast, synchronous)
//  - Large catalogs (> 4 MB): IndexedDB (slower, but 50+ MB limit)
//
//  The switch is automatic — if localStorage.setItem throws QuotaExceededError,
//  we transparently fall back to IndexedDB.
// ============================================================

const DB_NAME = "soumdeco_db";
const DB_VERSION = 1;
const STORE_NAME = "kv";
const DB_READY_TIMEOUT_MS = 5000;

let dbInstance: IDBDatabase | null = null;
let dbInitPromise: Promise<IDBDatabase | null> | null = null;

/**
 * Open the IndexedDB database. Returns null if IndexedDB is unavailable
 * (private browsing, old browser, etc.)
 */
function openDB(): Promise<IDBDatabase | null> {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }

    const timeout = setTimeout(() => resolve(null), DB_READY_TIMEOUT_MS);

    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => {
        clearTimeout(timeout);
        dbInstance = req.result;
        resolve(dbInstance);
      };
      req.onerror = () => {
        clearTimeout(timeout);
        resolve(null);
      };
    } catch {
      clearTimeout(timeout);
      resolve(null);
    }
  });

  return dbInitPromise;
}

/**
 * Check if a value would fit in localStorage (rough estimate).
 * localStorage limit is typically 5 MB (5,000,000 chars).
 * We use 4 MB as the safe threshold (leaves room for other keys).
 */
const LOCAL_STORAGE_SAFE_LIMIT = 4_000_000;

/**
 * Save a value adaptively — tries localStorage first, falls back to IndexedDB
 * if the value is too large or localStorage quota is exceeded.
 *
 * Returns true if saved successfully, false if both methods fail.
 */
export async function adaptiveSet(key: string, value: string): Promise<boolean> {
  // Try localStorage first (fast path)
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      // Check if the value fits
      if (value.length <= LOCAL_STORAGE_SAFE_LIMIT) {
        window.localStorage.setItem(key, value);
        // Verify it was actually saved (some browsers silently truncate)
        const check = window.localStorage.getItem(key);
        if (check && check.length === value.length) {
          return true;
        }
        // Verification failed — don't destroy the old value!
        // Restore is not possible (setItem already overwrote it),
        // but we keep whatever is there and fall through to IndexedDB.
      }
      // Value too large for localStorage — DON'T remove the existing
      // value (it might be a valid older version). Just fall through
      // to IndexedDB.
    } catch (e: any) {
      // QuotaExceededError — the old value is still in localStorage
      // (setItem failed atomically). Don't destroy it.
      console.warn(`[adaptiveStorage] localStorage quota exceeded for key "${key}" (${value.length} chars), falling back to IndexedDB`);
    }
  }

  // Fall back to IndexedDB (large value path)
  const db = await openDB();
  if (!db) {
    console.error("[adaptiveStorage] IndexedDB unavailable — cannot save large value");
    return false;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => {
        console.error("[adaptiveStorage] IndexedDB write failed:", tx.error);
        resolve(false);
      };
    } catch (err) {
      console.error("[adaptiveStorage] IndexedDB transaction failed:", err);
      resolve(false);
    }
  });
}

/**
 * Load a value adaptively — checks localStorage first, then IndexedDB.
 * Returns null if not found.
 *
 * Note: IndexedDB is async, so this function is async. Callers that
 * previously used synchronous localStorage.getItem() need to await this.
 */
export async function adaptiveGet(key: string): Promise<string | null> {
  // Try localStorage first (fast path)
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const value = window.localStorage.getItem(key);
      if (value !== null) {
        return value;
      }
    } catch {
      // localStorage might be corrupted — fall through to IndexedDB
    }
  }

  // Fall back to IndexedDB
  const db = await openDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const result = req.result;
        resolve(typeof result === "string" ? result : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Remove a value from both localStorage and IndexedDB.
 */
export async function adaptiveRemove(key: string): Promise<void> {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.removeItem(key);
    } catch {}
  }
  const db = await openDB();
  if (!db) return;
  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(key);
  } catch {}
}
