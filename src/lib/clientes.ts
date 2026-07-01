// Capa de acceso a datos del módulo Clientes. Estas funciones son la "API" que
// consume el frontend: encapsulan todo el acceso a Firestore para la colección
// `clientes`. Si en el futuro se expone una fachada REST (/api/clientes), esa
// capa simplemente llamaría a estas mismas funciones.

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
import type { Cliente, ClienteInput } from "./types";

const COL = "clientes";

/** Lista los clientes del vendedor, o todos si es admin. */
export async function listarClientes(uid: string, rol: string): Promise<Cliente[]> {
	let q = query(collection(getDb(), COL), orderBy("createdAt", "desc"));
	if (rol === "vendedor") {
		q = query(collection(getDb(), COL), where("vendedorUid", "==", uid));
	}
	const snap = await getDocs(q);
	const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Cliente);
	if (rol === "vendedor") {
		data.sort((a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
	}
	return data;
}

/** Obtiene un cliente por id, o `null` si no existe. */
export async function obtenerCliente(id: string): Promise<Cliente | null> {
	const snap = await getDoc(doc(getDb(), COL, id));
	return snap.exists() ? ({ id: snap.id, ...snap.data() } as Cliente) : null;
}

/** Registra un nuevo cliente. Devuelve el id generado. (Firebase first)*/
export async function crearCliente(data: ClienteInput, vendedorUid: string): Promise<string> {
	const ref = await addDoc(collection(getDb(), COL), {
		...limpiar(data),
		vendedorUid,
		createdAt: serverTimestamp(),
		updatedAt: serverTimestamp(),
	});
	return ref.id;
}

/** Actualiza los datos de un cliente existente. */
export async function actualizarCliente(id: string, data: ClienteInput): Promise<void> {
	await updateDoc(doc(getDb(), COL, id), {
		...limpiar(data),
		updatedAt: serverTimestamp(),
	});
}

/** Elimina un cliente. */
export async function eliminarCliente(id: string): Promise<void> {
	await deleteDoc(doc(getDb(), COL, id));
}

/**
 * Firestore rechaza valores `undefined`. Quita las claves cuyo valor sea
 * undefined o cadena vacía (campos opcionales no completados).
 */
function limpiar<T extends Record<string, unknown>>(data: T): Partial<T> {
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(data)) {
		if (v !== undefined && v !== "") out[k] = v;
	}
	return out as Partial<T>;
}
