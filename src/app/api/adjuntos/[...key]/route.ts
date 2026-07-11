// Descarga y borrado de un adjunto en R2. La clave del objeto llega como
// segmentos de ruta (p. ej. /api/adjuntos/pedidos/{id}/{archivo}).

import { getCloudflareContext } from "@opennextjs/cloudflare";

type Ctx = { params: Promise<{ key: string[] }> };

export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
	const { key } = await params;
	const obj = await getCloudflareContext().env.ADJUNTOS_BUCKET.get(key.join("/"));
	if (!obj) return new Response("No encontrado", { status: 404 });

	const headers = new Headers();
	obj.writeHttpMetadata(headers);
	headers.set("etag", obj.httpEtag);
	headers.set("cache-control", "private, max-age=3600");
	// Materializamos el objeto (cuerpo con longitud conocida) en vez de devolver
	// el stream de R2: evita problemas de serialización del stream en el runtime.
	const buf = await obj.arrayBuffer();
	return new Response(buf, { headers });
}

export async function DELETE(_req: Request, { params }: Ctx): Promise<Response> {
	const { key } = await params;
	await getCloudflareContext().env.ADJUNTOS_BUCKET.delete(key.join("/"));
	return Response.json({ ok: true });
}
