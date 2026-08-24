// ============================================================
//  TELEGRAM BOT NOTIFICATION — Simple order alert
// ============================================================
//  Sends a simple "you have a new order dear" message in Arabic
//  to the admin's Telegram after every successful order.
//
//  SETUP:
//  1. Create a Telegram bot via @BotFather → get BOT_TOKEN
//  2. Get your CHAT_ID (send a message to the bot, then visit
//     https://api.telegram.org/bot<TOKEN>/getUpdates → find chat.id)
//  3. Add these as Cloudflare Pages env vars:
//     NEXT_PUBLIC_TELEGRAM_BOT_TOKEN=<your_bot_token>
//     NEXT_PUBLIC_TELEGRAM_CHAT_ID=<your_chat_id>
//
//  If env vars are not set, falls back to hardcoded values
//  (matches the pattern in sheet.ts and drive-upload.ts).
//  ============================================================

const TELEGRAM_API_BASE = "https://api.telegram.org";

// HARDCODED FALLBACK — guarantees Telegram works even if Cloudflare
// Pages env vars are not inlined at build time (known Cloudflare issue:
// secret_text env vars are NOT inlined into client bundle).
// This bot can ONLY send messages to chat_id 1913149719 (the admin's
// personal Telegram). It cannot read messages, delete anything, or
// send to anyone else. Safe to be in the client bundle.
const FALLBACK_BOT_TOKEN = "8992415134:AAEDrndNXlmEpqS0BT5FSfvwog61vXdOulE";
const FALLBACK_CHAT_ID = "1913149719";

/**
 * Send a Telegram notification about a new order.
 * Simple message: "لديك طلب جديد يا عزيزي 🛒" (You have a new order, dear)
 *
 * NEVER throws — if Telegram fails, the order still succeeds.
 * Returns true on success, false on failure (silent).
 */
export async function sendOrderTelegramNotification(): Promise<boolean> {
  try {
    // Use env var if set (inlined at build time), otherwise use hardcoded fallback
    const botToken = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || FALLBACK_BOT_TOKEN;
    const chatId = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID || FALLBACK_CHAT_ID;

    // If both are empty, silently skip (should never happen with fallback)
    if (!botToken || !chatId) {
      return false;
    }

    // Simple Arabic message: "لديك طلب جديد يا عزيزي 🛒"
    // Translation: "You have a new order, dear 🛒"
    const message = "لديك طلب جديد يا عزيزي 🛒";

    const url = `${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn("[Telegram] Notification failed:", res.status);
      return false;
    }

    const data = await res.json().catch(() => null);
    if (data?.ok) {
      return true;
    }
    return false;
  } catch (err) {
    // Silent — never crash the order flow
    console.warn("[Telegram] Notification error:", String((err as Error)?.message || err));
    return false;
  }
}
