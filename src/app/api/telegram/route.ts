// Proxy saliente a la API de Telegram. Mantiene el token del bot en el servidor
// (Worker) para no exponerlo al cliente. No importa Firebase: solo hace `fetch`,
// así que es seguro ejecutarlo en el runtime de Workers (SSR).
//
// ponytail: endpoint sin autenticación; cualquiera que conozca la URL puede
// enviar un mensaje al chat configurado. Aceptable para un prototipo interno.
// Si importa, verificar el ID token de Firebase o un secreto compartido.

import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function POST(req: Request): Promise<Response> {
	const body = (await req.json().catch(() => null)) as { text?: string } | null;
	const text = body?.text?.trim();
	if (!text) return Response.json({ ok: false, error: "texto vacío" }, { status: 400 });

	let token: string | undefined;
	let chatId: string | undefined;
	try {
		const env = getCloudflareContext().env as unknown as Record<string, string | undefined>;
		token = env.TELEGRAM_BOT_TOKEN;
		chatId = env.TELEGRAM_CHAT_ID;
	} catch {
		// Fuera del contexto de Cloudflare (algunos entornos de dev): usa process.env.
	}
	token ??= process.env.TELEGRAM_BOT_TOKEN;
	chatId ??= process.env.TELEGRAM_CHAT_ID;

	// Sin configurar → no-op silencioso, para que la app funcione sin el bot.
	if (!token || !chatId) return Response.json({ ok: false, skipped: "telegram no configurado" });

	const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
	});
	return Response.json({ ok: r.ok });
}
