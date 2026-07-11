// Secretos del Worker para Telegram. No están en wrangler.jsonc (son secretos /
// .dev.vars), así que `wrangler types` no los genera. Los agregamos a
// CloudflareEnv por declaration merging para poder leerlos tipados en las rutas.
interface CloudflareEnv {
	TELEGRAM_BOT_TOKEN?: string;
	TELEGRAM_CHAT_ID?: string;
	TELEGRAM_WEBHOOK_SECRET?: string;
}
