// Genera y descarga un PDF real de la cotización con jsPDF (client-side). Se usa
// solo en el navegador (la vista de cotizaciones es un componente cliente bajo el
// subárbol ssr:false), así que no corre en el runtime de Workers.

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Cotizacion } from "./types";

const soles = (n: number) => `S/ ${(n || 0).toFixed(2)}`;

export function descargarCotizacionPDF(cot: Cotizacion): void {
	const ref = cot.id.slice(0, 6).toUpperCase();
	const doc = new jsPDF();
	const M = 14; // margen izquierdo
	const anchoPag = doc.internal.pageSize.getWidth();

	// --- Encabezado ---
	doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(17, 24, 39);
	doc.text("Cotización", M, 20);
	doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(107, 114, 128);
	doc.text("ISAKI.PERU · MAYTA SPORT", M, 27);

	doc.setFontSize(10).setTextColor(17, 24, 39);
	doc.text(ref, anchoPag - M, 18, { align: "right" });
	doc.setTextColor(107, 114, 128);
	doc.text(`Emitida: ${cot.fechaEmision || "—"}`, anchoPag - M, 24, { align: "right" });

	doc.setDrawColor(17, 24, 39).setLineWidth(0.5).line(M, 33, anchoPag - M, 33);

	// --- Cliente ---
	doc.setFontSize(11).setTextColor(17, 24, 39);
	doc.setFont("helvetica", "bold").text("Cliente: ", M, 42);
	const wLabel = doc.getTextWidth("Cliente: ");
	doc.setFont("helvetica", "normal").text(cot.clienteNombre || "—", M + wLabel, 42);

	// --- Tabla de ítems ---
	autoTable(doc, {
		startY: 48,
		head: [["Producto", "Talla", "Color", "Cant.", "P. unit.", "Subtotal"]],
		body: cot.items.map((it) => [
			it.producto,
			it.talla,
			it.color,
			String(it.cantidad),
			soles(it.precioUnitario),
			soles(it.subtotal),
		]),
		theme: "striped",
		headStyles: { fillColor: [243, 244, 246], textColor: [17, 24, 39], fontStyle: "bold" },
		styles: { fontSize: 9, cellPadding: 2.5 },
		columnStyles: {
			3: { halign: "right" },
			4: { halign: "right" },
			5: { halign: "right" },
		},
		margin: { left: M, right: M },
	});

	// finalY: dónde terminó la tabla.
	let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

	// --- Total ---
	doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(17, 24, 39);
	doc.text("Total cotizado", anchoPag - M - 40, y, { align: "right" });
	doc.text(soles(cot.montoTotal), anchoPag - M, y, { align: "right" });

	// --- Condiciones ---
	if (cot.notasCondiciones) {
		y += 12;
		doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(107, 114, 128);
		doc.text("Condiciones", M, y);
		doc.setTextColor(17, 24, 39);
		const lineas = doc.splitTextToSize(cot.notasCondiciones, anchoPag - 2 * M);
		doc.text(lineas, M, y + 5);
	}

	// --- Pie ---
	doc.setFontSize(8).setTextColor(156, 163, 175);
	doc.text(
		`Documento generado por isaki-app · Cotización ${ref}`,
		anchoPag / 2,
		doc.internal.pageSize.getHeight() - 10,
		{ align: "center" },
	);

	doc.save(`Cotizacion-${ref}.pdf`);
}
