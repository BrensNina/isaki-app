// Webhook entrante de Telegram: recibe los updates del bot. Su único trabajo es
// vincular un cliente cuando abre el enlace `t.me/<bot>?start=<clienteId>` y da
// Start: guarda su chat en KV (cliente:<id> = chatId) para poder notificarle
// luego. Solo usa KV + fetch → seguro en Workers (no importa Firebase).
//
// Seguridad: Telegram envía el header X-Telegram-Bot-Api-Secret-Token con el
// valor que registramos en setWebhook; lo validamos contra TELEGRAM_WEBHOOK_SECRET.

import { getCloudflareContext } from "@opennextjs/cloudflare";

interface TelegramUpdate {
	message?: {
		chat?: { id?: number | string };
		text?: string;
	};
}

export async function POST(req: Request): Promise<Response> {
	const { env } = getCloudflareContext();
	const secret = env.TELEGRAM_WEBHOOK_SECRET ?? process.env.TELEGRAM_WEBHOOK_SECRET;
	if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
		return new Response("no autorizado", { status: 401 });
	}

	const update = (await req.json().catch(() => null)) as TelegramUpdate | null;
	const chatId = update?.message?.chat?.id;
	const text = update?.message?.text?.trim() ?? "";

	// Solo nos interesa "/start <clienteId>". Todo lo demás → 200 y a otra cosa.
	const match = /^\/start\s+([\w-]{1,64})$/.exec(text);
	if (chatId != null && match) {
		const clienteId = match[1];
		await env.TELEGRAM_KV.put(`cliente:${clienteId}`, String(chatId));
		await responder(env.TELEGRAM_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN, chatId,
			"✅ ¡Listo! Quedaste vinculado. Te avisaremos por aquí cada avance de tus pedidos.");
	} else if (chatId != null && /^\/start\b/.test(text)) {
		await responder(env.TELEGRAM_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN, chatId,
			"Hola 👋 Para vincular tu cuenta, abre el enlace que te compartió tu vendedor.");
	}

	// Telegram reintenta si no recibe 200.
	return Response.json({ ok: true });
}

async function responder(token: string | undefined, chatId: number | string, text: string): Promise<void> {
	if (!token) return;
	try {
		await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ chat_id: chatId, text }),
		});
	} catch {
		// best-effort
	}
}
