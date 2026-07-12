// Capa de acceso a datos del módulo Cotizaciones (colección `cotizaciones`).
// Una cotización es una propuesta previa al pedido; al aprobarse genera un
// pedido real reutilizando `crearPedido` y queda enlazada por `pedidoGeneradoId`.

import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	getDocs,
	orderBy,
	query,
	serverTimestamp,
	updateDoc,
	where,
} from "firebase/firestore";
import { getDb } from "./firebase";
import { calcularTotales, crearPedido } from "./pedidos";
import type { Cotizacion, CotizacionInput, EstadoCotizacion } from "./types";

const COL = "cotizaciones";

/** Lista las cotizaciones del vendedor, o todas si es admin. */
export async function listarCotizaciones(uid: string, rol: string): Promise<Cotizacion[]> {
	let q = query(collection(getDb(), COL), orderBy("createdAt", "desc"));
	if (rol === "vendedor") {
		q = query(collection(getDb(), COL), where("vendedorUid", "==", uid));
	}
	const snap = await getDocs(q);
	const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Cotizacion);
	if (rol === "vendedor") {
		data.sort((a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
	}
	return data;
}

export async function crearCotizacion(data: CotizacionInput, vendedorUid: string): Promise<string> {
	const { items, montoTotal } = calcularTotales(data.items);
	const nueva = {
		clienteId: data.clienteId,
		clienteNombre: data.clienteNombre,
		vendedorUid,
		items,
		montoTotal,
		fechaEmision: new Date().toISOString().slice(0, 10),
		estado: "borrador" as EstadoCotizacion,
		notasCondiciones: data.notasCondiciones ?? "",
		createdAt: serverTimestamp(),
		updatedAt: serverTimestamp(),
	};
	const ref = await addDoc(collection(getDb(), COL), nueva);
	return ref.id;
}

export async function actualizarCotizacion(id: string, data: CotizacionInput): Promise<void> {
	const { items, montoTotal } = calcularTotales(data.items);
	await updateDoc(doc(getDb(), COL, id), {
		clienteId: data.clienteId,
		clienteNombre: data.clienteNombre,
		items,
		montoTotal,
		notasCondiciones: data.notasCondiciones ?? "",
		updatedAt: serverTimestamp(),
	});
}

export async function cambiarEstadoCotizacion(id: string, estado: EstadoCotizacion): Promise<void> {
	await updateDoc(doc(getDb(), COL, id), { estado, updatedAt: serverTimestamp() });
}

export async function eliminarCotizacion(id: string): Promise<void> {
	await deleteDoc(doc(getDb(), COL, id));
}

/** Convierte una cotización en un pedido real y las deja enlazadas. */
export async function convertirAPedido(cot: Cotizacion): Promise<string> {
	const pedidoId = await crearPedido(
		{
			clienteId: cot.clienteId,
			clienteNombre: cot.clienteNombre,
			items: cot.items,
			anticipo: 0,
			notas: cot.notasCondiciones ? `Desde cotización: ${cot.notasCondiciones}` : undefined,
		},
		cot.vendedorUid,
	);
	await updateDoc(doc(getDb(), COL, cot.id), {
		estado: "convertida" as EstadoCotizacion,
		pedidoGeneradoId: pedidoId,
		updatedAt: serverTimestamp(),
	});
	// El cliente recibe el aviso de "pedido registrado" que dispara crearPedido.
	return pedidoId;
}
