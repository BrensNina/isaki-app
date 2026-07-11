// Genera un "PDF" de la cotización sin dependencias: abre una ventana con el
// documento maquetado y dispara la impresión del navegador, donde el usuario
// elige "Guardar como PDF". Así se obtiene un archivo listo para enviar al
// cliente sin agregar ninguna librería de PDF.

import type { Cotizacion } from "./types";

const soles = (n: number) => `S/ ${(n || 0).toFixed(2)}`;

// Escapa texto de campos libres para no romper el HTML del documento.
function esc(s: string | undefined): string {
	return (s ?? "").replace(/[&<>"']/g, (c) =>
		({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
	);
}

export function descargarCotizacionPDF(cot: Cotizacion): void {
	const ref = cot.id.slice(0, 6).toUpperCase();
	const filas = cot.items
		.map(
			(it) => `<tr>
				<td>${esc(it.producto)}</td>
				<td>${esc(it.talla)}</td>
				<td>${esc(it.color)}</td>
				<td class="num">${it.cantidad}</td>
				<td class="num">${soles(it.precioUnitario)}</td>
				<td class="num">${soles(it.subtotal)}</td>
			</tr>`,
		)
		.join("");

	const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Cotizacion-${ref}</title>
<style>
	* { box-sizing: border-box; }
	body { font-family: system-ui, -apple-system, Arial, sans-serif; color: #111827; margin: 32px; }
	h1 { font-size: 22px; margin: 0; }
	.muted { color: #6b7280; }
	.head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 20px; }
	.ref { text-align: right; font-size: 13px; }
	.ref strong { font-size: 16px; }
	table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
	th, td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; text-align: left; }
	th { background: #f3f4f6; text-transform: uppercase; font-size: 11px; letter-spacing: .04em; }
	.num { text-align: right; font-variant-numeric: tabular-nums; }
	.total { display: flex; justify-content: flex-end; gap: 24px; margin-top: 16px; font-size: 16px; font-weight: 600; }
	.cond { margin-top: 20px; font-size: 13px; }
	.cond .muted { display: block; margin-bottom: 4px; }
	footer { margin-top: 40px; font-size: 11px; color: #9ca3af; text-align: center; }
	@media print { body { margin: 0; } }
</style></head>
<body>
	<div class="head">
		<div>
			<h1>Cotización</h1>
			<p class="muted">ISAKI.PERU · MAYTA SPORT</p>
		</div>
		<div class="ref">
			<div><strong>${ref}</strong></div>
			<div class="muted">Emitida: ${esc(cot.fechaEmision) || "—"}</div>
			<div class="muted">Válida hasta: ${esc(cot.fechaValidez) || "—"}</div>
		</div>
	</div>

	<p><strong>Cliente:</strong> ${esc(cot.clienteNombre)}</p>

	<table>
		<thead><tr>
			<th>Producto</th><th>Talla</th><th>Color</th>
			<th class="num">Cant.</th><th class="num">P. unit.</th><th class="num">Subtotal</th>
		</tr></thead>
		<tbody>${filas}</tbody>
	</table>

	<div class="total"><span>Total cotizado</span><span>${soles(cot.montoTotal)}</span></div>

	${cot.notasCondiciones ? `<div class="cond"><span class="muted">Condiciones</span>${esc(cot.notasCondiciones)}</div>` : ""}

	<footer>Documento generado por isaki-app · Cotización ${ref}</footer>
	<script>window.onload = function () { window.print(); };</script>
</body></html>`;

	const w = window.open("", "_blank");
	if (!w) {
		alert("Permite las ventanas emergentes para generar el PDF.");
		return;
	}
	w.document.write(html);
	w.document.close();
}
