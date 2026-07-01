import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	orderBy,
	query,
	serverTimestamp,
	updateDoc,
	where,
} from "firebase/firestore";
import { getDb } from "./firebase";
import { crearPedido } from "./pedidos";
import type { Cotizacion, CotizacionInput, EstadoCotizacion } from "./types";

const COL = "cotizaciones";

function round2(n: number): number {
	return Math.round((n + Number.EPSILON) * 100) / 100;
}

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

export async function obtenerCotizacion(id: string): Promise<Cotizacion | null> {
	const snap = await getDoc(doc(getDb(), COL, id));
	return snap.exists() ? ({ id: snap.id, ...snap.data() } as Cotizacion) : null;
}

export async function crearCotizacion(data: CotizacionInput, vendedorUid: string): Promise<string> {
	const items = data.items.map((it) => ({
		...it,
		subtotal: round2(it.cantidad * it.precioUnitario),
	}));
	const montoTotal = round2(items.reduce((acc, it) => acc + it.subtotal, 0));

	const nuevo = {
		clienteId: data.clienteId,
		clienteNombre: data.clienteNombre,
		vendedorUid,
		items,
		montoTotal,
		fechaEmision: new Date().toISOString().split("T")[0],
		fechaValidez: data.fechaValidez,
		estado: "borrador" as EstadoCotizacion,
		notasCondiciones: data.notasCondiciones ?? "",
		createdAt: serverTimestamp(),
		updatedAt: serverTimestamp(),
	};

	const ref = await addDoc(collection(getDb(), COL), nuevo);
	return ref.id;
}

export async function cambiarEstadoCotizacion(id: string, estado: EstadoCotizacion): Promise<void> {
	await updateDoc(doc(getDb(), COL, id), {
		estado,
		updatedAt: serverTimestamp(),
	});
}

export async function eliminarCotizacion(id: string): Promise<void> {
	await deleteDoc(doc(getDb(), COL, id));
}

/** 
 * Convierte una cotización aprobada en un pedido en firme. 
 * Crea el pedido y actualiza la cotización con el ID del pedido generado.
 */
export async function convertirAPedido(
	cotizacion: Cotizacion,
	anticipo: number,
	fechaEntregaPactada?: string
): Promise<string> {
	if (cotizacion.estado !== "aprobada") {
		throw new Error("Solo se pueden convertir cotizaciones aprobadas.");
	}

	// 1. Crear el pedido
	const pedidoId = await crearPedido({
		clienteId: cotizacion.clienteId,
		clienteNombre: cotizacion.clienteNombre,
		items: cotizacion.items,
		anticipo,
		fechaEntregaPactada,
		notas: `Generado a partir de la cotización #${cotizacion.id}. ${cotizacion.notasCondiciones || ""}`,
	}, cotizacion.vendedorUid);

	// 2. Marcar la cotización como convertida
	await updateDoc(doc(getDb(), COL, cotizacion.id), {
		estado: "convertida" as EstadoCotizacion,
		pedidoGeneradoId: pedidoId,
		updatedAt: serverTimestamp(),
	});

	return pedidoId;
}
