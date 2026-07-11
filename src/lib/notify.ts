// Notificaciones salientes a Telegram. El token del bot vive en el servidor
// (Worker), así que el cliente solo hace POST a /api/telegram con el texto ya
// formateado. Es best-effort: si falla o el bot no está configurado, no rompe
// la acción que la disparó.

export async function notifyTelegram(text: string): Promise<void> {
	try {
		await fetch("/api/telegram", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ text }),
		});
	} catch {
		// best-effort: una notificación perdida no debe afectar al usuario.
	}
}

/** Formatea soles para los mensajes (sin depender de la UI). */
export function soles(n: number): string {
	return `S/ ${(n || 0).toFixed(2)}`;
}
