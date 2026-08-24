// ============================================================
//  FAILED ORDERS RETRY QUEUE
// ============================================================
//  When an order fails to submit to Apps Script (network error,
//  Apps Script down, etc.), it's saved to localStorage under
//  'soumdeco_failed_orders'. This module retries those orders
//  on the next page visit.
//
//  The retry is SILENT — the customer already saw a thank-you screen.
//  This is a background safety net for the admin.
//
//  CRITICAL: MAX_RETRIES = 1 (was 5 — caused duplicate rows)
//  Because Google Apps Script has NO idempotency, every retry could
//  create a new row in the sheet. We limit to 1 retry per order:
//    - Initial attempt (clientSubmitOrder, 0 retries internally)
//    - 1 retry on next page visit (this queue)
//  Max possible rows per order = 2 (only if both attempts actually reach Apps Script).
//  If first attempt fails before reaching Apps Script (network error),
//  only the retry creates a row — zero duplicates.
// ============================================================

import { clientSubmitOrder } from "./client-sheet";

const FAILED_ORDERS_KEY = "soumdeco_failed_orders";
const MAX_RETRIES = 1; // was 5 — reduced to prevent duplicate rows in sheet

type FailedOrder = {
  timestamp: string;
  retryCount?: number;
  product: string;
  quantity: string;
  price: number | null;
  shippingPrice: number;
  grandTotal: number;
  shippingCompanyLabel: string;
  fullName: string;
  phone: string;
  wilaya: string;
  commune: string;
  deliveryLabel: string;
  notes: string;
};

/**
 * Load failed orders from localStorage.
 */
function loadFailedOrders(): FailedOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FAILED_ORDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

/**
 * Save failed orders to localStorage.
 */
function saveFailedOrders(orders: FailedOrder[]): void {
  if (typeof window === "undefined") return;
  try {
    if (orders.length === 0) {
      window.localStorage.removeItem(FAILED_ORDERS_KEY);
    } else {
      window.localStorage.setItem(FAILED_ORDERS_KEY, JSON.stringify(orders));
    }
  } catch {
    // localStorage might be full — can't do anything
  }
}

/**
 * Add a failed order to the retry queue.
 * Called when clientSubmitOrder fails.
 *
 * CRITICAL: Check if an identical order is already queued (within 60s window).
 * This prevents the same failed order from being queued multiple times if the
 * customer navigates between pages or the queue retry fires multiple times.
 */
export function addFailedOrder(order: FailedOrder): void {
  const orders = loadFailedOrders();

  // Dedup check: if an identical order (same name + phone + product) exists
  // in the queue from the last 60 seconds, skip adding it again.
  const now = Date.now();
  const DEDUP_WINDOW_MS = 60_000; // 60 seconds
  const isDuplicate = orders.some((existing) => {
    if (existing.fullName !== order.fullName) return false;
    if (existing.phone !== order.phone) return false;
    if (existing.product !== order.product) return false;
    const existingTime = new Date(existing.timestamp).getTime();
    return !isNaN(existingTime) && (now - existingTime) < DEDUP_WINDOW_MS;
  });

  if (isDuplicate) {
    console.warn(
      "[FailedOrders] Duplicate order detected within 60s window — skipping add.",
    );
    return;
  }

  orders.push({ ...order, retryCount: 0 });
  saveFailedOrders(orders);
  console.warn(
    `[FailedOrders] Order saved for retry. Queue length: ${orders.length}`,
  );
}

/**
 * Retry all failed orders. Called on page load (in useCatalog init).
 * Returns the number of orders successfully retried.
 */
export async function retryFailedOrders(): Promise<number> {
  const orders = loadFailedOrders();
  if (orders.length === 0) return 0;

  let successCount = 0;
  const stillFailed: FailedOrder[] = [];

  for (const order of orders) {
    const retryCount = order.retryCount ?? 0;
    if (retryCount >= MAX_RETRIES) {
      // Exceeded max retries — keep in queue but don't retry
      // (admin should manually process these)
      stillFailed.push(order);
      continue;
    }

    const ok = await clientSubmitOrder({
      product: order.product,
      quantity: order.quantity,
      price: order.price,
      shippingPrice: order.shippingPrice,
      grandTotal: order.grandTotal,
      shippingCompanyLabel: order.shippingCompanyLabel,
      fullName: order.fullName,
      phone: order.phone,
      wilaya: order.wilaya,
      commune: order.commune,
      deliveryLabel: order.deliveryLabel,
      notes: order.notes,
    });

    if (ok) {
      successCount++;
    } else {
      // Increment retry count
      stillFailed.push({ ...order, retryCount: retryCount + 1 });
    }
  }

  saveFailedOrders(stillFailed);

  if (successCount > 0) {
    console.log(
      `[FailedOrders] Retried ${successCount} order(s) successfully. ` +
        `${stillFailed.length} still pending.`,
    );
  }

  return successCount;
}
