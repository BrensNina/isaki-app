// Envío saliente a un cliente por Telegram. Mantiene el token del bot en el
// servidor (Worker) y resuelve el chat del cliente desde KV (cliente:<id>).
// Solo hace `fetch` + KV: seguro en el runtime de Workers (no importa Firebase).

import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function POST(req: Request): Promise<Response> {
	const body = (await req.json().catch(() => null)) as { text?: string; clienteId?: string } | null;
	const text = body?.text?.trim();
	if (!text) return Response.json({ ok: false, error: "texto vacío" }, { status: 400 });

	const { env } = getCloudflareContext();
	const token = env.TELEGRAM_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN;
	if (!token) return Response.json({ ok: false, skipped: "telegram no configurado" });

	// Con clienteId → busca su chat vinculado. Sin él → chat interno (fallback).
	let chatId: string | undefined;
	if (body?.clienteId) {
		chatId = (await env.TELEGRAM_KV.get(`cliente:${body.clienteId}`)) ?? undefined;
		if (!chatId) return Response.json({ ok: false, skipped: "cliente no vinculado" });
	} else {
		chatId = env.TELEGRAM_CHAT_ID ?? process.env.TELEGRAM_CHAT_ID;
		if (!chatId) return Response.json({ ok: false, skipped: "sin destino" });
	}

	const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		// Sin parse_mode: los mensajes son texto plano y pueden incluir notas del
		// usuario con < o & que romperían el parseo HTML (Telegram devolvería 400).
		body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
	});
	return Response.json({ ok: r.ok });
}
