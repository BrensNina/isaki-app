// Adjuntos de un pedido. El archivo se sube a Cloudflare R2 a través del route
// handler /api/adjuntos (el binding de R2 vive en el Worker); sus metadatos se
// guardan embebidos en el documento del pedido (`adjuntos[]`) para poder
// listarlos sin consultar R2.

import { arrayRemove, arrayUnion, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getDb } from "./firebase";
import type { Adjunto } from "./types";

/** Sube un archivo al pedido (R2) y registra sus metadatos en Firestore. */
export async function subirAdjunto(pedidoId: string, file: File): Promise<Adjunto> {
	const res = await fetch(
		`/api/adjuntos?pedidoId=${encodeURIComponent(pedidoId)}&nombre=${encodeURIComponent(file.name)}`,
		{
			method: "POST",
			headers: { "content-type": file.type || "application/octet-stream" },
			body: file,
		},
	);
	if (!res.ok) throw new Error("No se pudo subir el archivo.");
	const { key } = (await res.json()) as { key: string };

	// Firestore rechaza `undefined`; solo incluimos contentType si existe.
	const adjunto: Adjunto = {
		nombre: file.name,
		url: `/api/adjuntos/${key}`,
		path: key,
		size: file.size,
		subidoEn: new Date().toISOString(),
		...(file.type ? { contentType: file.type } : {}),
	};

	await updateDoc(doc(getDb(), "pedidos", pedidoId), {
		adjuntos: arrayUnion(adjunto),
		updatedAt: serverTimestamp(),
	});
	return adjunto;
}

/** Quita un adjunto del pedido (Firestore) y borra el objeto de R2. */
export async function eliminarAdjunto(pedidoId: string, adjunto: Adjunto): Promise<void> {
	await updateDoc(doc(getDb(), "pedidos", pedidoId), {
		adjuntos: arrayRemove(adjunto),
		updatedAt: serverTimestamp(),
	});
	try {
		await fetch(`/api/adjuntos/${adjunto.path}`, { method: "DELETE" });
	} catch {
		// La metadata ya se quitó; si el objeto quedó huérfano, no es crítico.
	}
}
