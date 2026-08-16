#!/usr/bin/env bash
# ============================================================
#  WORKER VERIFICATION SCRIPT
# ============================================================
#  Run after `wrangler deploy` to verify all 8 scenarios work.
#  Usage:  bash scripts/verify-worker.sh <worker-url>
#   or:    bash scripts/verify-worker.sh  (uses default)
# ============================================================
set -u  # treat unset vars as errors, but don't exit on failure

WORKER_URL="${1:-https://soumdeco-data-sync.workers.dev}"
SECRET="${ADMIN_SECRET:-}"

PASS=0
FAIL=0
TOTAL=8

echo "═══════════════════════════════════════════════════"
echo "  SOUM DECO Worker Verification"
echo "  URL: $WORKER_URL"
echo "═══════════════════════════════════════════════════"
echo ""

# Test 1: catalog endpoint
echo -n "Test 1/8  GET /?action=catalog ........... "
RES=$(curl -s --max-time 5 "$WORKER_URL/?action=catalog" 2>/dev/null || echo "")
if echo "$RES" | grep -q '"products"' && echo "$RES" | grep -q '"stock"'; then
  echo "✅ PASS"
  PASS=$((PASS+1))
else
  echo "❌ FAIL (no products/stock in response)"
  FAIL=$((FAIL+1))
fi

# Test 2: products (legacy)
echo -n "Test 2/8  GET /?action=products (legacy)  "
RES=$(curl -s --max-time 5 "$WORKER_URL/?action=products" 2>/dev/null || echo "")
# Could be JSON array or empty array
if echo "$RES" | grep -qE '^\[.*\]$' || [ -z "$RES" ]; then
  echo "✅ PASS"
  PASS=$((PASS+1))
else
  echo "❌ FAIL (not a JSON array)"
  FAIL=$((FAIL+1))
fi

# Test 3: stock (legacy)
echo -n "Test 3/8  GET /?action=stock (legacy)     "
RES=$(curl -s --max-time 5 "$WORKER_URL/?action=stock" 2>/dev/null || echo "")
if [ -n "$RES" ]; then
  echo "✅ PASS"
  PASS=$((PASS+1))
else
  echo "❌ FAIL (empty response)"
  FAIL=$((FAIL+1))
fi

# Test 4: health
echo -n "Test 4/8  GET /?action=health ............ "
RES=$(curl -s --max-time 5 "$WORKER_URL/?action=health" 2>/dev/null || echo "")
if echo "$RES" | grep -q '"ok":true'; then
  LASTSYNC=$(echo "$RES" | grep -oE '"lastSync":[0-9]+' | head -1 | cut -d: -f2)
  COUNT=$(echo "$RES" | grep -oE '"productCount":[0-9]+' | head -1 | cut -d: -f2)
  echo "✅ PASS (lastSync=$LASTSYNC, products=$COUNT)"
  PASS=$((PASS+1))
else
  echo "❌ FAIL (no ok:true)"
  FAIL=$((FAIL+1))
fi

# Test 5: refresh with wrong secret
echo -n "Test 5/8  POST /refresh (wrong secret) ... "
RES=$(curl -s --max-time 5 -X POST \
  -H "X-Admin-Secret: wrong_secret_xyz" \
  "$WORKER_URL/?action=refresh" 2>/dev/null || echo "")
STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 -X POST \
  -H "X-Admin-Secret: wrong_secret_xyz" \
  "$WORKER_URL/?action=refresh" 2>/dev/null || echo "0")
if [ "$STATUS" = "401" ]; then
  echo "✅ PASS (401 unauthorized)"
  PASS=$((PASS+1))
else
  echo "❌ FAIL (expected 401, got $STATUS)"
  FAIL=$((FAIL+1))
fi

# Test 6: refresh with correct secret
if [ -n "$SECRET" ]; then
  echo -n "Test 6/8  POST /refresh (correct secret).. "
  RES=$(curl -s --max-time 15 -X POST \
    -H "X-Admin-Secret: $SECRET" \
    "$WORKER_URL/?action=refresh" 2>/dev/null || echo "")
  if echo "$RES" | grep -q '"ok":true' && echo "$RES" | grep -q '"synced":true'; then
    echo "✅ PASS (synced=true)"
    PASS=$((PASS+1))
  else
    echo "❌ FAIL (response: $RES)"
    FAIL=$((FAIL+1))
  fi
else
  echo "Test 6/8  POST /refresh (correct secret).. ⏭️  SKIP (ADMIN_SECRET not set)"
  TOTAL=$((TOTAL-1))
fi

# Test 7: CORS — unknown origin should NOT get ACAO header
echo -n "Test 7/8  CORS rejects unknown origin ..... "
ACAO=$(curl -s -I --max-time 5 \
  -H "Origin: https://evil.example.com" \
  "$WORKER_URL/?action=health" 2>/dev/null | grep -i "access-control-allow-origin" | tr -d '\r' || echo "")
if [ -z "$ACAO" ] || echo "$ACAO" | grep -q "^$"; then
  echo "✅ PASS (no ACAO header for unknown origin)"
  PASS=$((PASS+1))
else
  echo "❌ FAIL (ACAO returned: $ACAO)"
  FAIL=$((FAIL+1))
fi

# Test 8: CORS — known origin SHOULD get ACAO header
echo -n "Test 8/8  CORS allows soumdeco.pages.dev ... "
ACAO=$(curl -s -I --max-time 5 \
  -H "Origin: https://soumdeco.pages.dev" \
  "$WORKER_URL/?action=health" 2>/dev/null | grep -i "access-control-allow-origin" | tr -d '\r' || echo "")
if echo "$ACAO" | grep -q "soumdeco.pages.dev"; then
  echo "✅ PASS (ACAO = soumdeco.pages.dev)"
  PASS=$((PASS+1))
else
  echo "❌ FAIL (ACAO: $ACAO)"
  FAIL=$((FAIL+1))
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo "  RESULT: $PASS / $TOTAL passed, $FAIL failed"
echo "═══════════════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
