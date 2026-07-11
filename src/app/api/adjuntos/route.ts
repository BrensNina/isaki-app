// Subida de adjuntos de pedidos a Cloudflare R2. El binding de R2 es del lado
// servidor (Worker), así que la subida pasa por aquí. No importa Firebase → es
// seguro en el runtime de Workers. El cliente guarda los metadatos en Firestore.
//
// ponytail: endpoint sin autenticación (cualquiera con la URL puede subir).
// Aceptable para el prototipo; verificar el ID token de Firebase si importa.

import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function POST(req: Request): Promise<Response> {
	const url = new URL(req.url);
	const pedidoId = url.searchParams.get("pedidoId");
	const nombre = url.searchParams.get("nombre") || "archivo";
	if (!pedidoId) return Response.json({ ok: false, error: "falta pedidoId" }, { status: 400 });
	if (!req.body) return Response.json({ ok: false, error: "sin archivo" }, { status: 400 });

	const bucket = getCloudflareContext().env.ADJUNTOS_BUCKET;
	// Nombre saneado; el timestamp evita colisiones y mantiene el original legible.
	const safe = nombre.replace(/[^\w.\-]+/g, "_");
	const key = `pedidos/${pedidoId}/${Date.now()}-${safe}`;
	const contentType = req.headers.get("content-type") || "application/octet-stream";

	// R2.put exige un cuerpo con longitud conocida; el stream de la request no la
	// tiene, así que lo materializamos (los adjuntos van tope 15 MB).
	const buf = await req.arrayBuffer();
	await bucket.put(key, buf, { httpMetadata: { contentType } });
	return Response.json({ ok: true, key });
}
