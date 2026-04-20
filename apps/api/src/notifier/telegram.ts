import { config } from '../config.js';
import { logger } from '../logger.js';

/**
 * Cliente mínimo pra Telegram Bot API. Usa só `sendMessage` — suficiente
 * pra notificações de texto com markdown simples. Silent no-op se
 * TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não estiverem configurados,
 * pra não quebrar o setup de dev sem segredos.
 */

const API_BASE = 'https://api.telegram.org';

export function isTelegramConfigured(): boolean {
  return Boolean(config.TELEGRAM_BOT_TOKEN && config.TELEGRAM_CHAT_ID);
}

export async function sendTelegramMessage(text: string): Promise<void> {
  if (!isTelegramConfigured()) return;

  const token = config.TELEGRAM_BOT_TOKEN!;
  const chatId = config.TELEGRAM_CHAT_ID!;
  const url = `${API_BASE}/bot${token}/sendMessage`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.warn({ status: res.status, body: body.slice(0, 200) }, 'telegram send failed');
    }
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'telegram send error',
    );
  }
}
