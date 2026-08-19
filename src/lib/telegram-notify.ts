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
//  If env vars are not set, this module silently does nothing
//  (no error, no crash — orders still work normally).
// ============================================================

const TELEGRAM_API_BASE = "https://api.telegram.org";

/**
 * Send a Telegram notification about a new order.
 * Simple message: "لديك طلب جديد يا عزيزي 🛒" (You have a new order, dear)
 *
 * NEVER throws — if Telegram fails, the order still succeeds.
 * Returns true on success, false on failure (silent).
 */
export async function sendOrderTelegramNotification(): Promise<boolean> {
  try {
    const botToken = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
    const chatId = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID;

    // If not configured, silently skip (no error)
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
