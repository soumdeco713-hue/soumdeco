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
// ============================================================

import { clientSubmitOrder } from "./client-sheet";

const FAILED_ORDERS_KEY = "soumdeco_failed_orders";
const MAX_RETRIES = 5; // don't retry forever

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
 */
export function addFailedOrder(order: FailedOrder): void {
  const orders = loadFailedOrders();
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
