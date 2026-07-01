// Capa de acceso a datos del módulo Pedidos. Encapsula el acceso a Firestore
// para la colección `pedidos` y concentra las reglas de negocio simples del
// flujo (cálculo de totales, confirmación de anticipo, transiciones de estado).

import {
	addDoc,
	arrayUnion,
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
import type { EstadoPedido, HistorialEntry, ItemPedido, Pedido, PedidoInput } from "./types";

const COL = "pedidos";

/** Recalcula subtotales de cada línea y el monto total del pedido. */
export function calcularTotales(items: ItemPedido[]): { items: ItemPedido[]; montoTotal: number } {
	const norm = items.map((it) => ({
		...it,
		subtotal: round2(it.cantidad * it.precioUnitario),
	}));
	const montoTotal = round2(norm.reduce((acc, it) => acc + it.subtotal, 0));
	return { items: norm, montoTotal };
}

/** Lista todos los pedidos, del más reciente al más antiguo. */
export async function listarPedidos(): Promise<Pedido[]> {
	const snap = await getDocs(query(collection(getDb(), COL), orderBy("createdAt", "desc")));
	return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Pedido);
}

/** Lista los pedidos de un cliente (historial de pedidos — RF-06). */
export async function listarPedidosPorCliente(clienteId: string): Promise<Pedido[]> {
	const snap = await getDocs(
		query(collection(getDb(), COL), where("clienteId", "==", clienteId), orderBy("createdAt", "desc")),
	);
	return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Pedido);
}

export async function obtenerPedido(id: string): Promise<Pedido | null> {
	const snap = await getDoc(doc(getDb(), COL, id));
	return snap.exists() ? ({ id: snap.id, ...snap.data() } as Pedido) : null;
}

/**
 * Registra un nuevo pedido. El estado inicial depende del anticipo:
 *  - Con anticipo (> 0): queda "pendiente_anticipo" hasta confirmar su recepción,
 *    requisito para pasar a producción (RF-10, RF-11, RF-13).
 *  - Sin anticipo (= 0): no hay nada que confirmar, así que pasa directo a
 *    "en_produccion". Evita pedir una "confirmación de anticipo" de S/ 0.00.
 */
export async function crearPedido(data: PedidoInput, vendedorUid: string): Promise<string> {
	const { items, montoTotal } = calcularTotales(data.items);
	const anticipo = round2(data.anticipo || 0);

	const requiereAnticipo = anticipo > 0;
	const estado: EstadoPedido = requiereAnticipo ? "pendiente_anticipo" : "pendiente_produccion";
	const notaInicial = requiereAnticipo
		? "Pedido registrado. A la espera de confirmar el anticipo."
		: "Pedido registrado sin anticipo. Pasa a cola de producción.";

	const nuevo = {
		clienteId: data.clienteId,
		clienteNombre: data.clienteNombre,
		vendedorUid,
		items,
		montoTotal,
		anticipo,
		anticipoConfirmado: !requiereAnticipo,
		saldo: round2(montoTotal - anticipo),
		fechaEntregaPactada: data.fechaEntregaPactada ?? null,
		notas: data.notas ?? "",
		estado,
		historial: [entrada(estado, notaInicial)],
		createdAt: serverTimestamp(),
		updatedAt: serverTimestamp(),
	};

	const ref = await addDoc(collection(getDb(), COL), nuevo);
	return ref.id;
}

/** Confirma la recepción del anticipo: habilita el pedido para producción. */
export async function confirmarAnticipo(id: string): Promise<void> {
	await updateDoc(doc(getDb(), COL, id), {
		anticipoConfirmado: true,
		estado: "pendiente_produccion" as EstadoPedido,
		historial: arrayUnion(entrada("pendiente_produccion", "Anticipo confirmado. Pasa a cola de producción.")),
		updatedAt: serverTimestamp(),
	});
}

/** Agrega un reporte de avance sin cambiar de estado (se asume que está en producción) */
export async function reportarProgreso(id: string, nota: string): Promise<void> {
	await updateDoc(doc(getDb(), COL, id), {
		historial: arrayUnion(entrada("en_produccion", nota)),
		updatedAt: serverTimestamp(),
	});
}

/** Cambia el estado del pedido y deja registro en el historial (trazabilidad — RF-21). */
export async function cambiarEstado(id: string, estado: EstadoPedido, nota?: string): Promise<void> {
	await updateDoc(doc(getDb(), COL, id), {
		estado,
		historial: arrayUnion(entrada(estado, nota)),
		updatedAt: serverTimestamp(),
	});
}

/** Crea una entrada de historial fechada en el momento del cambio. */
function entrada(estado: EstadoPedido, nota?: string): HistorialEntry {
	return nota ? { estado, fecha: new Date().toISOString(), nota } : { estado, fecha: new Date().toISOString() };
}

export async function eliminarPedido(id: string): Promise<void> {
	await deleteDoc(doc(getDb(), COL, id));
}

function round2(n: number): number {
	return Math.round((n + Number.EPSILON) * 100) / 100;
}
