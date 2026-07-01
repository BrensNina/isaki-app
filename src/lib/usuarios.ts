import { collection, doc, getDocs, updateDoc, setDoc, query, orderBy, deleteDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { getDb, getSecondaryAuth } from "./firebase";
import type { UserProfile, Rol } from "./types";

export async function listarUsuarios(): Promise<UserProfile[]> {
	const db = getDb();
	const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
	const snap = await getDocs(q);
	return snap.docs.map((d) => d.data() as UserProfile);
}

export async function actualizarRolUsuario(uid: string, nuevoRol: Rol): Promise<void> {
	const db = getDb();
	const ref = doc(db, "users", uid);
	await updateDoc(ref, { rol: nuevoRol });
}

export async function eliminarUsuarioAdmin(uid: string): Promise<void> {
	const db = getDb();
	await deleteDoc(doc(db, "users", uid));
}

/**
 * Crea un usuario desde el panel de admin usando una instancia secundaria de Auth
 * para evitar que la sesión principal (la del admin) se cierre.
 */
export async function crearUsuarioPorAdmin(
	email: string,
	password: string,
	displayName: string,
	rol: Rol
): Promise<void> {
	// 1. Crear el Auth user en la app secundaria
	const secondaryAuth = getSecondaryAuth();
	const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
	const user = cred.user;

	// 2. Actualizar su display name
	if (displayName) {
		await updateProfile(user, { displayName });
	}

	// 3. Crear el documento en Firestore
	const db = getDb();
	const ref = doc(db, "users", user.uid);
	
	const profile: UserProfile = {
		uid: user.uid,
		email: user.email,
		displayName: displayName || user.email?.split("@")[0] || "Usuario",
		photoURL: user.photoURL,
		rol: rol,
		bio: "",
	};

	await setDoc(ref, {
		...profile,
		createdAt: new Date(),
	});

	// Cerrar sesión en la instancia secundaria (opcional pero recomendado)
	await secondaryAuth.signOut();
}
