// Notificaciones salientes a Telegram, dirigidas a cada cliente. El token del
// bot y el mapa cliente→chat viven en el servidor (Worker); el cliente del
// navegador solo hace POST con el `clienteId` y el texto ya formateado. Es
// best-effort: si el cliente no vinculó su Telegram o el bot no está
// configurado, no pasa nada.

export async function notifyCliente(clienteId: string, text: string): Promise<void> {
	try {
		await fetch("/api/telegram", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ clienteId, text }),
		});
	} catch {
		// best-effort: una notificación perdida no debe afectar al usuario.
	}
}

/** Formatea soles para los mensajes (sin depender de la UI). */
export function soles(n: number): string {
	return `S/ ${(n || 0).toFixed(2)}`;
}
