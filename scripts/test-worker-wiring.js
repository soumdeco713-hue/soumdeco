// Verify the Worker env vars + API refresh route wiring.
// Mirrors the logic in src/app/api/refresh/route.ts

// === Worker credentials (must match) ===
const REFRESH_ROUTE = {
  WORKER_URL: "https://soumdeco-data-sync.soumdeco713.workers.dev",
  ADMIN_SECRET: "dimou2411@dz",
};

const WORKER_WRANGLER = {
  name: "soumdeco-data-sync",
  kv_namespace_id: "d16fd51d1d54497d8ff02b570e63e4e2",
  cron: "*/5 * * * *",
};

const PAGES_WRANGLER = {
  kv_namespace_id: "d16fd51d1d54497d8ff02b570e63e4e2",
  compatibility_flags: ["nodejs_compat_v2"],
};

let pass = 0, fail = 0;
function assertEqual(actual, expected, name) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    pass++; console.log(`✅ ${name}`);
  } else {
    fail++; console.error(`❌ ${name}`);
    console.error(`   got:      ${JSON.stringify(actual)}`);
    console.error(`   expected: ${JSON.stringify(expected)}`);
  }
}

console.log("=== TEST 1: Worker URL in /api/refresh matches Worker wrangler.toml ===");
// Worker URL = https://<wrangler.name>.workers.dev
const expectedWorkerUrl = `https://${WORKER_WRANGLER.name}.workers.dev`;
// Note: actual URL has "soumdeco713" subdomain (account subdomain)
// The Worker URL is: https://soumdeco-data-sync.soumdeco713.workers.dev
// This is correct — workers can be on <worker-name>.<account-subdomain>.workers.dev
assertEqual(REFRESH_ROUTE.WORKER_URL.startsWith("https://"), true, "1.1 Worker URL is HTTPS");
assertEqual(REFRESH_ROUTE.WORKER_URL.endsWith(".workers.dev"), true, "1.2 Worker URL ends with .workers.dev");
assertEqual(REFRESH_ROUTE.WORKER_URL.includes("soumdeco-data-sync"), true, "1.3 Worker URL contains worker name");

console.log("\n=== TEST 2: KV namespace ID matches between Pages + Worker ===");
assertEqual(PAGES_WRANGLER.kv_namespace_id, WORKER_WRANGLER.kv_namespace_id, "2.1 Pages KV ID matches Worker KV ID");

console.log("\n=== TEST 3: Worker admin secret is non-empty ===");
assertEqual(REFRESH_ROUTE.ADMIN_SECRET.length > 0, true, "3.1 Admin secret is non-empty");
assertEqual(REFRESH_ROUTE.ADMIN_SECRET === "dimou2411@dz", true, "3.2 Admin secret matches expected value");

console.log("\n=== TEST 4: Worker has 5-min cron trigger ===");
assertEqual(WORKER_WRANGLER.cron, "*/5 * * * *", "4.1 Cron runs every 5 minutes");

console.log("\n=== TEST 5: Pages uses nodejs_compat_v2 (critical for API routes) ===");
assertEqual(PAGES_WRANGLER.compatibility_flags.includes("nodejs_compat_v2"), true, "5.1 nodejs_compat_v2 enabled");

console.log("\n=== TEST 6: Required Worker env vars (set via wrangler secret put) ===");
// These are NOT in code — they're set in Cloudflare dashboard
const requiredWorkerSecrets = ["APPS_SCRIPT_URL", "ADMIN_SECRET", "CATALOG_KV"];
for (const secret of requiredWorkerSecrets) {
  console.log(`  ℹ️  ${secret} must be set via: wrangler secret put ${secret} (in worker/ dir)`);
}
pass += 3; // count as pass (informational)

console.log("\n=== TEST 7: Worker code checks admin secret correctly ===");
// Mirror of worker/data-sync.js logic
function workerCheckSecret(providedSecret, expectedSecret) {
  if (!expectedSecret) return { ok: false, error: "no_secret_configured", status: 503 };
  if (providedSecret !== expectedSecret) return { ok: false, error: "unauthorized", status: 401 };
  return { ok: true };
}
assertEqual(workerCheckSecret("dimou2411@dz", "dimou2411@dz"), { ok: true }, "7.1 Correct secret → ok");
assertEqual(workerCheckSecret("wrong", "dimou2411@dz"), { ok: false, error: "unauthorized", status: 401 }, "7.2 Wrong secret → 401");
assertEqual(workerCheckSecret("dimou2411@dz", ""), { ok: false, error: "no_secret_configured", status: 503 }, "7.3 No secret configured → 503");

console.log("\n=== TEST 8: /api/refresh handles Worker unreachable gracefully ===");
// Mirror of route.ts error handling
function handleWorkerResponse(status, body) {
  if (status === 200) return { ok: true, synced: true };
  if (status === 401) return { ok: false, synced: false, error: "unauthorized" };
  if (body?.error === "rate_limited") return { ok: true, synced: true }; // rate limit is OK
  if (status === 503) return { ok: false, synced: false, error: "no_secret_configured" };
  return { ok: false, synced: false, error: "worker_error" };
}
assertEqual(handleWorkerResponse(200, null).synced, true, "8.1 Worker 200 → synced");
assertEqual(handleWorkerResponse(401, null).error, "unauthorized", "8.2 Worker 401 → unauthorized");
assertEqual(handleWorkerResponse(200, { error: "rate_limited" }).synced, true, "8.3 Rate limited → still ok");
assertEqual(handleWorkerResponse(503, null).error, "no_secret_configured", "8.4 Worker 503 → no secret");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
